'use strict';
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const isProd = process.env.NODE_ENV === 'production';

module.exports = {
  root,
  isProd,
  port: Number(process.env.PORT) || 3000,
  host: process.env.HOST || (isProd ? '0.0.0.0' : '127.0.0.1'),
  dbFile: process.env.DB_FILE || path.join(root, 'data', 'anubhav.sqlite'),
  publicDir: path.join(root, 'public'),
  // Set COOKIE_SECURE=1 when the site is served over HTTPS (always in production behind a TLS proxy)
  cookieSecure: process.env.COOKIE_SECURE ? process.env.COOKIE_SECURE === '1' : isProd,
  // Trust X-Forwarded-For only when explicitly running behind your own reverse proxy
  trustProxy: process.env.TRUST_PROXY === '1',
  sessionIdleHours: 12,
  sessionAbsoluteDays: 7,
  rememberDays: 30,
  loginMaxFailures: 5,
  loginLockMinutes: 15,
  maxBodyBytes: 1024 * 1024,
  // Secret used to sign nothing sensitive today; reserved for Phase 3 features (e.g. QR attendance)
  appSecret: process.env.APP_SECRET || ''
};
