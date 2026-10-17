'use strict';
/* Admin command line: create-admin, reset-password, seed-demo
   Uses the local database file, or Turso when TURSO_DATABASE_URL / TURSO_AUTH_TOKEN are set. */
const crypto = require('node:crypto');
const config = require('./config');
const { open, optionsFromEnv } = require('./db');
const auth = require('./auth');
const repo = require('./resources');
const settingsStore = require('./settings');
const { now } = require('./util');

const [cmd, ...args] = process.argv.slice(2);

function randomPassword() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  let p = '';
  for (const b of crypto.randomBytes(16)) p += chars[b % chars.length];
  return p + '7';
}

async function main(db) {
  if (cmd === 'create-admin') {
    const [email, name] = args;
    if (!email || !name) throw new Error('Usage: create-admin <email> "<Full Name>"   (optionally set ADMIN_PASSWORD)');
    const password = process.env.ADMIN_PASSWORD || randomPassword();
    const problem = auth.passwordProblem(password, email);
    if (problem) throw new Error(problem);
    if (await db.get('SELECT 1 FROM users WHERE email = ?', [email])) throw new Error('A user with that email already exists.');
    await auth.createUser(db, { email, name, role: 'admin', password, mustChange: !process.env.ADMIN_PASSWORD });
    console.log(`Admin account created for ${email}.`);
    if (!process.env.ADMIN_PASSWORD) console.log(`Temporary password (shown once — you must change it at first sign-in):\n  ${password}`);
  } else if (cmd === 'reset-password') {
    const [email] = args;
    const u = await db.get('SELECT id FROM users WHERE email = ?', [email || '']);
    if (!u) throw new Error('No such user.');
    const password = randomPassword();
    await db.run('UPDATE users SET password_hash = ?, must_change_password = 1, failed_attempts = 0, locked_until = NULL, updated_at = ? WHERE id = ?', [await auth.hashPassword(password), now(), u.id]);
    await db.run('DELETE FROM auth_sessions WHERE user_id = ?', [u.id]);
    console.log(`New temporary password for ${email} (shown once):\n  ${password}`);
  } else if (cmd === 'seed-demo') {
    if (Number((await db.get('SELECT COUNT(*) AS n FROM volunteers')).n) && !args.includes('--force')) throw new Error('Database already has volunteers. Re-run with --force to add the demo data anyway.');
    await seedDemo(db);
    console.log('Demo dataset loaded (sample volunteers, teams, venues, shifts, assignments, announcements).');
  } else {
    console.log('Commands:\n  create-admin <email> "<Name>"\n  reset-password <email>\n  seed-demo [--force]');
    process.exitCode = cmd ? 1 : 0;
  }
}

async function seedDemo(db) {
  const seed = settingsStore.loadSeed();
  const pick = (name, rec) => {
    const out = {};
    for (const k of Object.keys(repo.RESOURCES[name].fields)) if (rec[k] !== undefined) out[k] = rec[k];
    return out;
  };
  await db.tx(async t => {
    await settingsStore.save(t, settingsStore.validateSettings(Object.assign({}, seed.settings, { visibility: Object.assign({ rosterNames: true }, seed.settings.visibility) })));
    for (const v of seed.venues) await repo.insert(t, 'venues', pick('venues', v), v.id);
    for (const x of seed.teams) await repo.insert(t, 'teams', pick('teams', x), x.id);
    for (const s of seed.shifts) await repo.insert(t, 'shifts', pick('shifts', Object.assign({}, s, { venueId: s.venueId || null })), s.id);
    for (const v of seed.volunteers) await repo.insert(t, 'volunteers', Object.assign(pick('volunteers', v), { seq: v.seq, registeredAt: v.registeredAt }), v.id);
    for (const a of seed.assignments) await repo.insert(t, 'assignments', pick('assignments', Object.assign({}, a, { venueId: a.venueId || null, shiftId: a.shiftId || null })), a.id);
    for (const s of seed.sessions) await repo.insert(t, 'sessions', pick('sessions', s), s.id);
    for (const a of seed.announcements) await repo.insert(t, 'announcements', Object.assign(pick('announcements', a), { teamId: a.teamId || null, publishedAt: a.publishedAt || '' }), a.id);
    for (const a of seed.attendance) await repo.insert(t, 'attendance', pick('attendance', a), a.id);
    for (const a of seed.activity) await t.run('INSERT INTO activity (at,type,text) VALUES (?,?,?)', [a.at, a.type, a.text]);
  });
}

(async () => {
  const db = await open(optionsFromEnv(process.env, config.dbFile));
  try { await main(db); } catch (e) { console.error('Error:', e.message); process.exitCode = 1; }
  await db.close();
})();
