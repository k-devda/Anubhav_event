'use strict';
/**
 * Resource definitions: one place that describes every stored entity,
 * how it is validated, and how it maps to its SQLite table.
 */
const { now, uid } = require('./util');

const str = (max, extra) => Object.assign({ type: 'string', max }, extra);
const ID = (extra) => Object.assign({ type: 'id', nullable: true }, extra);

const RESOURCES = {
  volunteers: {
    table: 'volunteers', prefix: 'vol', order: 'seq', json: ['skills', 'areas', 'availability'], bool: [],
    fields: {
      name: str(120, { required: true, min: 2, label: 'Name' }),
      mobile: str(18, { required: true, label: 'Mobile number', pattern: /^[\d\s+()-]{10,18}$/, patternMsg: 'Enter a valid mobile number.' }),
      email: { type: 'email', required: true, max: 160, label: 'Email' },
      institution: str(160, { label: 'Institution' }),
      course: str(160, { label: 'Course' }),
      year: str(30, { label: 'Year' }),
      skills: { type: 'array', maxItems: 30, maxLen: 60, label: 'Skills' },
      areas: { type: 'array', maxItems: 30, maxLen: 64, label: 'Preferred areas' },
      availability: { type: 'array', maxItems: 10, maxLen: 60, label: 'Availability' },
      experience: str(60, { label: 'Experience' }),
      notes: str(1000, { label: 'Notes' }),
      status: { type: 'enum', values: ['Pending', 'Approved', 'Rejected'], default: 'Pending', label: 'Status' }
    }
  },
  teams: {
    table: 'teams', prefix: 't', order: 'rowid', json: ['responsibilities', 'roles'], bool: ['archived'],
    fields: {
      name: str(100, { required: true, min: 2, label: 'Team name' }),
      description: str(500, { label: 'Description' }),
      leader: str(120, { label: 'Leader' }),
      assistant: str(120, { label: 'Assistant leader' }),
      responsibilities: { type: 'array', maxItems: 20, maxLen: 200, label: 'Responsibilities' },
      roles: { type: 'array', maxItems: 20, maxLen: 80, label: 'Roles' },
      venueId: ID({ label: 'Venue' }),
      instructions: str(1000, { label: 'Instructions' }),
      archived: { type: 'bool', label: 'Archived' }
    }
  },
  venues: {
    table: 'venues', prefix: 'v', order: 'rowid', json: [], bool: [],
    fields: {
      name: str(120, { required: true, min: 2, label: 'Venue name' }),
      code: str(12, { required: true, label: 'Venue code', pattern: /^[A-Za-z0-9-]{1,12}$/, patternMsg: 'Use letters, numbers or dashes (max 12).' }),
      area: str(160, { label: 'Area' }),
      floor: str(120, { label: 'Floor / room' }),
      description: str(500, { label: 'Description' }),
      mapLink: { type: 'url', max: 500, label: 'Map link' },
      coordinator: str(120, { label: 'Coordinator' }),
      capacity: { type: 'int', min: 0, max: 100000, label: 'Capacity' },
      setup: str(1000, { label: 'Setup instructions' }),
      status: { type: 'enum', values: ['Active', 'Inactive', 'Archived'], default: 'Active', label: 'Status' }
    }
  },
  shifts: {
    table: 'shifts', prefix: 's', order: 'rowid', json: [], bool: [],
    fields: {
      name: str(160, { required: true, min: 2, label: 'Shift name' }),
      day: str(40, { required: true, label: 'Day' }),
      teamId: { type: 'id', required: true, label: 'Team' },
      venueId: ID({ label: 'Venue' }),
      reportTime: { type: 'time', label: 'Reporting time' },
      setupTime: { type: 'time', label: 'Setup time' },
      startTime: { type: 'time', required: true, label: 'Start time' },
      endTime: { type: 'time', required: true, label: 'End time' },
      positions: { type: 'int', min: 0, max: 1000, nullable: false, label: 'Positions' },
      coordinator: str(120, { label: 'Coordinator' }),
      responsibilities: str(1000, { label: 'Responsibilities' }),
      instructions: str(1000, { label: 'Instructions' })
    }
  },
  assignments: {
    table: 'assignments', prefix: 'a', order: 'rowid', json: [], bool: [],
    fields: {
      volunteerId: { type: 'id', required: true, label: 'Volunteer' },
      teamId: { type: 'id', required: true, label: 'Team' },
      role: str(120, { required: true, label: 'Role' }),
      venueId: ID({ label: 'Venue' }),
      day: str(40, { required: true, label: 'Day' }),
      reportTime: { type: 'time', label: 'Reporting time' },
      startTime: { type: 'time', label: 'Shift start' },
      endTime: { type: 'time', label: 'Shift end' },
      shiftId: ID({ label: 'Shift' }),
      leader: str(120, { label: 'Team leader' }),
      responsibilities: str(1500, { label: 'Responsibilities' }),
      instructions: str(1500, { label: 'Instructions' }),
      status: { type: 'enum', values: ['Active', 'Draft', 'Cancelled'], default: 'Active', label: 'Status' }
    }
  },
  sessions: {
    table: 'event_sessions', prefix: 'se', order: 'rowid', json: [], bool: [],
    fields: {
      day: str(40, { required: true, label: 'Day' }),
      name: str(160, { required: true, min: 2, label: 'Session name' }),
      startTime: { type: 'time', required: true, label: 'Start time' },
      endTime: { type: 'time', required: true, label: 'End time' },
      venueId: ID({ label: 'Venue' }),
      teamId: ID({ label: 'Team' }),
      coordinator: str(120, { label: 'Coordinator' }),
      instructions: str(1000, { label: 'Instructions' })
    }
  },
  announcements: {
    table: 'announcements', prefix: 'an', order: 'rowid', json: [], bool: [],
    fields: {
      title: str(120, { required: true, label: 'Title' }),
      message: str(1000, { required: true, label: 'Message' }),
      audience: { type: 'enum', values: ['All volunteers', 'Specific team'], default: 'All volunteers', label: 'Audience' },
      teamId: ID({ label: 'Team' }),
      priority: { type: 'enum', values: ['High', 'Normal', 'Low'], default: 'Normal', label: 'Priority' },
      status: { type: 'enum', values: ['Draft', 'Published', 'Archived'], default: 'Draft', label: 'Status' },
      publishedAt: { type: 'iso', label: 'Published at' },
      expiry: { type: 'date', label: 'Expiry date' }
    }
  },
  attendance: {
    table: 'attendance', prefix: 'att', order: 'rowid', json: [], bool: [],
    fields: {
      status: { type: 'enum', values: ['Not Marked', 'Present', 'Absent', 'Late', 'Excused'], default: 'Not Marked', label: 'Status' },
      checkIn: { type: 'time', label: 'Check-in time' },
      notes: str(200, { label: 'Notes' })
    }
  }
};

