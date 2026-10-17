'use strict';
const auth = require('../auth');
const repo = require('../resources');
const settingsStore = require('../settings');
const { AppError, now, uid } = require('../util');
const { validate, check, toMin } = require('../validate');
const { tx } = require('../db');

const COLLECTIONS = Object.keys(repo.RESOURCES).filter(k => k !== 'attendance');
const SINGULAR = { volunteers: 'volunteer', teams: 'team', venues: 'venue', shifts: 'shift', assignments: 'assignment', sessions: 'session', announcements: 'announcement' };

module.exports = function ({ db, router }) {
  const fail = (field, msg) => new AppError(422, msg, { errors: { [field]: msg } });
  const exists = (table, id) => !!db.prepare(`SELECT 1 FROM ${table} WHERE id = ?`).get(id);

  function guard(ctx, perm) {
    auth.require_(ctx.user, perm);
    if (ctx.user.mustChangePassword) throw new AppError(403, 'Please change your temporary password first.', { code: 'PASSWORD_CHANGE_REQUIRED' });
  }

  function log(ctx, type, text) {
    db.prepare('INSERT INTO activity (at,user_id,user_name,type,text) VALUES (?,?,?,?,?)').run(now(), ctx.user.id, ctx.user.name, type, text.slice(0, 300));
  }

  const dayOk = day => settingsStore.get(db).days.some(d => d.id === day);
  const checkTimes = (start, end, startField, endField) => {
    if (!!start !== !!end) throw fail(start ? endField : startField, 'Provide both a start and an end time.');
    if (start && toMin(end) <= toMin(start)) throw fail(endField, 'End must be after start.');
  };

  /* ------------------------------------------------------------------
     Per-resource business rules. `values` are already validated.
     `merged` is the full record as it will be after saving.
     ------------------------------------------------------------------ */
  const RULES = {
    volunteers(ctx, values, existing, merged) {
      const dup = db.prepare('SELECT id FROM volunteers WHERE email = ? AND id <> ?').get(merged.email, existing ? existing.id : '');
      if (dup) throw new AppError(409, 'Another volunteer already uses this email.', { errors: { email: 'Another volunteer already uses this email.' } });
    },
    teams(ctx, values, existing, merged) {
      if (!merged.archived) {
        const dup = db.prepare('SELECT id FROM teams WHERE lower(name) = lower(?) AND archived = 0 AND id <> ?').get(merged.name, existing ? existing.id : '');
        if (dup) throw fail('name', 'A team with this name already exists.');
      }
      if (merged.venueId && !exists('venues', merged.venueId)) throw fail('venueId', 'Venue not found.');
      if (!existing && !values.roles.length) values.roles = ['Team Member'];
    },
    venues(ctx, values, existing, merged) {
      const dup = db.prepare('SELECT id FROM venues WHERE code = ? AND id <> ?').get(merged.code, existing ? existing.id : '');
      if (dup) throw fail('code', 'This code is already used.');
    },
    shifts(ctx, values, existing, merged) {
      if (!exists('teams', merged.teamId)) throw fail('teamId', 'Team not found.');
      if (merged.venueId && !exists('venues', merged.venueId)) throw fail('venueId', 'Venue not found.');
      if (!dayOk(merged.day)) throw fail('day', 'Unknown event day.');
      checkTimes(merged.startTime, merged.endTime, 'startTime', 'endTime');
      if (merged.setupTime && merged.reportTime && toMin(merged.setupTime) > toMin(merged.startTime)) throw fail('setupTime', 'Setup must be before the shift starts.');
    },
    assignments(ctx, values, existing, merged) {
      const vol = repo.get(db, 'volunteers', merged.volunteerId);
      if (!vol) throw fail('volunteerId', 'Volunteer not found.');
      if (vol.status !== 'Approved' && merged.status !== 'Cancelled') throw fail('volunteerId', 'Only approved volunteers can be assigned.');
      const team = repo.get(db, 'teams', merged.teamId);
      if (!team) throw fail('teamId', 'Team not found.');
      if (team.archived && (!existing || existing.teamId !== merged.teamId) && merged.status !== 'Cancelled') throw fail('teamId', 'This team is archived.');
      if (merged.venueId && !exists('venues', merged.venueId)) throw fail('venueId', 'Venue not found.');
      if (!dayOk(merged.day)) throw fail('day', 'Unknown event day.');
      if (merged.shiftId) {
        const sh = repo.get(db, 'shifts', merged.shiftId);
        if (!sh) throw fail('shiftId', 'Shift not found.');
        if (sh.teamId !== merged.teamId) throw fail('shiftId', 'That shift belongs to a different team.');
      }
      checkTimes(merged.startTime, merged.endTime, 'startTime', 'endTime');
      if (merged.status === 'Active') {
        const dup = db.prepare(`SELECT id FROM assignments WHERE volunteer_id = ? AND team_id = ? AND role = ? AND day = ? AND start_time = ? AND end_time = ? AND status = 'Active' AND id <> ?`)
          .get(merged.volunteerId, merged.teamId, merged.role, merged.day, merged.startTime, merged.endTime, existing ? existing.id : '');
        if (dup) throw new AppError(409, 'This volunteer already has an identical active assignment.');
      }
    },
    sessions(ctx, values, existing, merged) {
      if (!dayOk(merged.day)) throw fail('day', 'Unknown event day.');
      checkTimes(merged.startTime, merged.endTime, 'startTime', 'endTime');
      if (merged.venueId && !exists('venues', merged.venueId)) throw fail('venueId', 'Venue not found.');
      if (merged.teamId && !exists('teams', merged.teamId)) throw fail('teamId', 'Team not found.');
    },
    announcements(ctx, values, existing, merged) {
      if (merged.audience === 'Specific team') {
        if (!merged.teamId) throw fail('teamId', 'Select a team.');
        if (!exists('teams', merged.teamId)) throw fail('teamId', 'Team not found.');
      } else values.teamId = null;
      if (merged.status === 'Published' && !merged.publishedAt) values.publishedAt = now();
    }
  };

  /* Side effects after a successful save; returns collections the client should reload. */
  const AFTER = {
    volunteers(ctx, rec, existing) {
      if (existing && existing.status !== 'Rejected' && rec.status === 'Rejected') {
        db.prepare("UPDATE assignments SET status = 'Cancelled', updated_at = ? WHERE volunteer_id = ? AND status <> 'Cancelled'").run(now(), rec.id);
        return ['assignments'];
      }
      return [];
    },
    shifts(ctx, rec, existing) {
      if (!existing) return [];
      db.prepare(`UPDATE assignments SET team_id = ?, venue_id = ?, day = ?, report_time = ?, start_time = ?, end_time = ?, updated_at = ? WHERE shift_id = ?`)
        .run(rec.teamId, rec.venueId, rec.day, rec.reportTime, rec.startTime, rec.endTime, now(), rec.id);
      return ['assignments'];
    }
  };

  const label = (name, rec) => rec.name || rec.title || rec.role || rec.id;

  /* ---------- bootstrap ---------- */
  router.get('/api/admin/bootstrap', async ctx => {
    guard(ctx, 'read');
    const out = { me: auth.publicUser(ctx.user), settings: settingsStore.get(db) };
    COLLECTIONS.forEach(c => { out[c] = repo.list(db, c); });
    out.attendance = repo.list(db, 'attendance');
    out.activity = db.prepare('SELECT id, at, user_name AS userName, type, text FROM activity ORDER BY id DESC LIMIT 40').all();
    return out;
  });

  /* ---------- settings ---------- */
  router.put('/api/admin/settings', async ctx => {
    guard(ctx, 'settings');
    const current = settingsStore.get(db);
    const clean = settingsStore.validateSettings(Object.assign({}, current, ctx.body));
    const keep = new Set(clean.days.map(d => d.id));
    for (const d of current.days.filter(d => !keep.has(d.id))) {
      const used = ['shifts', 'assignments', 'event_sessions'].reduce((n, t) => n + db.prepare(`SELECT COUNT(*) AS n FROM ${t} WHERE day = ?`).get(d.id).n, 0);
      if (used) throw new AppError(409, `"${d.label}" can't be removed: ${used} shift/assignment/session record(s) still use it.`, { errors: { days: `"${d.label}" is still in use.` } });
    }
    settingsStore.save(db, clean);
    log(ctx, 'settings', 'Updated settings');
    return clean;
  });

  /* ---------- attendance (upsert keyed by assignment id) ---------- */
  router.put('/api/admin/attendance/:id', async ctx => {
    guard(ctx, 'write');
    const a = repo.get(db, 'assignments', ctx.params.id);
    if (!a) throw new AppError(404, 'Assignment not found.');
    const values = validate(repo.RESOURCES.attendance.fields, ctx.body, true);
    const cur = repo.get(db, 'attendance', a.id);
    const merged = Object.assign({ status: 'Not Marked', checkIn: '', notes: '' }, cur || {}, values);
    if ((merged.status === 'Absent' || merged.status === 'Not Marked') && !('checkIn' in ctx.body)) merged.checkIn = '';
    const rec = cur ? repo.update(db, 'attendance', a.id, Object.assign(merged, { updatedBy: ctx.user.id }))
      : repo.insert(db, 'attendance', Object.assign(merged, { updatedBy: ctx.user.id }), a.id);
    if (!cur || cur.status !== rec.status) {
      const v = repo.get(db, 'volunteers', a.volunteerId);
      log(ctx, 'attendance', `Marked ${v ? v.name : 'volunteer'} as ${rec.status}`);
    }
    return rec;
  });

  /* ---------- admin users ---------- */
  const userFields = {
    email: { type: 'email', required: true, max: 160, label: 'Email' },
    name: { type: 'string', required: true, min: 2, max: 100, label: 'Name' },
    role: { type: 'enum', values: ['admin', 'coordinator', 'viewer'], label: 'Role', default: 'viewer' }
  };
  const listUsers = () => db.prepare('SELECT id,email,name,role,active,must_change_password AS mustChangePassword,last_login_at AS lastLoginAt,created_at AS createdAt FROM users ORDER BY created_at').all()
    .map(u => Object.assign(u, { active: !!u.active, mustChangePassword: !!u.mustChangePassword }));
  const activeAdmins = excludeId => db.prepare("SELECT COUNT(*) AS n FROM users WHERE role = 'admin' AND active = 1 AND id <> ?").get(excludeId || '').n;

  router.get('/api/admin/users', async ctx => { guard(ctx, 'users'); return listUsers(); });
  router.post('/api/admin/users', async ctx => {
    guard(ctx, 'users');
    const v = validate(userFields, ctx.body);
    const problem = auth.passwordProblem(ctx.body.password, v.email);
    if (problem) throw fail('password', problem);
    if (db.prepare('SELECT 1 FROM users WHERE email = ?').get(v.email)) throw fail('email', 'An account with this email already exists.');
    const id = await auth.createUser(db, { email: v.email, name: v.name, role: v.role, password: ctx.body.password, mustChange: true });
    log(ctx, 'user', `Created ${v.role} account for ${v.email}`);
    ctx.status = 201;
    return listUsers().find(u => u.id === id);
  });
  router.put('/api/admin/users/:id', async ctx => {
    guard(ctx, 'users');
    const cur = db.prepare('SELECT * FROM users WHERE id = ?').get(ctx.params.id);
    if (!cur) throw new AppError(404, 'User not found.');
    const v = validate({ name: userFields.name, role: userFields.role, active: { type: 'bool' } }, ctx.body, true);
    const role = v.role || cur.role; const active = 'active' in v ? v.active : !!cur.active;
    if (cur.id === ctx.user.id && (role !== 'admin' || !active)) throw new AppError(409, 'You cannot demote or deactivate your own account.');
    if (cur.role === 'admin' && (role !== 'admin' || !active) && activeAdmins(cur.id) < 1) throw new AppError(409, 'At least one active admin is required.');
    db.prepare('UPDATE users SET name = ?, role = ?, active = ?, updated_at = ? WHERE id = ?').run(v.name || cur.name, role, active ? 1 : 0, now(), cur.id);
    if (ctx.body.password !== undefined) {
      const problem = auth.passwordProblem(ctx.body.password, cur.email);
      if (problem) throw fail('password', problem);
      db.prepare('UPDATE users SET password_hash = ?, must_change_password = 1, failed_attempts = 0, locked_until = NULL WHERE id = ?').run(await auth.hashPassword(ctx.body.password), cur.id);
      db.prepare('DELETE FROM auth_sessions WHERE user_id = ?').run(cur.id);
    }
    if (!active || role !== cur.role) db.prepare('DELETE FROM auth_sessions WHERE user_id = ?').run(cur.id);
    log(ctx, 'user', `Updated account ${cur.email}`);
    return listUsers().find(u => u.id === cur.id);
  });

  /* ---------- generic CRUD ---------- */
  const COLL = `(${COLLECTIONS.join('|')})`;
  const collRoute = suffix => `/api/admin/:coll${suffix}`;
  const resolve = ctx => {
    if (!COLLECTIONS.includes(ctx.params.coll)) throw new AppError(404, 'Not found.');
    return ctx.params.coll;
  };

  router.get(collRoute(''), async ctx => { guard(ctx, 'read'); const c = resolve(ctx); return repo.list(db, c); });
  router.get(collRoute('/:id'), async ctx => {
    guard(ctx, 'read'); const c = resolve(ctx);
    const rec = repo.get(db, c, ctx.params.id);
    if (!rec) throw new AppError(404, 'Not found.');
    return rec;
  });

  router.post(collRoute(''), async ctx => {
    guard(ctx, 'write');
    const c = resolve(ctx);
    const values = validate(repo.RESOURCES[c].fields, ctx.body);
    return tx(db, () => {
      const merged = Object.assign({}, values);
      if (RULES[c]) RULES[c](ctx, values, null, Object.assign(merged, values));
      const extra = {};
      if (c === 'volunteers') { extra.seq = db.prepare('SELECT COALESCE(MAX(seq),0) AS m FROM volunteers').get().m + 1; extra.registeredAt = now(); }
      const rec = repo.insert(db, c, Object.assign(values, extra));
      const reload = AFTER[c] ? AFTER[c](ctx, rec, null) : [];
      log(ctx, SINGULAR[c], `Created ${SINGULAR[c]} “${label(c, rec)}”`);
      ctx.status = 201;
      if (reload.length) ctx.headers['X-Reload'] = reload.join(',');
      return rec;
    });
  });

  const update = async ctx => {
    guard(ctx, 'write');
    const c = resolve(ctx);
    const existing = repo.get(db, c, ctx.params.id);
    if (!existing) throw new AppError(404, 'Not found.');
    const body = Object.assign({}, ctx.body);
    if (c === 'assignments') delete body.volunteerId; // an assignment never moves between volunteers
    const values = validate(repo.RESOURCES[c].fields, body, true);
    return tx(db, () => {
      const merged = Object.assign({}, existing, values);
      if (RULES[c]) RULES[c](ctx, values, existing, merged);
      const rec = Object.keys(values).length ? repo.update(db, c, existing.id, values) : existing;
      const reload = AFTER[c] ? AFTER[c](ctx, rec, existing) : [];
      log(ctx, SINGULAR[c], `Updated ${SINGULAR[c]} “${label(c, rec)}”`);
      if (reload.length) ctx.headers['X-Reload'] = reload.join(',');
      return rec;
    });
  };
  router.put(collRoute('/:id'), update);
  router.patch(collRoute('/:id'), update);

  router.delete(collRoute('/:id'), async ctx => {
    guard(ctx, 'delete');
    const c = resolve(ctx);
    const existing = repo.get(db, c, ctx.params.id);
    if (!existing) throw new AppError(404, 'Not found.');
    if (c === 'teams' && db.prepare("SELECT 1 FROM assignments WHERE team_id = ? AND status = 'Active'").get(existing.id)) throw new AppError(409, 'This team still has active assignments. Archive it instead.');
    repo.remove(db, c, existing.id);
    log(ctx, SINGULAR[c], `Deleted ${SINGULAR[c]} “${label(c, existing)}”`);
    // FK actions may have changed other tables
    const reload = { volunteers: 'assignments,attendance', teams: 'shifts,assignments,attendance', shifts: 'assignments', assignments: 'attendance', venues: 'teams,shifts,assignments,sessions' }[c];
    if (reload) ctx.headers['X-Reload'] = reload;
    return { ok: true };
  });
};
