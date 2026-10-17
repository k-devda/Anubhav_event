'use strict';
const auth = require('./auth');
const repo = require('./resources');
const settingsStore = require('./settings');

/**
 * Hosting platforms often give no terminal. When no active admin exists and ADMIN_EMAIL +
 * ADMIN_PASSWORD are set, create the first admin (forced to change the password at first
 * sign-in). Does nothing once an admin exists, so it is safe to leave the variables set.
 */
async function ensureFirstAdmin(db, env, log) {
  const have = Number((await db.get("SELECT COUNT(*) AS n FROM users WHERE role = 'admin' AND active = 1")).n) > 0;
  if (have) return 'exists';
  const email = String(env.ADMIN_EMAIL || '').trim().toLowerCase();
  const password = env.ADMIN_PASSWORD || '';
  if (!email || !password) return 'none';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) { log('ADMIN_EMAIL is not a valid email; skipping first-admin setup.'); return 'invalid'; }
  const problem = auth.passwordProblem(password, email);
  if (problem) { log(`ADMIN_PASSWORD rejected: ${problem}`); return 'invalid'; }
  if (await db.get('SELECT 1 FROM users WHERE email = ?', [email])) { log('ADMIN_EMAIL already belongs to a non-admin user; skipping.'); return 'invalid'; }
  try {
    await auth.createUser(db, { email, name: String(env.ADMIN_NAME || 'Administrator').slice(0, 100), role: 'admin', password, mustChange: true });
  } catch (e) {
    // another server instance created it at the same moment
    if (await db.get('SELECT 1 FROM users WHERE email = ?', [email])) return 'exists';
    throw e;
  }
  log(`First admin created for ${email}. Sign in and choose a new password.`);
  return 'created';
}

/** Fresh database only: add the event venue so teams/shifts can be created straight away. */
async function seedEventBasics(db) {
  if (Number((await db.get('SELECT COUNT(*) AS n FROM venues')).n)) return false;
  await repo.insert(db, 'venues', { name: 'SLS Building', code: 'SLS', area: '', floor: '', description: 'Main venue for Anubhav (Event Day 1 and Event Day 2).', mapLink: '', coordinator: '', capacity: null, setup: '', status: 'Active' });
  return true;
}

/** Everything a server instance does once at start-up, before handling requests. */
async function prepareDatabase(db, env, log) {
  const isNewDatabase = !(await db.get("SELECT 1 FROM settings WHERE key = 'main'"));
  await settingsStore.get(db); // make sure default settings exist
  if (isNewDatabase) {
    try { if (await seedEventBasics(db)) log('New database: added the SLS Building venue and the two event days.'); }
    catch (e) { if (!/UNIQUE/i.test(String(e && e.message))) throw e; } // another instance seeded it
  }
  const admin = await ensureFirstAdmin(db, env, log);
  return { isNewDatabase, admin };
}

module.exports = { ensureFirstAdmin, seedEventBasics, prepareDatabase };
