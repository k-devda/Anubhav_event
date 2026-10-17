'use strict';
const http = require('node:http');
const config = require('./config');
const { open } = require('./db');
const { createApp } = require('./app');
const settingsStore = require('./settings');

const db = open(config.dbFile);
settingsStore.get(db); // make sure default settings exist

const hasAdmin = db.prepare("SELECT COUNT(*) AS n FROM users WHERE role = 'admin' AND active = 1").get().n > 0;
const { handler } = createApp(db);
const server = http.createServer(handler);
server.headersTimeout = 15000;
server.requestTimeout = 30000;

// housekeeping: drop expired sessions every hour
setInterval(() => {
  db.prepare('DELETE FROM auth_sessions WHERE expires_at < ? OR absolute_expires_at < ?').run(new Date().toISOString(), new Date().toISOString());
}, 3600e3).unref();

server.listen(config.port, config.host, () => {
  console.log(`Anubhav is running at http://${config.host === '0.0.0.0' ? 'localhost' : config.host}:${config.port}`);
  console.log(`Database: ${config.dbFile}`);
  if (!hasAdmin) {
    console.log('\nNo admin account exists yet. Create one with:\n  npm run create-admin -- you@example.com "Your Name"\n');
  }
  if (config.isProd && !config.cookieSecure) console.warn('WARNING: production without COOKIE_SECURE=1 — serve over HTTPS and set COOKIE_SECURE=1.');
});

for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => { server.close(() => { db.close(); process.exit(0); }); });
