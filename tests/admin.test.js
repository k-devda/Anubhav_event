'use strict';
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { start } = require('./helpers');

let app, admin;
before(async () => { app = await start(); admin = await app.adminClient(); });
after(async () => { await app.close(); });

const mkVol = async (over) => (await admin.post('/api/admin/volunteers', Object.assign({
  name: 'Vol ' + Math.random().toString(36).slice(2, 6), mobile: '9876543210', email: `x${Math.random().toString(36).slice(2, 9)}@example.com`, institution: 'PDEU', status: 'Approved'
}, over || {}))).json;
const mkTeam = async (over) => (await admin.post('/api/admin/teams', Object.assign({ name: 'T' + Math.random().toString(36).slice(2, 6), leader: 'Boss', roles: ['Guide'] }, over || {}))).json;

test('validation errors are reported per field with 422', async () => {
  const r = await admin.post('/api/admin/volunteers', { name: '', mobile: 'abc', email: 'bad' });
  assert.equal(r.status, 422);
  assert.ok(r.json.errors.name && r.json.errors.mobile && r.json.errors.email);
  const t = await admin.post('/api/admin/shifts', { name: 'S', day: 'event', teamId: 'nope', startTime: '25:00', endTime: '10:00' });
  assert.equal(t.status, 422); assert.ok(t.json.errors.startTime);
});

test('volunteers: sequential IDs, unique email, status workflow', async () => {
  const a = await mkVol({ status: 'Pending' }); const b = await mkVol({});
  assert.equal(b.seq, a.seq + 1);
  const dup = await admin.post('/api/admin/volunteers', { name: 'Dup', mobile: '9876543210', email: a.email.toUpperCase() });
  assert.equal(dup.status, 409);
  const up = await admin.put(`/api/admin/volunteers/${a.id}`, { status: 'Approved' });
  assert.equal(up.json.status, 'Approved');
  assert.equal((await admin.put(`/api/admin/volunteers/${a.id}`, { status: 'Bogus' })).status, 422);
  assert.equal((await admin.get('/api/admin/volunteers/missing')).status, 404);
});

test('teams: unique active names, archive/restore, delete guarded by active assignments', async () => {
  const t = await mkTeam({ name: 'Unique Team' });
  assert.equal((await admin.post('/api/admin/teams', { name: 'unique team' })).status, 422);
  assert.equal((await admin.put(`/api/admin/teams/${t.id}`, { archived: true })).json.archived, true);
  assert.equal((await admin.post('/api/admin/teams', { name: 'Unique Team' })).status, 201, 'name reusable once the old team is archived');
  const t2 = await mkTeam();
  const v = await mkVol();
  await admin.post('/api/admin/assignments', { volunteerId: v.id, teamId: t2.id, role: 'Guide', day: 'event', startTime: '09:00', endTime: '10:00' });
  assert.equal((await admin.del(`/api/admin/teams/${t2.id}`)).status, 409);
});

test('venues: unique code (case-insensitive), http(s) map links only', async () => {
  assert.equal((await admin.post('/api/admin/venues', { name: 'Alpha Hall', code: 'ZZ1' })).status, 201);
  assert.equal((await admin.post('/api/admin/venues', { name: 'Beta Hall', code: 'zz1' })).status, 422);
  const bad = await admin.post('/api/admin/venues', { name: 'Gamma Hall', code: 'ZZ2', mapLink: 'javascript:alert(1)' });
  assert.equal(bad.status, 422); assert.ok(bad.json.errors.mapLink);
});

test('assignments: business rules', async () => {
  const team = await mkTeam(); const other = await mkTeam();
  const approved = await mkVol(); const pending = await mkVol({ status: 'Pending' });
  const shift = (await admin.post('/api/admin/shifts', { name: 'AM', day: 'event', teamId: team.id, startTime: '08:00', endTime: '12:00', reportTime: '07:30', positions: 2 })).json;
  const base = { volunteerId: approved.id, teamId: team.id, role: 'Guide', day: 'event', startTime: '08:00', endTime: '12:00' };

  assert.equal((await admin.post('/api/admin/assignments', Object.assign({}, base, { volunteerId: pending.id }))).status, 422, 'pending volunteers cannot be assigned');
  assert.equal((await admin.post('/api/admin/assignments', Object.assign({}, base, { endTime: '07:00' }))).status, 422, 'end before start');
  assert.equal((await admin.post('/api/admin/assignments', Object.assign({}, base, { startTime: '', endTime: '12:00' }))).status, 422, 'half a time range');
  assert.equal((await admin.post('/api/admin/assignments', Object.assign({}, base, { day: 'nonsense' }))).status, 422, 'unknown day');
  assert.equal((await admin.post('/api/admin/assignments', Object.assign({}, base, { shiftId: shift.id, teamId: other.id }))).status, 422, 'shift/team mismatch');

  const ok = await admin.post('/api/admin/assignments', Object.assign({}, base, { shiftId: shift.id }));
  assert.equal(ok.status, 201);
  assert.equal((await admin.post('/api/admin/assignments', Object.assign({}, base, { shiftId: shift.id }))).status, 409, 'identical active assignment');
  // multiple different assignments for one volunteer are allowed
  assert.equal((await admin.post('/api/admin/assignments', Object.assign({}, base, { role: 'Lead', startTime: '13:00', endTime: '15:00' }))).status, 201);
  // an assignment can't be moved to another volunteer
  const moved = await admin.put(`/api/admin/assignments/${ok.json.id}`, { volunteerId: pending.id, role: 'Updated' });
  assert.equal(moved.json.volunteerId, approved.id);
});