const snake = k => k.replace(/[A-Z]/g, c => '_' + c.toLowerCase());
const camel = k => k.replace(/_([a-z])/g, (_, c) => c.toUpperCase());

function fromRow(res, row) {
  if (!row) return null;
  const out = {};
  for (const [k, v] of Object.entries(row)) {
    let val = v;
    if (res.json.includes(k)) val = JSON.parse(v || '[]');
    else if (res.bool.includes(k)) val = !!v;
    out[camel(k)] = val;
  }
  return out;
}

function toColumns(res, values) {
  const cols = {};
  for (const [k, v] of Object.entries(values)) {
    const c = snake(k);
    cols[c] = res.json.includes(c) ? JSON.stringify(v) : res.bool.includes(c) ? (v ? 1 : 0) : v;
  }
  return cols;
}

async function list(db, name) {
  const res = RESOURCES[name];
  return (await db.all(`SELECT * FROM ${res.table} ORDER BY ${res.order}`)).map(r => fromRow(res, r));
}
async function get(db, name, id) {
  const res = RESOURCES[name];
  return fromRow(res, await db.get(`SELECT * FROM ${res.table} WHERE id = ?`, [id]));
}
async function insert(db, name, values, forcedId) {
  const res = RESOURCES[name];
  const id = forcedId || uid(res.prefix);
  const cols = Object.assign({ id }, toColumns(res, values), { updated_at: now() });
  const keys = Object.keys(cols);
  await db.run(`INSERT INTO ${res.table} (${keys.join(',')}) VALUES (${keys.map(() => '?').join(',')})`, Object.values(cols));
  return get(db, name, id);
}
async function update(db, name, id, values) {
  const res = RESOURCES[name];
  const cols = Object.assign(toColumns(res, values), { updated_at: now() });
  const keys = Object.keys(cols);
  await db.run(`UPDATE ${res.table} SET ${keys.map(k => `${k} = ?`).join(', ')} WHERE id = ?`, [...Object.values(cols), id]);
  return get(db, name, id);
}

/**
 * Delete a record together with everything that depends on it. Done explicitly
 * (children first) so it behaves the same whether or not the database enforces
 * foreign keys — hosted libSQL connections may not.
 */
async function remove(db, name, id) {
  const del = (sql, args) => db.run(sql, args);
  const nul = (table, col) => db.run(`UPDATE ${table} SET ${col} = NULL WHERE ${col} = ?`, [id]);
  switch (name) {
    case 'volunteers':
      await del('DELETE FROM attendance WHERE id IN (SELECT id FROM assignments WHERE volunteer_id = ?)', [id]);
      await del('DELETE FROM assignments WHERE volunteer_id = ?', [id]);
      break;
    case 'assignments':
      await del('DELETE FROM attendance WHERE id = ?', [id]);
      break;
    case 'teams':
      await del('DELETE FROM attendance WHERE id IN (SELECT id FROM assignments WHERE team_id = ?)', [id]);
      await del('DELETE FROM assignments WHERE team_id = ?', [id]);
      await del('DELETE FROM shifts WHERE team_id = ?', [id]);
      await nul('event_sessions', 'team_id');
      await nul('announcements', 'team_id');
      break;
    case 'shifts':
      await nul('assignments', 'shift_id');
      break;
    case 'venues':
      for (const t of ['teams', 'shifts', 'assignments', 'event_sessions']) await nul(t, 'venue_id');
      break;
    default:
      break;
  }
  const res = RESOURCES[name];
  return (await del(`DELETE FROM ${res.table} WHERE id = ?`, [id])).changes;
}

module.exports = { RESOURCES, list, get, insert, update, remove, fromRow };
