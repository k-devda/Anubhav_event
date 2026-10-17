'use strict';
const auth = require('./auth');

/**
 * Hosting platforms often give no terminal. When no active admin exists and ADMIN_EMAIL +
 * ADMIN_PASSWORD are set, create the first admin (forced to change the password at first
 * sign-in). Does nothing once an admin exists, so it is safe to leave the variables set.
 */
async function ensureFirstAdmin(db, env, log) {
  const have = db.prepare("SELECT COUNT(*) AS n FROM users WHERE role = 'admin' AND active = 1").get().n > 0;
  if (have) return 'exists';
  const email = String(env.ADMIN_EMAIL || '').trim().toLowerCase();
  const password = env.ADMIN_PASSWORD || '';
  if (!email || !password) return 'none';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) { log('ADMIN_EMAIL is not a valid email; skipping first-admin setup.'); return 'invalid'; }
  const problem = auth.passwordProblem(password, email);
  if (problem) { log(`ADMIN_PASSWORD rejected: ${problem}`); return 'invalid'; }
  if (db.prepare('SELECT 1 FROM users WHERE email = ?').get(email)) { log('ADMIN_EMAIL already belongs to a non-admin user; skipping.'); return 'invalid'; }
  await auth.createUser(db, { email, name: String(env.ADMIN_NAME || 'Administrator').slice(0, 100), role: 'admin', password, mustChange: true });
  log(`First admin created for ${email}. Sign in and choose a new password.`);
  return 'created';
}

/** Fresh database only: add the event venue so teams/shifts can be created straight away. */
function seedEventBasics(db) {
  const repo = require('./resources');
  if (db.prepare('SELECT COUNT(*) AS n FROM venues').get().n) return false;
  repo.insert(db, 'venues', { name: 'SLS Building', code: 'SLS', area: '', floor: '', description: 'Main venue for Anubhav (Event Day 1 and Event Day 2).', mapLink: '', coordinator: '', capacity: null, setup: '', status: 'Active' });
  return true;
}

module.exports = { ensureFirstAdmin, seedEventBasics };
