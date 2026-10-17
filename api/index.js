'use strict';
/**
 * Vercel entry point. Every /api/* request (and /healthz) is rewritten here by vercel.json.
 * The static website in /public is served by Vercel's CDN; this function is only the API.
 * The database is Turso (hosted libSQL): set TURSO_DATABASE_URL and TURSO_AUTH_TOKEN.
 */
const { open, optionsFromEnv } = require('../server/db');
const { createApp } = require('../server/app');
const { prepareDatabase } = require('../server/bootstrap');

let ready = null;

function init() {
  if (!ready) {
    ready = (async () => {
      const opts = optionsFromEnv(process.env, null);
      if (!opts.url) throw new Error('TURSO_DATABASE_URL is not set. Add the Turso database to this Vercel project.');
      const db = await open(opts);
      await prepareDatabase(db, process.env, m => console.log(m));
      return createApp(db).handler;
    })().catch(e => { ready = null; throw e; }); // try again on the next request instead of caching a failure
  }
  return ready;
}

module.exports = async (req, res) => {
  let handler;
  try {
    handler = await init();
  } catch (e) {
    console.error('startup failed:', e && e.message);
    res.statusCode = 503;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    res.end(JSON.stringify({ error: 'The server is not ready yet. Please try again in a moment.' }));
    return;
  }
  return handler(req, res);
};
