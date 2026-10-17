'use strict';
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { start } = require('./helpers');

let app;
before(async () => { app = await start(); });
after(async () => { await app.close(); });

test('login: wrong password and unknown user give the same generic error', async () => {
  await app.makeUser('admin', 'real@example.com', 'CorrectHorse123');
  const c = app.client();
  const wrong = await c.login('real@example.com', 'nope-nope-1');
  const unknown = await c.login('ghost@example.com', 'nope-nope-1');
  assert.equal(wrong.status, 401); assert.equal(unknown.status, 401);
  assert.equal(wrong.json.error, unknown.json.error);
});

test('login sets an HttpOnly SameSite=Strict cookie; me works; logout ends the session', async () => {
  await app.makeUser('coordinator', 'coord@example.com', 'CorrectHorse123');
  const res = await fetch(app.base + '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'anubhav' }, body: JSON.stringify({ email: 'coord@example.com', password: 'CorrectHorse123' }) });
  const cookie = res.headers.getSetCookie()[0];
  assert.match(cookie, /HttpOnly/); assert.match(cookie, /SameSite=Strict/);
  const c = app.client();
  assert.equal((await c.login('coord@example.com', 'CorrectHorse123')).status, 200);
  assert.equal((await c.get('/api/auth/me')).json.user.role, 'coordinator');
  assert.equal((await c.post('/api/auth/logout')).status, 200);
  assert.equal((await c.get('/api/auth/me')).json.user, null);
  assert.equal((await c.get('/api/admin/bootstrap')).status, 401);
});

test('account locks after repeated failures, even for the right password', async () => {
  await app.makeUser('viewer', 'locky@example.com', 'CorrectHorse123');
  const c = app.client();
  for (let i = 0; i < 5; i++) assert.equal((await c.login('locky@example.com', 'wrong-password-1')).status, 401);
  const locked = await c.login('locky@example.com', 'CorrectHorse123');
  assert.equal(locked.status, 429);
  await app.limiter.reset();
});

test('temporary password must be changed before using the admin API', async () => {
  await app.makeUser('admin', 'temp@example.com', 'TempPassw0rd99', true);
  const c = app.client();
  const login = await c.login('temp@example.com', 'TempPassw0rd99');
  assert.equal(login.json.user.mustChangePassword, true);
  const blocked = await c.get('/api/admin/bootstrap');
  assert.equal(blocked.status, 403); assert.equal(blocked.json.code, 'PASSWORD_CHANGE_REQUIRED');

  const weak = await c.post('/api/auth/change-password', { currentPassword: 'TempPassw0rd99', newPassword: 'short1' });
  assert.equal(weak.status, 422);
  const noDigits = await c.post('/api/auth/change-password', { currentPassword: 'TempPassw0rd99', newPassword: 'onlyletterslongenough' });
  assert.equal(noDigits.status, 422);
  const badCurrent = await c.post('/api/auth/change-password', { currentPassword: 'wrong', newPassword: 'BrandNewPassw0rd' });
  assert.equal(badCurrent.status, 422);
  assert.equal((await c.post('/api/auth/change-password', { currentPassword: 'TempPassw0rd99', newPassword: 'BrandNewPassw0rd' })).status, 200);
  assert.equal((await c.get('/api/admin/bootstrap')).status, 200);
  // old password no longer works
  assert.equal((await app.client().login('temp@example.com', 'TempPassw0rd99')).status, 401);
  assert.equal((await app.client().login('temp@example.com', 'BrandNewPassw0rd')).status, 200);
});

test('roles: viewer reads only, coordinator writes but cannot delete/configure, admin can do everything', async () => {
  await app.makeUser('viewer', 'view@example.com', 'CorrectHorse123');
  await app.makeUser('coordinator', 'coord2@example.com', 'CorrectHorse123');
  const viewer = app.client(); await viewer.login('view@example.com', 'CorrectHorse123');
  const coord = app.client(); await coord.login('coord2@example.com', 'CorrectHorse123');
  const admin = await app.adminClient();

  assert.equal((await viewer.get('/api/admin/bootstrap')).status, 200);
  assert.equal((await viewer.post('/api/admin/venues', { name: 'Hall', code: 'H1' })).status, 403);
  assert.equal((await viewer.get('/api/admin/users')).status, 403);

  const v = await coord.post('/api/admin/venues', { name: 'Hall', code: 'H1' });
  assert.equal(v.status, 201);
  assert.equal((await coord.put(`/api/admin/venues/${v.json.id}`, { capacity: 50 })).status, 200);
  assert.equal((await coord.del(`/api/admin/venues/${v.json.id}`)).status, 403);
  assert.equal((await coord.put('/api/admin/settings', { eventName: 'Hacked' })).status, 403);
  assert.equal((await coord.get('/api/admin/users')).status, 403);

  assert.equal((await admin.del(`/api/admin/venues/${v.json.id}`)).status, 200);
});

test('admin users: cannot demote self or remove the last admin; password reset signs user out', async () => {
  const admin = await app.adminClient();
  const me = (await admin.get('/api/auth/me')).json.user;
  assert.equal((await admin.put(`/api/admin/users/${me.id}`, { role: 'viewer' })).status, 409);
  assert.equal((await admin.put(`/api/admin/users/${me.id}`, { active: false })).status, 409);

  const created = await admin.post('/api/admin/users', { email: 'newbie@example.com', name: 'New Bie', role: 'coordinator', password: 'Welcome12345' });
  assert.equal(created.status, 201);
  assert.equal((await admin.post('/api/admin/users', { email: 'newbie@example.com', name: 'Dup', role: 'viewer', password: 'Welcome12345' })).status, 422);
  assert.equal((await admin.post('/api/admin/users', { email: 'weak@example.com', name: 'Weak', role: 'viewer', password: 'abc' })).status, 422);

  const u = app.client(); await u.login('newbie@example.com', 'Welcome12345');
  const reset = await admin.put(`/api/admin/users/${created.json.id}`, { password: 'AnotherPass789' });
  assert.equal(reset.status, 200);
  assert.equal((await u.get('/api/auth/me')).json.user, null, 'old session ended');
  assert.equal((await admin.put(`/api/admin/users/${created.json.id}`, { active: false })).status, 200);
  assert.equal((await app.client().login('newbie@example.com', 'AnotherPass789')).status, 401, 'disabled accounts cannot sign in');
});
