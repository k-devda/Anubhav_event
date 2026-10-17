'use strict';
const crypto = require('node:crypto');
const { promisify } = require('node:util');
const config = require('./config');
const { AppError, now, uid, sha256 } = require('./util');

const scrypt = promisify(crypto.scrypt);
const COOKIE = 'anubhav_sid';
const SCRYPT = { N: 16384, r: 8, p: 1, keylen: 64 };

/* ---------------- Permissions ---------------- */
// Every role can read operational data; writes are limited by role.
const ROLE_PERMS = {
  admin: new Set(['read', 'write', 'delete', 'settings', 'users']),
  coordinator: new Set(['read', 'write']),
  viewer: new Set(['read'])
};
const can = (user, perm) => !!user && ROLE_PERMS[user.role] && ROLE_PERMS[user.role].has(perm);
function require_(user, perm) {
  if (!user) throw new AppError(401, 'Please sign in.');
  if (!can(user, perm)) throw new AppError(403, 'You do not have permission to do that.');
}

/* ---------------- Passwords ---------------- */
async function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const hash = await scrypt(password, salt, SCRYPT.keylen, { N: SCRYPT.N, r: SCRYPT.r, p: SCRYPT.p });
  return `scrypt$${SCRYPT.N}$${SCRYPT.r}$${SCRYPT.p}$${salt.toString('base64')}$${hash.toString('base64')}`;
}
async function verifyPassword(password, stored) {
  const [alg, N, r, p, saltB64, hashB64] = String(stored).split('$');
  if (alg !== 'scrypt') return false;
  const expected = Buffer.from(hashB64, 'base64');
  const actual = await scrypt(password, Buffer.from(saltB64, 'base64'), expected.length, { N: +N, r: +r, p: +p });
  return crypto.timingSafeEqual(actual, expected);
}
// Used so unknown e-mail addresses cost the same time as a wrong password.
let dummyHash;
async function dummyVerify(password) {
  dummyHash = dummyHash || await hashPassword('not-a-real-password');
  await verifyPassword(password, dummyHash);
}
function passwordProblem(password, email) {
  if (typeof password !== 'string' || password.length < 10) return 'Password must be at least 10 characters.';
  if (password.length > 200) return 'Password is too long.';
  if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) return 'Password must contain letters and at least one number.';
  if (email && password.toLowerCase().includes(String(email).split('@')[0].toLowerCase()) && String(email).split('@')[0].length > 3) return 'Password must not contain your e-mail name.';
  return '';
}

/* ---------------- Sessions ---------------- */
function parseCookies(header) {
  const out = {};
  String(header || '').split(';').forEach(part => {
    const i = part.indexOf('=');
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  });
  return out;
}

function createSession(db, userId, { remember, ip, userAgent }) {
  const token = crypto.randomBytes(32).toString('base64url');
  const t = Date.now();
  const idle = t + config.sessionIdleHours * 3600e3;
  const absolute = t + (remember ? config.rememberDays : config.sessionAbsoluteDays) * 86400e3;
  db.prepare('INSERT INTO auth_sessions (token_hash,user_id,created_at,expires_at,absolute_expires_at,ip,user_agent) VALUES (?,?,?,?,?,?,?)')
    .run(sha256(token), userId, now(), new Date(Math.min(remember ? absolute : idle, absolute)).toISOString(), new Date(absolute).toISOString(), ip || '', String(userAgent || '').slice(0, 200));
  return { token, maxAge: remember ? config.rememberDays * 86400 : 0 };
}

function cookieHeader(token, maxAgeSec) {
  const parts = [`${COOKIE}=${encodeURIComponent(token)}`, 'Path=/', 'HttpOnly', 'SameSite=Strict'];
  if (config.cookieSecure) parts.push('Secure');
  if (maxAgeSec) parts.push(`Max-Age=${maxAgeSec}`);
  return parts.join('; ');
}
const clearCookieHeader = () => `${COOKIE}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${config.cookieSecure ? '; Secure' : ''}`;

/** Resolve the signed-in user from the request cookie (sliding idle expiry). */
function userFromRequest(db, req) {
  const token = parseCookies(req.headers.cookie)[COOKIE];
  if (!token || token.length > 100) return null;
  const hash = sha256(token);
  const row = db.prepare(`SELECT s.expires_at, s.absolute_expires_at, u.id, u.email, u.name, u.role, u.active, u.must_change_password
    FROM auth_sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ?`).get(hash);
  if (!row) return null;
  const t = Date.now();
  if (!row.active || Date.parse(row.expires_at) < t || Date.parse(row.absolute_expires_at) < t) {
    db.prepare('DELETE FROM auth_sessions WHERE token_hash = ?').run(hash);
    return null;
  }
  // slide idle window at most once a minute to avoid a write per request
  const newExpiry = Math.min(t + config.sessionIdleHours * 3600e3, Date.parse(row.absolute_expires_at));
  if (newExpiry - Date.parse(row.expires_at) > 60e3) db.prepare('UPDATE auth_sessions SET expires_at = ? WHERE token_hash = ?').run(new Date(newExpiry).toISOString(), hash);
  return { id: row.id, email: row.email, name: row.name, role: row.role, mustChangePassword: !!row.must_change_password, tokenHash: hash };
}

function destroySession(db, req) {
  const token = parseCookies(req.headers.cookie)[COOKIE];
  if (token) db.prepare('DELETE FROM auth_sessions WHERE token_hash = ?').run(sha256(token));
}

const publicUser = u => ({ id: u.id, email: u.email, name: u.name, role: u.role, mustChangePassword: !!u.mustChangePassword });

async function createUser(db, { email, name, role, password, mustChange }) {
  const id = uid('usr');
  db.prepare('INSERT INTO users (id,email,name,role,password_hash,active,must_change_password,created_at,updated_at) VALUES (?,?,?,?,?,1,?,?,?)')
    .run(id, email.toLowerCase(), name, role, await hashPassword(password), mustChange ? 1 : 0, now(), now());
  return id;
}

module.exports = { COOKIE, can, require_, hashPassword, verifyPassword, dummyVerify, passwordProblem, parseCookies, createSession, cookieHeader, clearCookieHeader, userFromRequest, destroySession, publicUser, createUser };
