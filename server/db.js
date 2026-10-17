'use strict';
/**
 * Database access with one small async API and two interchangeable backends:
 *   - local SQLite file via Node's built-in node:sqlite (default; used for local runs and tests)
 *   - hosted Turso / libSQL over HTTP (used on Vercel; set TURSO_DATABASE_URL + TURSO_AUTH_TOKEN)
 *
 *   await db.get(sql, args)   -> first row object or null
 *   await db.all(sql, args)   -> array of row objects
 *   await db.run(sql, args)   -> { changes }
 *   await db.exec(script)     -> runs one or more statements
 *   await db.tx(async t => {}) -> runs inside a write transaction (t has the same API)
 */
const fs = require('node:fs');
const path = require('node:path');

const MIGRATIONS = [
  /* v1 — initial schema */
  `
  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS users (
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

  CREATE TABLE IF NOT EXISTS auth_sessions (
    token_hash TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    absolute_expires_at TEXT NOT NULL,
    ip TEXT,
    user_agent TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_auth_sessions_user ON auth_sessions(user_id);

  CREATE TABLE IF NOT EXISTS volunteers (
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
  CREATE INDEX IF NOT EXISTS idx_volunteers_status ON volunteers(status);

  CREATE TABLE IF NOT EXISTS venues (
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

  CREATE TABLE IF NOT EXISTS teams (
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

  CREATE TABLE IF NOT EXISTS shifts (
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
  CREATE INDEX IF NOT EXISTS idx_shifts_team ON shifts(team_id);

  CREATE TABLE IF NOT EXISTS assignments (
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
  CREATE INDEX IF NOT EXISTS idx_assignments_volunteer ON assignments(volunteer_id);
  CREATE INDEX IF NOT EXISTS idx_assignments_team ON assignments(team_id);
  CREATE INDEX IF NOT EXISTS idx_assignments_shift ON assignments(shift_id);

  CREATE TABLE IF NOT EXISTS event_sessions (
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

  CREATE TABLE IF NOT EXISTS announcements (
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

  CREATE TABLE IF NOT EXISTS attendance (
    id TEXT PRIMARY KEY REFERENCES assignments(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'Not Marked' CHECK (status IN ('Not Marked','Present','Absent','Late','Excused')),
    check_in TEXT NOT NULL DEFAULT '',
    notes TEXT NOT NULL DEFAULT '',
    updated_by TEXT,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS activity (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    at TEXT NOT NULL,
    user_id TEXT,
    user_name TEXT,
    type TEXT NOT NULL,
    text TEXT NOT NULL
  );
  `,
  /* v2 — rate limits shared by every server instance (serverless-safe) */
  `
  CREATE TABLE IF NOT EXISTS rate_hits (
    key TEXT NOT NULL,
    at INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_rate_hits_key ON rate_hits(key, at);
  `
];

// node:sqlite and libSQL both reject `undefined`; booleans are stored as 0/1.
const clean = args => (args || []).map(v => (v === undefined ? null : typeof v === 'boolean' ? (v ? 1 : 0) : v));
const plain = row => (row ? Object.assign({}, row) : null);

/* ---------------- local SQLite file (node:sqlite) ---------------- */
function sqliteBackend(file) {
  const { DatabaseSync } = require('node:sqlite');
  if (file !== ':memory:') fs.mkdirSync(path.dirname(file), { recursive: true });
  const raw = new DatabaseSync(file);
  raw.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;');
  const api = {
    async get(sql, args) { return plain(raw.prepare(sql).get(...clean(args))); },
    async all(sql, args) { return raw.prepare(sql).all(...clean(args)).map(plain); },
    async run(sql, args) { const r = raw.prepare(sql).run(...clean(args)); return { changes: Number(r.changes) }; },
    async exec(sql) { raw.exec(sql); }
  };
  // One connection: run transactions one at a time so their statements never interleave.
  let queue = Promise.resolve();
  function tx(fn) {
    const run = queue.then(async () => {
      raw.exec('BEGIN IMMEDIATE');
      try {
        const out = await fn(api);
        raw.exec('COMMIT');
        return out;
      } catch (e) {
        try { raw.exec('ROLLBACK'); } catch (_) { /* already rolled back */ }
        throw e;
      }
    });
    queue = run.catch(() => {});
    return run;
  }
  return Object.assign({ kind: 'sqlite', tx, close: async () => raw.close() }, api);
}