test('editing a shift propagates to its assignments; deleting it unlinks them', async () => {
  const team = await mkTeam(); const v = await mkVol();
  const shift = (await admin.post('/api/admin/shifts', { name: 'PM', day: 'event', teamId: team.id, startTime: '13:00', endTime: '17:00', reportTime: '12:30', positions: 1 })).json;
  const a = (await admin.post('/api/admin/assignments', { volunteerId: v.id, teamId: team.id, role: 'Guide', day: 'event', startTime: '13:00', endTime: '17:00', reportTime: '12:30', shiftId: shift.id })).json;
  const up = await admin.put(`/api/admin/shifts/${shift.id}`, { startTime: '14:00', reportTime: '13:30' });
  assert.equal(up.headers.get('x-reload'), 'assignments');
  const after = (await admin.get(`/api/admin/assignments/${a.id}`)).json;
  assert.equal(after.startTime, '14:00'); assert.equal(after.reportTime, '13:30');
  await admin.del(`/api/admin/shifts/${shift.id}`);
  assert.equal((await admin.get(`/api/admin/assignments/${a.id}`)).json.shiftId, null);
});

test('attendance: upsert per assignment with validation, removed with the assignment', async () => {
  const team = await mkTeam(); const v = await mkVol();
  const a = (await admin.post('/api/admin/assignments', { volunteerId: v.id, teamId: team.id, role: 'Guide', day: 'event', startTime: '09:00', endTime: '10:00' })).json;
  const r = await admin.put(`/api/admin/attendance/${a.id}`, { status: 'Late', checkIn: '09:12', notes: 'traffic' });
  assert.equal(r.status, 200); assert.equal(r.json.status, 'Late');
  assert.equal((await admin.put(`/api/admin/attendance/${a.id}`, { status: 'Present' })).json.checkIn, '09:12', 'partial update keeps other fields');
  assert.equal((await admin.put(`/api/admin/attendance/${a.id}`, { status: 'Maybe' })).status, 422);
  assert.equal((await admin.put('/api/admin/attendance/missing', { status: 'Present' })).status, 404);
  await admin.del(`/api/admin/assignments/${a.id}`);
  const boot = (await admin.get('/api/admin/bootstrap')).json;
  assert.ok(!boot.attendance.some(x => x.id === a.id), 'attendance cascades');
});

test('settings: validated, persisted, and visible to the public site', async () => {
  const s = (await admin.get('/api/admin/bootstrap')).json.settings;
  assert.equal((await admin.put('/api/admin/settings', Object.assign({}, s, { eventName: '' }))).status, 422);
  assert.equal((await admin.put('/api/admin/settings', Object.assign({}, s, { timezone: 'Mars/Base' }))).status, 422);
  assert.equal((await admin.put('/api/admin/settings', Object.assign({}, s, { idFormat: { prefix: 'VOL-', digits: 3 } }))).status, 200);
  const pub = (await app.client().get('/api/public/bootstrap')).json.settings;
  assert.equal(pub.idFormat.prefix, 'VOL-');
  await admin.put('/api/admin/settings', s);
});

test('activity log records who did what', async () => {
  const v = await mkVol({ name: 'Logged Person' });
  const act = (await admin.get('/api/admin/bootstrap')).json.activity;
  assert.ok(act.some(a => a.text.includes('Logged Person') && a.userName));
  assert.ok(v.id);
});

test('SQL-injection-style input is stored as plain text and never breaks queries', async () => {
  const evil = "Robert'); DROP TABLE volunteers;--";
  const v = await mkVol({ name: evil });
  assert.equal(v.name, evil);
  assert.ok((await admin.get('/api/admin/volunteers')).json.length > 0);
  const r = await app.client().post('/api/public/find-role', { query: "' OR 1=1 --", mobileLast4: '1234' });
  assert.equal(r.json.status, 'not_found');
});

test('event days carry real dates and cannot be removed while in use', async () => {
  const s = (await admin.get('/api/admin/bootstrap')).json.settings;
  const days = [{ id: 'event', label: 'Event Day 1', date: '2026-10-27', note: '' }, { id: 'day2', label: 'Event Day 2', date: '2026-10-28', note: '' }];
  const saved = await admin.put('/api/admin/settings', Object.assign({}, s, { days }));
  assert.equal(saved.status, 200);
  assert.deepEqual(saved.json.days.map(d => d.date), ['2026-10-27', '2026-10-28']);
  assert.equal((await admin.put('/api/admin/settings', Object.assign({}, s, { days: [{ id: 'event', label: 'D1', date: '27/10/2026' }] }))).status, 422, 'bad date format');
  const team = (await admin.post('/api/admin/teams', { name: 'Days Team' })).json;
  const shift = await admin.post('/api/admin/shifts', { name: 'Day2 shift', day: 'day2', teamId: team.id, startTime: '09:00', endTime: '10:00' });
  assert.equal(shift.status, 201);
  const blocked = await admin.put('/api/admin/settings', Object.assign({}, s, { days: days.slice(0, 1) }));
  assert.equal(blocked.status, 409); assert.match(blocked.json.error, /still use it/);
  // the public Find My Role card shows the real date
  const v = (await admin.post('/api/admin/volunteers', { name: 'Date Check', mobile: '9876500000', email: 'datecheck@example.com', status: 'Approved' })).json;
  const a = await admin.post('/api/admin/assignments', { volunteerId: v.id, teamId: team.id, role: 'Guide', day: 'day2', startTime: '09:00', endTime: '10:00' });
  assert.equal(a.status, 201);
  const code = 'ANU-' + String(v.seq).padStart(4, '0');
  const fr = await app.client().post('/api/public/find-role', { query: code, mobileLast4: '0000' });
  assert.equal(fr.json.assignments[0].date, 'Wednesday, 28 October 2026');
  assert.equal(fr.json.assignments[0].dayLabel, 'Event Day 2');
});
