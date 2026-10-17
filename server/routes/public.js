'use strict';
const settingsStore = require('../settings');
const repo = require('../resources');
const { AppError, now } = require('../util');
const { validate, check } = require('../validate');
const { tx } = require('../db');

module.exports = function ({ db, router, limiter }) {
  const code = (s, v) => s.idFormat.prefix + String(v.seq).padStart(s.idFormat.digits, '0');
  const today = () => new Date().toISOString().slice(0, 10);

  /* ---------- public snapshot (no contact details, no emails) ---------- */
  router.get('/api/public/bootstrap', async () => {
    const s = settingsStore.get(db);
    const teams = repo.list(db, 'teams').filter(t => !t.archived);
    const vols = new Map(repo.list(db, 'volunteers').filter(v => v.status === 'Approved').map(v => [v.id, v]));
    const active = repo.list(db, 'assignments').filter(a => a.status === 'Active' && vols.has(a.volunteerId));
    const venues = repo.list(db, 'venues').filter(v => v.status !== 'Archived');
    const venueIds = new Set(venues.map(v => v.id));
    const teamIds = new Set(teams.map(t => t.id));
    return {
      settings: s,
      teams: teams.map(t => {
        const mine = active.filter(a => a.teamId === t.id);
        return {
          id: t.id, name: t.name, description: t.description, leader: t.leader, assistant: t.assistant,
          responsibilities: t.responsibilities, instructions: t.instructions, venueId: t.venueId,
          memberCount: new Set(mine.map(a => a.volunteerId)).size,
          members: s.visibility.rosterNames
            ? mine.map(a => ({ name: vols.get(a.volunteerId).name, role: a.role, day: a.day, startTime: a.startTime, endTime: a.endTime })).sort((x, y) => x.name.localeCompare(y.name))
            : []
        };
      }),
      venues: venues.map(v => ({ id: v.id, name: v.name, code: v.code, area: v.area, floor: v.floor })),
      shifts: repo.list(db, 'shifts').filter(x => teamIds.has(x.teamId)).map(x => ({ id: x.id, name: x.name, day: x.day, teamId: x.teamId, venueId: venueIds.has(x.venueId) ? x.venueId : null, reportTime: x.reportTime, startTime: x.startTime, endTime: x.endTime })),
      sessions: repo.list(db, 'sessions'),
      announcements: repo.list(db, 'announcements').filter(a => a.status === 'Published' && (!a.expiry || a.expiry >= today()))
        .sort((a, b) => (b.publishedAt || '').localeCompare(a.publishedAt || ''))
    };
  });

  /* ---------- registration ---------- */
  const MOBILE = /^(\+91[\s-]?)?[6-9]\d{4}[\s-]?\d{5}$/;
  router.post('/api/public/register', async ctx => {
    const s = settingsStore.get(db);
    if (s.visibility.registration === false) throw new AppError(403, 'Registration is currently closed.');
    if (!limiter.take(`reg:${ctx.ip}`, 6, 3600e3)) throw new AppError(429, 'Too many registrations from this connection. Please try again later.');
    const b = ctx.body;
    if (b.website) return { code: 'ANU-0000', name: String(b.name || '').slice(0, 60), accepted: true }; // honeypot: pretend success
    const errors = {};
    const out = {};
    const take = (key, spec) => { try { out[key] = check(spec, b[key], spec.label); } catch (m) { errors[key] = String(m); } };
    take('name', { type: 'string', required: true, min: 2, max: 120, label: 'Full name' });
    take('mobile', { type: 'string', required: true, max: 18, pattern: MOBILE, patternMsg: 'Enter a valid 10-digit Indian mobile number.', label: 'Mobile number' });
    take('email', { type: 'email', required: true, max: 160, label: 'Email' });
    if (b.consent !== true) errors.consent = 'Please accept the privacy consent to continue.';
    const rf = s.registrationFields;
    const optional = {
      institution: { type: 'string', max: 160, label: 'College / institution' }, course: { type: 'string', max: 160, label: 'Course or department' },
      year: { type: 'string', max: 30, label: 'Year of study' }, experience: { type: 'string', max: 60, label: 'Experience' }, notes: { type: 'string', max: 1000, label: 'Notes' },
      skills: { type: 'array', maxItems: 30, maxLen: 60, label: 'Skills' }, areas: { type: 'array', maxItems: 30, maxLen: 64, label: 'Preferred areas' }, availability: { type: 'array', maxItems: 10, maxLen: 60, label: 'Availability' }
    };
    for (const [key, spec] of Object.entries(optional)) {
      if (!rf[key].show) { out[key] = spec.type === 'array' ? [] : ''; continue; }
      take(key, Object.assign({}, spec, { required: rf[key].required }));
      if (rf[key].required && spec.type === 'array' && !(out[key] && out[key].length)) errors[key] = 'Please select at least one option.';
    }
    if (Object.keys(errors).length) throw new AppError(422, 'Please fix the highlighted fields.', { errors });
    const teamIds = new Set(repo.list(db, 'teams').filter(t => !t.archived).map(t => t.id));
    out.areas = (out.areas || []).filter(id => teamIds.has(id));

    return tx(db, () => {
      if (db.prepare('SELECT 1 FROM volunteers WHERE email = ?').get(out.email)) throw new AppError(409, 'This email is already registered.', { errors: { email: 'This email is already registered.' } });
      const seq = (db.prepare('SELECT COALESCE(MAX(seq),0) AS m FROM volunteers').get().m) + 1;
      const v = repo.insert(db, 'volunteers', Object.assign(out, { seq, registeredAt: now(), status: 'Pending' }));
      db.prepare('INSERT INTO activity (at,type,text) VALUES (?,?,?)').run(now(), 'register', `New registration from ${v.name}`);
      return { code: code(s, v), name: v.name, accepted: true };
    });
  });

  /* ---------- Find My Role (verified lookup) ---------- */
  const NOT_FOUND = { status: 'not_found' };
  router.post('/api/public/find-role', async ctx => {
    const s = settingsStore.get(db);
    if (s.visibility.findRole === false) throw new AppError(403, 'Find My Role is currently switched off.');
    if (!limiter.take(`fr-ip:${ctx.ip}`, 40, 10 * 60e3)) throw new AppError(429, 'Too many lookups. Please wait a few minutes and try again.');
    const query = typeof ctx.body.query === 'string' ? ctx.body.query.trim().slice(0, 100) : '';
    const last4 = typeof ctx.body.mobileLast4 === 'string' ? ctx.body.mobileLast4.trim() : '';
    const errors = {};
    if (!query) errors.query = 'Please enter your name or Volunteer ID.';
    if (!/^\d{4}$/.test(last4)) errors.mobileLast4 = 'Enter the last 4 digits of your registered mobile number.';
    if (Object.keys(errors).length) throw new AppError(422, 'Please complete both fields.', { errors });
    // Throttle GUESSING: only wrong attempts count. After 10 wrong tries for the same name/ID
    // in an hour the lookup pauses; a correct lookup resets the counter.
    const qKey = 'fr-q:' + query.toLowerCase();
    const HOUR = 3600e3;
    if (limiter.blocked(qKey, 10, HOUR)) {
      throw new AppError(429, `Too many wrong attempts for that name or ID. Please try again in about ${limiter.retryMinutes(qKey, HOUR)} minute(s), or ask the helpdesk.`);
    }

    const q = query.toLowerCase();
    const all = repo.list(db, 'volunteers').filter(v => v.status !== 'Rejected');
    const byCode = all.filter(v => code(s, v).toLowerCase() === q);
    const pool = byCode.length ? byCode : (q.length >= 3 ? all.filter(v => v.name.toLowerCase().includes(q)) : []);
    const matches = pool.filter(v => v.mobile.replace(/\D/g, '').endsWith(last4));
    if (!matches.length) { limiter.record(qKey, HOUR); return NOT_FOUND; }
    if (matches.length > 1) { limiter.record(qKey, HOUR); return { status: 'ambiguous' }; }
    limiter.clear(qKey);

    const v = matches[0];
    const base = { volunteer: { name: v.name, code: code(s, v) } };
    if (v.status === 'Pending') return Object.assign(base, { status: 'pending' });
    const mine = repo.list(db, 'assignments').filter(a => a.volunteerId === v.id && a.status !== 'Cancelled');
    const active = mine.filter(a => a.status === 'Active');
    if (!active.length) return Object.assign(base, { status: mine.length ? 'no_assignments' : 'unassigned' });
    const teams = new Map(repo.list(db, 'teams').map(t => [t.id, t]));
    const venues = new Map(repo.list(db, 'venues').map(x => [x.id, x]));
    const dayOrder = s.days.map(d => d.id);
    const dayLabel = id => (s.days.find(d => d.id === id) || {}).label || '';
    const dayDate = id => { const d = (s.days.find(x => x.id === id) || {}).date; return d ? new Date(d + 'T00:00:00Z').toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }) : ''; };
    active.sort((a, b) => (dayOrder.indexOf(a.day) - dayOrder.indexOf(b.day)) || String(a.startTime).localeCompare(String(b.startTime)));
    return Object.assign(base, {
      status: 'ok',
      assignments: active.map(a => {
        const t = teams.get(a.teamId) || {}; const ven = venues.get(a.venueId);
        return {
          role: a.role, team: t.name || '', day: a.day, dayLabel: dayLabel(a.day), date: dayDate(a.day),
          venue: ven ? { name: ven.name, area: ven.area, floor: ven.floor } : null,
          reportTime: a.reportTime, startTime: a.startTime, endTime: a.endTime,
          leader: a.leader || t.leader || '',
          responsibilities: a.responsibilities || (t.responsibilities || []).join(', '),
          instructions: a.instructions || s.assignmentInstructions,
          updatedAt: a.updatedAt
        };
      })
    });
  });
};
