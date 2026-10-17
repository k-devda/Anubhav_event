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

/** Sliding-window in-memory rate limiter (single process). */
function createLimiter() {
  const hits = new Map();
  return {
    /** returns true if allowed */
    take(key, max, windowMs) {
      const t = Date.now();
      const arr = (hits.get(key) || []).filter(x => t - x < windowMs);
      if (arr.length >= max) { hits.set(key, arr); return false; }
      arr.push(t); hits.set(key, arr);
      if (hits.size > 5000) for (const [k, v] of hits) if (!v.length || t - v[v.length - 1] > windowMs) hits.delete(k);
      return true;
    },
    /** true when `key` already has `max` hits inside the window (does not add a hit) */
    blocked(key, max, windowMs) {
      const t = Date.now();
      return (hits.get(key) || []).filter(x => t - x < windowMs).length >= max;
    },
    /** record one hit (e.g. a failed attempt) */
    record(key, windowMs) {
      const t = Date.now();
      const arr = (hits.get(key) || []).filter(x => t - x < windowMs);
      arr.push(t); hits.set(key, arr);
    },
    clear(key) { hits.delete(key); },
    /** whole minutes (>=1) until the oldest hit leaves the window */
    retryMinutes(key, windowMs) {
      const arr = hits.get(key) || [];
      return arr.length ? Math.max(1, Math.ceil((arr[0] + windowMs - Date.now()) / 60000)) : 1;
    },
    reset() { hits.clear(); }
  };
}

const rowToJson = (row, jsonCols) => {
  const out = {};
  for (const [k, v] of Object.entries(row)) {
    const key = k.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
    out[key] = jsonCols.includes(k) ? JSON.parse(v) : v;
  }
  return out;
};

module.exports = { AppError, now, uid, sha256, createLimiter, rowToJson };
