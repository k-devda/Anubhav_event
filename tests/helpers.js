'use strict';
const http = require('node:http');
const { open } = require('../server/db');
const { createApp } = require('../server/app');
const auth = require('../server/auth');
const settingsStore = require('../server/settings');

/** Boots the real app on a random port with a fresh in-memory database. */
async function start() {
  const db = open(':memory:');
  settingsStore.get(db);
  const { handler, limiter } = createApp(db);
  const server = http.createServer(handler);
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}`;

  function client() {
    let cookie = '';
    const c = {
      async req(method, path, body, headers) {
        const h = Object.assign({ 'X-Requested-With': 'anubhav' }, headers || {});
        if (body !== undefined) h['Content-Type'] = 'application/json';
        if (cookie) h.Cookie = cookie;
        const res = await fetch(base + path, { method, headers: h, body: body === undefined ? undefined : JSON.stringify(body), redirect: 'manual' });
        const sc = res.headers.getSetCookie ? res.headers.getSetCookie() : [];
        if (sc.length) { const first = sc[0].split(';')[0]; cookie = first.endsWith('=') ? '' : first; }
        let json = null; try { json = await res.json(); } catch (e) { /* not json */ }
        return { status: res.status, json, headers: res.headers };
      },
      get: (p, h) => c.req('GET', p, undefined, h),
      post: (p, b, h) => c.req('POST', p, b === undefined ? {} : b, h),
      put: (p, b) => c.req('PUT', p, b),
      del: p => c.req('DELETE', p),
      async login(email, password) { limiter.reset(); return c.post('/api/auth/login', { email, password }); }
    };
    return c;
  }

  async function makeUser(role, email, password, mustChange) {
    return auth.createUser(db, { email, name: `${role} user`, role, password, mustChange: !!mustChange });
  }

  async function adminClient() {
    await makeUser('admin', `admin${Math.random().toString(36).slice(2, 7)}@example.com`, 'Passw0rdPassw0rd');
    const row = db.prepare("SELECT email FROM users WHERE role='admin' ORDER BY created_at DESC LIMIT 1").get();
    const c = client();
    const r = await c.login(row.email, 'Passw0rdPassw0rd');
    if (r.status !== 200) throw new Error('admin login failed ' + JSON.stringify(r.json));
    return c;
  }

  return { db, base, client, makeUser, adminClient, limiter, close: () => new Promise(r => server.close(r)) };
}

const validReg = (over) => Object.assign({
  name: 'Test Volunteer', mobile: '98765 43210', email: `v${Math.random().toString(36).slice(2, 8)}@example.com`,
  institution: 'PDEU', course: 'B.Tech', year: '2nd', availability: ['Event day — morning'], consent: true
}, over || {});

module.exports = { start, validReg };
