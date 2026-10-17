'use strict';
/* Admin command line: create-admin, reset-password, seed-demo */
const crypto = require('node:crypto');
const config = require('./config');
const { open } = require('./db');
const auth = require('./auth');
const repo = require('./resources');
const settingsStore = require('./settings');
const { now } = require('./util');

const [cmd, ...args] = process.argv.slice(2);
const db = open(config.dbFile);

function randomPassword() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  let p = '';
  for (const b of crypto.randomBytes(16)) p += chars[b % chars.length];
  return p + '7';
}

async function main() {
  if (cmd === 'create-admin') {
    const [email, name] = args;
    if (!email || !name) throw new Error('Usage: create-admin <email> "<Full Name>"   (optionally set ADMIN_PASSWORD)');
    const password = process.env.ADMIN_PASSWORD || randomPassword();
    const problem = auth.passwordProblem(password, email);
    if (problem) throw new Error(problem);
    if (db.prepare('SELECT 1 FROM users WHERE email = ?').get(email)) throw new Error('A user with that email already exists.');
    await auth.createUser(db, { email, name, role: 'admin', password, mustChange: !process.env.ADMIN_PASSWORD });
    console.log(`Admin account created for ${email}.`);
    if (!process.env.ADMIN_PASSWORD) console.log(`Temporary password (shown once — you must change it at first sign-in):\n  ${password}`);
  } else if (cmd === 'reset-password') {
    const [email] = args;
    const u = db.prepare('SELECT id FROM users WHERE email = ?').get(email || '');
    if (!u) throw new Error('No such user.');
    const password = randomPassword();
    db.prepare('UPDATE users SET password_hash = ?, must_change_password = 1, failed_attempts = 0, locked_until = NULL, updated_at = ? WHERE id = ?').run(await auth.hashPassword(password), now(), u.id);
    db.prepare('DELETE FROM auth_sessions WHERE user_id = ?').run(u.id);
    console.log(`New temporary password for ${email} (shown once):\n  ${password}`);
  } else if (cmd === 'seed-demo') {
    if (db.prepare('SELECT COUNT(*) AS n FROM volunteers').get().n && !args.includes('--force')) throw new Error('Database already has volunteers. Re-run with --force to add the demo data anyway.');
    seedDemo();
    console.log('Demo dataset loaded (sample volunteers, teams, venues, shifts, assignments, announcements).');
  } else {
    console.log('Commands:\n  create-admin <email> "<Name>"\n  reset-password <email>\n  seed-demo [--force]');
    process.exitCode = cmd ? 1 : 0;
  }
}

function seedDemo() {
  const seed = settingsStore.loadSeed();
  const pick = (name, rec) => {
    const out = {};
    for (const k of Object.keys(repo.RESOURCES[name].fields)) if (rec[k] !== undefined) out[k] = rec[k];
    return out;
  };
  db.exec('BEGIN');
  try {
    settingsStore.save(db, settingsStore.validateSettings(Object.assign({}, seed.settings, { visibility: Object.assign({ rosterNames: true }, seed.settings.visibility) })));
    seed.venues.forEach(v => repo.insert(db, 'venues', pick('venues', v), v.id));
    seed.teams.forEach(t => repo.insert(db, 'teams', pick('teams', t), t.id));
    seed.shifts.forEach(s => repo.insert(db, 'shifts', pick('shifts', Object.assign({}, s, { venueId: s.venueId || null })), s.id));
    seed.volunteers.forEach(v => repo.insert(db, 'volunteers', Object.assign(pick('volunteers', v), { seq: v.seq, registeredAt: v.registeredAt }), v.id));
    seed.assignments.forEach(a => repo.insert(db, 'assignments', pick('assignments', Object.assign({}, a, { venueId: a.venueId || null, shiftId: a.shiftId || null })), a.id));
    seed.sessions.forEach(s => repo.insert(db, 'sessions', pick('sessions', s), s.id));
    seed.announcements.forEach(a => repo.insert(db, 'announcements', Object.assign(pick('announcements', a), { teamId: a.teamId || null, publishedAt: a.publishedAt || '' }), a.id));
    seed.attendance.forEach(a => repo.insert(db, 'attendance', pick('attendance', a), a.id));
    seed.activity.forEach(a => db.prepare('INSERT INTO activity (at,type,text) VALUES (?,?,?)').run(a.at, a.type, a.text));
    db.exec('COMMIT');
  } catch (e) { db.exec('ROLLBACK'); throw e; }
}

main().then(() => db.close()).catch(e => { console.error('Error:', e.message); db.close(); process.exit(1); });
