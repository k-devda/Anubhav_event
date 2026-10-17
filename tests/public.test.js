'use strict';
const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { start, validReg } = require('./helpers');

let app, admin;
before(async () => { app = await start(); admin = await app.adminClient(); });
after(async () => { await app.close(); });
beforeEach(() => app.limiter.reset());

async function setup() {
  const team = (await admin.post('/api/admin/teams', { name: `Team ${Math.random().toString(36).slice(2, 6)}`, leader: 'Lead Person', roles: ['Guide'] })).json;
  const venue = (await admin.post('/api/admin/venues', { name: 'Hall', code: 'H' + Math.random().toString(36).slice(2, 6) })).json;
  return { team, venue };
}

test('registration validates input and returns a volunteer ID', async () => {
  const c = app.client();
  const bad = await c.post('/api/public/register', { name: 'A', mobile: '123', email: 'nope', consent: false });
  assert.equal(bad.status, 422);
  for (const f of ['name', 'mobile', 'email', 'consent']) assert.ok(bad.json.errors[f], `${f} error`);
  const ok = await c.post('/api/public/register', validReg({ name: 'Asha Rao' }));
  assert.equal(ok.status, 200);
  assert.match(ok.json.code, /^ANU-\d{4}$/);
  const vols = (await admin.get('/api/admin/volunteers')).json;
  const v = vols.find(x => x.name === 'Asha Rao');
  assert.equal(v.status, 'Pending');
});

test('registration: duplicate email, honeypot, and rate limit', async () => {
  const c = app.client();
  const reg = validReg({ email: 'dupe@example.com' });
  assert.equal((await c.post('/api/public/register', reg)).status, 200);
  const dup = await c.post('/api/public/register', Object.assign({}, reg, { mobile: '9123456789' }));
  assert.equal(dup.status, 409);
  const before = (await admin.get('/api/admin/volunteers')).json.length;
  const bot = await c.post('/api/public/register', validReg({ website: 'http://spam.example' }));
  assert.equal(bot.status, 200);
  assert.equal((await admin.get('/api/admin/volunteers')).json.length, before, 'honeypot submissions are not stored');
  let last;
  for (let i = 0; i < 7; i++) last = await c.post('/api/public/register', validReg());
  assert.equal(last.status, 429);
});

test('registration respects the configured required fields', async () => {
  const s = (await admin.get('/api/admin/bootstrap')).json.settings;
  s.registrationFields.skills = { show: true, required: true };
  s.registrationFields.notes = { show: false, required: false };
  assert.equal((await admin.put('/api/admin/settings', s)).status, 200);
  const c = app.client();
  const missing = await c.post('/api/public/register', validReg());
  assert.equal(missing.status, 422); assert.ok(missing.json.errors.skills);
  const ok = await c.post('/api/public/register', validReg({ skills: ['First aid'], notes: 'should be ignored' }));
  assert.equal(ok.status, 200);
  const v = (await admin.get('/api/admin/volunteers')).json.at(-1);
  assert.equal(v.notes, '');
  s.registrationFields.skills = { show: true, required: false }; await admin.put('/api/admin/settings', s);
});

