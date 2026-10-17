'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');

const MIGRATIONS = [
  /* v1 — initial schema */
  `
  CREATE TABLE settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE users (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL UNIQUE COLLATE NOCASE,
    name TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('admin','coordinator','viewer')),
    password_hash TEXT NOT NULL,
    active INTEGER NOT NULL DEFAULT 1,
    must_change_password INTEGER NOT NULL DEFAULT 0,
    failed_attempts INTEGER NOT NULL DEFAULT 0,
    locked_until TEXT,
    last_login_at TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE auth_sessions (
    token_hash TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    absolute_expires_at TEXT NOT NULL,
    ip TEXT,
    user_agent TEXT
  );
  CREATE INDEX idx_auth_sessions_user ON auth_sessions(user_id);

  CREATE TABLE volunteers (
    id TEXT PRIMARY KEY,
    seq INTEGER NOT NULL UNIQUE,
    name TEXT NOT NULL,
    mobile TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE COLLATE NOCASE,
    institution TEXT NOT NULL DEFAULT '',
    course TEXT NOT NULL DEFAULT '',
    year TEXT NOT NULL DEFAULT '',
    skills TEXT NOT NULL DEFAULT '[]',
    areas TEXT NOT NULL DEFAULT '[]',
    availability TEXT NOT NULL DEFAULT '[]',
    experience TEXT NOT NULL DEFAULT '',
    notes TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending','Approved','Rejected')),
    registered_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE INDEX idx_volunteers_status ON volunteers(status);

  CREATE TABLE venues (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    code TEXT NOT NULL UNIQUE COLLATE NOCASE,
    area TEXT NOT NULL DEFAULT '',
    floor TEXT NOT NULL DEFAULT '',
    description TEXT NOT NULL DEFAULT '',
    map_link TEXT NOT NULL DEFAULT '',
    coordinator TEXT NOT NULL DEFAULT '',
    capacity INTEGER,
    setup TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'Active' CHECK (status IN ('Active','Inactive','Archived')),
    updated_at TEXT NOT NULL
  );

  CREATE TABLE teams (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    leader TEXT NOT NULL DEFAULT '',
    assistant TEXT NOT NULL DEFAULT '',
    responsibilities TEXT NOT NULL DEFAULT '[]',
    roles TEXT NOT NULL DEFAULT '[]',
    venue_id TEXT REFERENCES venues(id) ON DELETE SET NULL,
    instructions TEXT NOT NULL DEFAULT '',
    archived INTEGER NOT NULL DEFAULT 0,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE shifts (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    day TEXT NOT NULL,
    team_id TEXT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    venue_id TEXT REFERENCES venues(id) ON DELETE SET NULL,
    report_time TEXT NOT NULL DEFAULT '',
    setup_time TEXT NOT NULL DEFAULT '',
    start_time TEXT NOT NULL,
    end_time TEXT NOT NULL,
    positions INTEGER NOT NULL DEFAULT 0,
    coordinator TEXT NOT NULL DEFAULT '',
    responsibilities TEXT NOT NULL DEFAULT '',
    instructions TEXT NOT NULL DEFAULT '',
    updated_at TEXT NOT NULL
  );
  CREATE INDEX idx_shifts_team ON shifts(team_id);

  CREATE TABLE assignments (
    id TEXT PRIMARY KEY,
    volunteer_id TEXT NOT NULL REFERENCES volunteers(id) ON DELETE CASCADE,
    team_id TEXT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    role TEXT NOT NULL,
    venue_id TEXT REFERENCES venues(id) ON DELETE SET NULL,
    day TEXT NOT NULL,
    report_time TEXT NOT NULL DEFAULT '',
    start_time TEXT NOT NULL DEFAULT '',
    end_time TEXT NOT NULL DEFAULT '',
    shift_id TEXT REFERENCES shifts(id) ON DELETE SET NULL,
    leader TEXT NOT NULL DEFAULT '',
    responsibilities TEXT NOT NULL DEFAULT '',
    instructions TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'Active' CHECK (status IN ('Active','Draft','Cancelled')),
    updated_at TEXT NOT NULL
  );
  CREATE INDEX idx_assignments_volunteer ON assignments(volunteer_id);
  CREATE INDEX idx_assignments_team ON assignments(team_id);
  CREATE INDEX idx_assignments_shift ON assignments(shift_id);

  CREATE TABLE event_sessions (
    id TEXT PRIMARY KEY,
    day TEXT NOT NULL,
    name TEXT NOT NULL,
    start_time TEXT NOT NULL,
    end_time TEXT NOT NULL,
    venue_id TEXT REFERENCES venues(id) ON DELETE SET NULL,
    team_id TEXT REFERENCES teams(id) ON DELETE SET NULL,
    coordinator TEXT NOT NULL DEFAULT '',
    instructions TEXT NOT NULL DEFAULT '',
    updated_at TEXT NOT NULL
  );

  CREATE TABLE announcements (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    audience TEXT NOT NULL DEFAULT 'All volunteers' CHECK (audience IN ('All volunteers','Specific team')),
    team_id TEXT REFERENCES teams(id) ON DELETE SET NULL,
    priority TEXT NOT NULL DEFAULT 'Normal' CHECK (priority IN ('High','Normal','Low')),
    status TEXT NOT NULL DEFAULT 'Draft' CHECK (status IN ('Draft','Published','Archived')),
    published_at TEXT NOT NULL DEFAULT '',
    expiry TEXT NOT NULL DEFAULT '',
    updated_at TEXT NOT NULL
  );

  CREATE TABLE attendance (
    id TEXT PRIMARY KEY REFERENCES assignments(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'Not Marked' CHECK (status IN ('Not Marked','Present','Absent','Late','Excused')),
    check_in TEXT NOT NULL DEFAULT '',
    notes TEXT NOT NULL DEFAULT '',
    updated_by TEXT,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE activity (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    at TEXT NOT NULL,
    user_id TEXT,
    user_name TEXT,
    type TEXT NOT NULL,
    text TEXT NOT NULL
  );
  `
];

function open(file) {
  if (file !== ':memory:') fs.mkdirSync(path.dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;');
  migrate(db);
  return db;
}

function migrate(db) {
  const current = db.prepare('PRAGMA user_version').get().user_version;
  for (let v = current; v < MIGRATIONS.length; v++) {
    db.exec('BEGIN');
    try {
      db.exec(MIGRATIONS[v]);
      db.exec(`PRAGMA user_version = ${v + 1}`);
      db.exec('COMMIT');
    } catch (e) {
      db.exec('ROLLBACK');
      throw e;
    }
  }
}

/** Run fn inside a transaction; rolls back on throw. */
function tx(db, fn) {
  db.exec('BEGIN IMMEDIATE');
  try {
    const out = fn();
    db.exec('COMMIT');
    return out;
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
}

module.exports = { open, tx };
