'use strict';
const fs = require('node:fs');
const path = require('node:path');
const config = require('./config');
const auth = require('./auth');
const { AppError, createLimiter } = require('./util');

const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.txt': 'text/plain; charset=utf-8'
};

const SECURITY_HEADERS = {
  'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'",
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'same-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  'Cross-Origin-Opener-Policy': 'same-origin'
};

function createApp(db, opts) {
  opts = opts || {};
  const limiter = createLimiter();
  const routes = [];
  const router = {
    add(method, pattern, handler) {
      const keys = [];
      const re = new RegExp('^' + pattern.replace(/:([a-zA-Z]+)/g, (_, k) => { keys.push(k); return '([^/]+)'; }) + '$');
      routes.push({ method, re, keys, handler });
    }
  };
  ['get', 'post', 'put', 'patch', 'delete'].forEach(m => { router[m] = (p, h) => router.add(m.toUpperCase(), p, h); });

  const deps = { db, limiter, router, config };
  require('./routes/auth')(deps);
  require('./routes/public')(deps);
  require('./routes/admin')(deps);

  const clientIp = req => {
    if (config.trustProxy) {
      const f = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
      if (f) return f;
    }
    return req.socket.remoteAddress || '';
  };

  function send(res, status, body, headers) {
    const buf = Buffer.isBuffer(body) ? body : Buffer.from(typeof body === 'string' ? body : JSON.stringify(body));
    res.writeHead(status, Object.assign({}, SECURITY_HEADERS, { 'Content-Length': buf.length }, headers));
    res.end(buf);
  }
  const sendJson = (res, status, obj, headers) => send(res, status, obj, Object.assign({ 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }, headers));

  function readBody(req) {
    return new Promise((resolve, reject) => {
      const chunks = []; let size = 0;
      req.on('data', c => {
        size += c.length;
        if (size > config.maxBodyBytes) { reject(new AppError(413, 'Request is too large.')); req.destroy(); return; }
        chunks.push(c);
      });
      req.on('end', () => {
        if (!size) return resolve({});
        if (!/application\/json/i.test(req.headers['content-type'] || '')) return reject(new AppError(415, 'Send JSON with Content-Type: application/json.'));
        try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))); } catch (e) { reject(new AppError(400, 'Invalid JSON.')); }
      });
      req.on('error', reject);
    });
  }

  /** Cross-site request protection for state-changing API calls. */
  function csrfCheck(req) {
    if (req.headers['x-requested-with'] !== 'anubhav') throw new AppError(403, 'Missing request header.');
    const origin = req.headers.origin;
    if (origin) {
      let host; try { host = new URL(origin).host; } catch (e) { throw new AppError(403, 'Bad origin.'); }
      if (host !== req.headers.host) throw new AppError(403, 'Cross-origin request blocked.');
    }
  }

  async function handleApi(req, res, url) {
    const method = req.method;
    const route = routes.find(r => r.method === method && r.re.test(url.pathname));
    if (!route) {
      if (routes.some(r => r.re.test(url.pathname))) throw new AppError(405, 'Method not allowed.');
      throw new AppError(404, 'Not found.');
    }
    if (method !== 'GET') csrfCheck(req);
    const m = url.pathname.match(route.re);
    const params = {}; route.keys.forEach((k, i) => { params[k] = decodeURIComponent(m[i + 1]); });
    const body = ['POST', 'PUT', 'PATCH'].includes(method) ? await readBody(req) : {};
    const user = auth.userFromRequest(db, req);
    const ctx = { req, res, url, params, body, user, ip: clientIp(req), db, limiter, config, headers: {} };
    const result = await route.handler(ctx);
    const status = ctx.status || 200;
    if (ctx.headers['Set-Cookie'] === undefined) delete ctx.headers['Set-Cookie'];
    sendJson(res, status, result === undefined ? { ok: true } : result, ctx.headers);
  }

  function serveStatic(req, res, url) {
    if (!['GET', 'HEAD'].includes(req.method)) return send(res, 405, 'Method not allowed', { 'Content-Type': 'text/plain' });
    let rel;
    try { rel = decodeURIComponent(url.pathname); } catch (e) { return send(res, 400, 'Bad request', { 'Content-Type': 'text/plain' }); }
    if (rel.includes('\0') || rel.split('/').some(seg => seg.startsWith('.'))) return send(res, 404, 'Not found', { 'Content-Type': 'text/plain' });
    if (rel.endsWith('/')) rel += 'index.html';
    if (rel === '/') rel = '/index.html';
    const file = path.normalize(path.join(config.publicDir, rel));
    if (!file.startsWith(config.publicDir + path.sep)) return send(res, 403, 'Forbidden', { 'Content-Type': 'text/plain' });

    // Admin screens require a signed-in session (the API enforces this too).
    if (/^\/admin\/[^/]+\.html$/.test(rel) && !auth.userFromRequest(db, req)) {
      res.writeHead(302, Object.assign({}, SECURITY_HEADERS, { Location: '/login.html?next=' + encodeURIComponent(rel) }));
      return res.end();
    }
    let st;
    try { st = fs.statSync(file); } catch (e) { return send(res, 404, 'Not found', { 'Content-Type': 'text/plain' }); }
    if (!st.isFile()) return send(res, 404, 'Not found', { 'Content-Type': 'text/plain' });
    const type = MIME[path.extname(file).toLowerCase()] || 'application/octet-stream';
    const headers = { 'Content-Type': type, 'Cache-Control': 'no-cache' };
    if (req.method === 'HEAD') { res.writeHead(200, Object.assign({}, SECURITY_HEADERS, headers, { 'Content-Length': st.size })); return res.end(); }
    send(res, 200, fs.readFileSync(file), headers);
  }

  async function handler(req, res) {
    const url = new URL(req.url, 'http://localhost');
    try {
      if (url.pathname.startsWith('/api/')) await handleApi(req, res, url);
      else serveStatic(req, res, url);
    } catch (e) {
      if (e instanceof AppError) {
        sendJson(res, e.status, Object.assign({ error: e.message }, e.extra));
      } else {
        console.error('[error]', req.method, url.pathname, e);
        sendJson(res, 500, { error: 'Something went wrong on the server.' });
      }
    }
  }

  return { handler, limiter };
}

module.exports = { createApp };