test('Find My Role needs name/ID plus the last 4 mobile digits and reveals nothing else', async () => {
  const { team, venue } = await setup();
  const c = app.client();
  const reg = await c.post('/api/public/register', validReg({ name: 'Meera Joshi', mobile: '+91 90000 12345', email: 'meera@example.com' }));
  const code = reg.json.code;
  const vol = (await admin.get('/api/admin/volunteers')).json.find(v => v.email === 'meera@example.com');

  assert.equal((await c.post('/api/public/find-role', { query: code })).status, 422, 'verification required');
  assert.equal((await c.post('/api/public/find-role', { query: code, mobileLast4: '0000' })).json.status, 'not_found');
  assert.equal((await c.post('/api/public/find-role', { query: 'Meera Joshi', mobileLast4: '2345' })).json.status, 'pending');

  await admin.put(`/api/admin/volunteers/${vol.id}`, { status: 'Approved' });
  assert.equal((await c.post('/api/public/find-role', { query: code, mobileLast4: '2345' })).json.status, 'unassigned');

  const a = await admin.post('/api/admin/assignments', { volunteerId: vol.id, teamId: team.id, role: 'Guide', venueId: venue.id, day: 'event', reportTime: '08:00', startTime: '08:30', endTime: '12:30', leader: 'Lead Person', status: 'Draft' });
  assert.equal(a.status, 201);
  assert.equal((await c.post('/api/public/find-role', { query: code, mobileLast4: '2345' })).json.status, 'no_assignments');

  await admin.put(`/api/admin/assignments/${a.json.id}`, { status: 'Active' });
  const found = await c.post('/api/public/find-role', { query: code.toLowerCase(), mobileLast4: '2345' });
  assert.equal(found.json.status, 'ok');
  assert.equal(found.json.assignments[0].role, 'Guide');
  assert.equal(found.json.assignments[0].venue.name, 'Hall');
  const text = JSON.stringify(found.json);
  assert.ok(!text.includes('meera@example.com') && !text.includes('12345') && !text.includes(vol.id), 'no contact details or internal ids');

  // rejected volunteers cannot be found
  await admin.put(`/api/admin/volunteers/${vol.id}`, { status: 'Rejected' });
  assert.equal((await c.post('/api/public/find-role', { query: code, mobileLast4: '2345' })).json.status, 'not_found');
  assert.equal((await admin.get(`/api/admin/assignments/${a.json.id}`)).json.status, 'Cancelled', 'rejecting cancels assignments');
});

test('Find My Role: same name + same last digits is ambiguous; guessing is throttled', async () => {
  const c = app.client();
  await c.post('/api/public/register', validReg({ name: 'Twin Person', mobile: '9000011111', email: 't1@example.com' }));
  await c.post('/api/public/register', validReg({ name: 'Twin Person', mobile: '9100011111', email: 't2@example.com' }));
  assert.equal((await c.post('/api/public/find-role', { query: 'Twin Person', mobileLast4: '1111' })).json.status, 'ambiguous');
  assert.equal((await c.post('/api/public/find-role', { query: 'Twin Person', mobileLast4: '9999' })).json.status, 'not_found');
  let r;
  for (let i = 0; i < 10; i++) { r = await c.post('/api/public/find-role', { query: 'Brute Target', mobileLast4: String(1000 + i) }); assert.equal(r.status, 200); }
  r = await c.post('/api/public/find-role', { query: 'Brute Target', mobileLast4: '2000' });
  assert.equal(r.status, 429, 'wrong guesses for one name are capped');
  assert.match(r.json.error, /minute/);
  // correct lookups never lock anyone out
  const ok = await c.post('/api/public/register', validReg({ name: 'Steady Person', mobile: '9000077777', email: 'steady@example.com' }));
  for (let i = 0; i < 15; i++) assert.equal((await c.post('/api/public/find-role', { query: ok.json.code, mobileLast4: '7777' })).json.status, 'pending');
  // a few typos followed by the right digits works and resets the counter
  for (let i = 0; i < 4; i++) await c.post('/api/public/find-role', { query: ok.json.code, mobileLast4: '0000' });
  assert.equal((await c.post('/api/public/find-role', { query: ok.json.code, mobileLast4: '7777' })).json.status, 'pending');
});

test('announcements: only published, unexpired items reach the public; publishing stamps a date', async () => {
  const t = await admin.post('/api/admin/announcements', { title: 'Visible', message: 'hello', status: 'Published' });
  assert.equal(t.status, 201); assert.ok(t.json.publishedAt);
  await admin.post('/api/admin/announcements', { title: 'Draft one', message: 'x', status: 'Draft' });
  await admin.post('/api/admin/announcements', { title: 'Expired one', message: 'x', status: 'Published', expiry: '2020-01-01' });
  const titles = (await app.client().get('/api/public/bootstrap')).json.announcements.map(a => a.title);
  assert.ok(titles.includes('Visible')); assert.ok(!titles.includes('Draft one')); assert.ok(!titles.includes('Expired one'));
  const bad = await admin.post('/api/admin/announcements', { title: 'Team only', message: 'x', audience: 'Specific team' });
  assert.equal(bad.status, 422);
});
