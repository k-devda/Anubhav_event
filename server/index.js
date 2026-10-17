'use strict';
const http = require('node:http');
const config = require('./config');
const { open, optionsFromEnv } = require('./db');
const { createApp } = require('./app');
const { prepareDatabase } = require('./bootstrap');

async function main() {
  const dbOptions = optionsFromEnv(process.env, config.dbFile);
  const db = await open(dbOptions);
  const { isNewDatabase, admin } = await prepareDatabase(db, process.env, m => console.log(m));
  const { handler } = createApp(db);
  const hasAdmin = admin === 'exists' || admin === 'created' || !!(await db.get("SELECT 1 FROM users WHERE role = 'admin' AND active = 1"));

  const server = http.createServer(handler);
  server.headersTimeout = 15000;
  server.requestTimeout = 30000;

  // housekeeping: drop expired sessions every hour
  setInterval(() => {
    const t = new Date().toISOString();
    db.run('DELETE FROM auth_sessions WHERE expires_at < ? OR absolute_expires_at < ?', [t, t]).catch(() => {});
  }, 3600e3).unref();

  server.listen(config.port, config.host, () => {
    console.log(`Anubhav is running at http://${config.host === '0.0.0.0' ? 'localhost' : config.host}:${config.port}`);
    console.log(`Database: ${dbOptions.url ? dbOptions.url : dbOptions.file}`);
    if (isNewDatabase) console.log('(new database)');
    if (!hasAdmin) console.log('\nNo admin account exists yet. Create one with:\n  npm run create-admin -- you@example.com "Your Name"\n');
    if (config.isProd && !config.cookieSecure) console.warn('WARNING: production without COOKIE_SECURE=1 — serve over HTTPS and set COOKIE_SECURE=1.');
  });

  for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => { server.close(async () => { await db.close(); process.exit(0); }); });
}

main().catch(e => { console.error('Failed to start:', e); process.exit(1); });
