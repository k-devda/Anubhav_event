'use strict';
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { start } = require('./helpers');
const { ensureFirstAdmin } = require('../server/bootstrap');

let app;
before(async () => { app = await start(); });
after(async () => { await app.close(); });

test('/healthz answers without signing in', async () => {
  const r = await fetch(app.base + '/healthz');
  assert.equal(r.status, 200);
  assert.deepEqual(await r.json(), { ok: true });
});

test('first admin is created from environment settings once, and never overwrites an existing admin', async () => {
  const logs = [];
  const log = m => logs.push(m);
  assert.equal(await ensureFirstAdmin(app.db, {}, log), 'none');
  assert.equal(await ensureFirstAdmin(app.db, { ADMIN_EMAIL: 'bad', ADMIN_PASSWORD: 'GoodPassw0rd99' }, log), 'invalid');
  assert.equal(await ensureFirstAdmin(app.db, { ADMIN_EMAIL: 'boss@example.com', ADMIN_PASSWORD: 'weak' }, log), 'invalid');
  assert.equal(await ensureFirstAdmin(app.db, { ADMIN_EMAIL: 'boss@example.com', ADMIN_PASSWORD: 'GoodPassw0rd99', ADMIN_NAME: 'Boss' }, log), 'created');
  assert.ok(!logs.join(' ').includes('GoodPassw0rd99'), 'password is never logged');
  // second run: an admin exists, so nothing changes (even with a different password)
  assert.equal(await ensureFirstAdmin(app.db, { ADMIN_EMAIL: 'boss@example.com', ADMIN_PASSWORD: 'AnotherPassw0rd77' }, log), 'exists');
  const c = app.client();
  assert.equal((await c.login('boss@example.com', 'AnotherPassw0rd77')).status, 401);
  const ok = await c.login('boss@example.com', 'GoodPassw0rd99');
  assert.equal(ok.status, 200);
  assert.equal(ok.json.user.mustChangePassword, true, 'forced to choose a new password');
});

test('malformed request targets get 400 and never crash the server', async () => {
  const http = require('node:http');
  const raw = target => new Promise((resolve, reject) => {
    const u = new URL(app.base);
    const req = http.request({ host: u.hostname, port: u.port, method: 'GET', path: target }, res => { res.resume(); res.on('end', () => resolve(res.statusCode)); });
    req.on('error', reject); req.end();
  });
  for (const target of ['//', '//evil.example/x', '//api/admin/bootstrap']) assert.equal(await raw(target), 400, target);
  assert.equal((await fetch(app.base + '/healthz')).status, 200, 'server still alive');
});

test('a fresh database starts with the real event days and the SLS Building venue', async () => {
  const { seedEventBasics } = require('../server/bootstrap');
  const pub = (await app.client().get('/api/public/bootstrap')).json.settings;
  assert.deepEqual(pub.days.map(d => [d.label, d.date]), [['Event Day 1', '2026-10-27'], ['Event Day 2', '2026-10-28']]);
  assert.equal(pub.eventInfo.venue, 'SLS Building');
  // the app already seeded the venue while preparing the new database, so a repeat adds nothing
  assert.equal(await seedEventBasics(app.db), false, 'never adds a second venue');
  assert.deepEqual((await app.db.all('SELECT name, code FROM venues')).map(v => [v.name, v.code]), [['SLS Building', 'SLS']]);
});