/* ---------------- hosted Turso / libSQL ---------------- */
function libsqlBackend(url, authToken) {
  // The /web client is pure JavaScript over HTTP (what Vercel recommends); file: URLs need the native client.
  const { createClient } = url.startsWith('file:') ? require('@libsql/client') : require('@libsql/client/web');
  const client = createClient({ url, authToken: authToken || undefined });
  const rowsOf = rs => rs.rows.map(r => {
    const o = {};
    rs.columns.forEach((c, i) => { o[c] = typeof r[i] === 'bigint' ? Number(r[i]) : r[i]; });
    return o;
  });
  const make = execute => ({
    async get(sql, args) { return rowsOf(await execute({ sql, args: clean(args) }))[0] || null; },
    async all(sql, args) { return rowsOf(await execute({ sql, args: clean(args) })); },
    async run(sql, args) { const rs = await execute({ sql, args: clean(args) }); return { changes: Number(rs.rowsAffected) }; }
  });
  const api = Object.assign(make(s => client.execute(s)), { exec: sql => client.executeMultiple(sql) });
  async function tx(fn) {
    const t = await client.transaction('write');
    try {
      const out = await fn(Object.assign(make(s => t.execute(s)), { exec: sql => t.executeMultiple(sql) }));
      await t.commit();
      return out;
    } catch (e) {
      try { await t.rollback(); } catch (_) { /* connection already closed */ }
      throw e;
    } finally {
      t.close();
    }
  }
  return Object.assign({ kind: 'libsql', tx, close: async () => client.close() }, api);
}

async function migrate(db) {
  await db.exec('CREATE TABLE IF NOT EXISTS schema_meta (id INTEGER PRIMARY KEY CHECK (id = 1), version INTEGER NOT NULL)');
  if (!(await db.get('SELECT version FROM schema_meta WHERE id = 1'))) {
    // Databases created before schema_meta existed recorded their version in PRAGMA user_version.
    let legacy = 0;
    try { legacy = Number((await db.get('PRAGMA user_version') || {}).user_version) || 0; } catch (_) { /* not supported */ }
    await db.run('INSERT OR IGNORE INTO schema_meta (id, version) VALUES (1, ?)', [legacy]);
  }
  for (let v = 0; v < MIGRATIONS.length; v++) {
    await db.tx(async t => {
      const current = Number((await t.get('SELECT version FROM schema_meta WHERE id = 1')).version);
      if (current > v) return; // already applied (possibly by another instance)
      await t.exec(MIGRATIONS[v]);
      await t.run('UPDATE schema_meta SET version = ? WHERE id = 1', [v + 1]);
    });
  }
}

/**
 * Open the database.
 *   open({ url, authToken })  -> Turso / libSQL (url like libsql://... or file:...)
 *   open({ file })            -> local SQLite file (or ':memory:')
 */
async function open(opts) {
  const db = opts.url ? libsqlBackend(opts.url, opts.authToken) : sqliteBackend(opts.file);
  await migrate(db);
  return db;
}

/** Which database to use, from environment variables. */
function optionsFromEnv(env, defaultFile) {
  const url = env.TURSO_DATABASE_URL || env.LIBSQL_URL || '';
  if (url) return { url, authToken: env.TURSO_AUTH_TOKEN || env.LIBSQL_AUTH_TOKEN || '' };
  return { file: env.DB_FILE || defaultFile };
}

/** Run fn inside a write transaction; rolls back on throw. */
const tx = (db, fn) => db.tx(fn);

module.exports = { open, optionsFromEnv, tx, MIGRATIONS };
