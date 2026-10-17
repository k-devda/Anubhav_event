'use strict';
const http = require('node:http');
const config = require('./config');
const { open } = require('./db');
const { createApp } = require('./app');
const settingsStore = require('./settings');
const { ensureFirstAdmin, seedEventBasics } = require('./bootstrap');

const db = open(config.dbFile);
const isNewDatabase = !db.prepare("SELECT 1 FROM settings WHERE key = 'main'").get();
settingsStore.get(db); // make sure default settings exist
if (isNewDatabase && seedEventBasics(db)) console.log('New database: added the SLS Building venue and the two event days.');

const { handler } = createApp(db);
let hasAdmin = db.prepare("SELECT COUNT(*) AS n FROM users WHERE role = 'admin' AND active = 1").get().n > 0;
const server = http.createServer(handler);
server.headersTimeout = 15000;
server.requestTimeout = 30000;

// housekeeping: drop expired sessions every hour
setInterval(() => {
  db.prepare('DELETE FROM auth_sessions WHERE expires_at < ? OR absolute_expires_at < ?').run(new Date().toISOString(), new Date().toISOString());
}, 3600e3).unref();

ensureFirstAdmin(db, process.env, m => console.log(m)).then(r => { if (r === 'created') hasAdmin = true; }).catch(e => console.error('first-admin setup failed:', e.message)).finally(() => server.listen(config.port, config.host, () => {
  console.log(`Anubhav is running at http://${config.host === '0.0.0.0' ? 'localhost' : config.host}:${config.port}`);
  console.log(`Database: ${config.dbFile}`);
  if (!hasAdmin) {
    console.log('\nNo admin account exists yet. Create one with:\n  npm run create-admin -- you@example.com "Your Name"\n');
  }
  if (config.isProd && !config.cookieSecure) console.warn('WARNING: production without COOKIE_SECURE=1 — serve over HTTPS and set COOKIE_SECURE=1.');
}));

for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => { server.close(() => { db.close(); process.exit(0); }); });
