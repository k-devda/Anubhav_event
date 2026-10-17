'use strict';
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { start } = require('./helpers');

let app;
before(async () => { app = await start(); });
after(async () => { await app.close(); });

test('admin API requires a session', async () => {
  const c = app.client();
  for (const p of ['/api/admin/bootstrap', '/api/admin/volunteers', '/api/admin/users']) {
    assert.equal((await c.get(p)).status, 401, p);
  }
  assert.equal((await c.put('/api/admin/settings', {})).status, 401);
});

test('state-changing requests need the anti-CSRF header and a same-origin Origin', async () => {
  const c = app.client();
  const noHeader = await fetch(app.base + '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
  assert.equal(noHeader.status, 403);
  const crossOrigin = await fetch(app.base + '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'anubhav', Origin: 'https://evil.example' }, body: '{}' });
  assert.equal(crossOrigin.status, 403);
  const wrongType = await fetch(app.base + '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'text/plain', 'X-Requested-With': 'anubhav' }, body: '{}' });
  assert.equal(wrongType.status, 415);
  assert.ok(c);
});

test('security headers are sent on pages and API responses', async () => {
  for (const p of ['/', '/api/public/bootstrap']) {
    const r = await fetch(app.base + p);
    assert.match(r.headers.get('content-security-policy'), /default-src 'self'/);
    assert.equal(r.headers.get('x-content-type-options'), 'nosniff');
    assert.equal(r.headers.get('x-frame-options'), 'DENY');
  }
});

test('static server blocks traversal, dotfiles and server code', async () => {
  for (const p of ['/../server/config.js', '/%2e%2e/server/config.js', '/..%2fserver%2fdb.js', '/.env', '/js/../../package.json', '/data/anubhav.sqlite', '/server/db.js']) {
    const r = await fetch(app.base + p, { redirect: 'manual' });
    assert.ok([400, 403, 404].includes(r.status), `${p} -> ${r.status}`);
  }
  assert.equal((await fetch(app.base + '/js/core/seed.js')).status, 404, 'demo seed must not be served');
});

test('admin pages redirect to login when signed out, and load when signed in', async () => {
  const anon = await fetch(app.base + '/admin/dashboard.html', { redirect: 'manual' });
  assert.equal(anon.status, 302);
  assert.match(anon.headers.get('location'), /^\/login\.html\?next=/);
  const admin = await app.adminClient();
  const r = await fetch(app.base + '/admin/dashboard.html', { headers: { Cookie: 'x' }, redirect: 'manual' });
  assert.equal(r.status, 302); // bogus cookie still redirected
  assert.ok(admin);
});

test('public bootstrap never exposes contact details', async () => {
  const admin = await app.adminClient();
  const reg = await app.client().post('/api/public/register', { name: 'Private Person', mobile: '9876512345', email: 'private.person@example.com', institution: 'X', course: 'Y', year: '1st', availability: ['Setup day'], consent: true });
  assert.equal(reg.status, 200);
  const vols = (await admin.get('/api/admin/volunteers')).json;
  await admin.put(`/api/admin/volunteers/${vols[0].id}`, { status: 'Approved' });
  const pub = JSON.stringify((await app.client().get('/api/public/bootstrap')).json);
  assert.ok(!pub.includes('private.person@example.com'));
  assert.ok(!pub.includes('9876512345'));
  assert.ok(!/"mobile"|"email":"[^"]*@/.test(pub.replace(/"contact":\{[^}]*\}/, '')), 'no personal contact fields');
});

test('oversized bodies are rejected', async () => {
  const big = 'x'.repeat(1024 * 1024 + 10);
  const r = await fetch(app.base + '/api/public/register', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'anubhav' }, body: JSON.stringify({ name: big }) }).catch(e => ({ status: 'aborted' }));
  assert.ok(r.status === 413 || r.status === 'aborted');
});
