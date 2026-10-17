'use strict';
const crypto = require('node:crypto');

class AppError extends Error {
  constructor(status, message, extra) {
    super(message);
    this.status = status;
    this.extra = extra || {};
  }
}

const now = () => new Date().toISOString();
const uid = prefix => `${prefix}_${crypto.randomBytes(9).toString('base64url')}`;
const sha256 = s => crypto.createHash('sha256').update(s).digest('hex');

/**
 * Sliding-window rate limiter stored in the database, so every server instance
 * (including short-lived serverless copies) shares the same counters.
 */
function createLimiter(db) {
  const DAY = 86400e3;
  const count = async (key, since) => Number((await db.get('SELECT COUNT(*) AS n FROM rate_hits WHERE key = ? AND at > ?', [key, since])).n);
  const add = (key, t) => db.run('INSERT INTO rate_hits (key, at) VALUES (?, ?)', [key, t]);
  const tidy = async t => { if (Math.random() < 0.02) await db.run('DELETE FROM rate_hits WHERE at < ?', [t - DAY]); };
  return {
    /** Records a hit and returns true when allowed, false when the limit is reached. */
    async take(key, max, windowMs) {
      const t = Date.now();
      if (await count(key, t - windowMs) >= max) return false;
      await add(key, t);
      await tidy(t);
      return true;
    },
    /** true when `key` already has `max` hits inside the window (does not add a hit) */
    async blocked(key, max, windowMs) { return await count(key, Date.now() - windowMs) >= max; },
    /** record one hit (e.g. a failed attempt) */
    async record(key) { const t = Date.now(); await add(key, t); await tidy(t); },
    async clear(key) { await db.run('DELETE FROM rate_hits WHERE key = ?', [key]); },
    /** whole minutes (>=1) until the oldest hit leaves the window */
    async retryMinutes(key, windowMs) {
      const r = await db.get('SELECT MIN(at) AS a FROM rate_hits WHERE key = ? AND at > ?', [key, Date.now() - windowMs]);
      return r && r.a ? Math.max(1, Math.ceil((Number(r.a) + windowMs - Date.now()) / 60000)) : 1;
    },
    async reset() { await db.run('DELETE FROM rate_hits'); }
  };
}

module.exports = { AppError, now, uid, sha256, createLimiter };
