'use strict';
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const config = require('./config');
const { AppError, now } = require('./util');
const { check } = require('./validate');

/** The browser seed file is the single source for default settings and the optional demo dataset. */
function loadSeed() {
  const code = fs.readFileSync(path.join(__dirname, 'demo-seed.js'), 'utf8');
  const sandbox = { window: {} };
  vm.runInNewContext(code, sandbox);
  return sandbox.window.AnubhavSeed.build();
}

const REG_KEYS = ['institution', 'course', 'year', 'skills', 'areas', 'availability', 'experience', 'notes'];
const VIS_KEYS = ['teams', 'schedule', 'announcements', 'findRole', 'registration', 'rosterNames'];

function defaults() {
  const s = loadSeed().settings;
  s.visibility.rosterNames = true;
  return s;
}

function get(db) {
  const row = db.prepare("SELECT value FROM settings WHERE key = 'main'").get();
  if (!row) { const d = defaults(); db.prepare("INSERT INTO settings (key,value,updated_at) VALUES ('main',?,?)").run(JSON.stringify(d), now()); return d; }
  const s = JSON.parse(row.value);
  if (s.visibility && s.visibility.rosterNames === undefined) s.visibility.rosterNames = true;
  return s;
}

const need = (cond, key, msg) => { if (!cond) throw { key, msg }; };

/** Validate a full settings object. Returns cleaned copy or throws AppError 422. */
function validateSettings(input) {
  const errors = {};
  const out = {};
  const run = (key, fn) => { try { out[key] = fn(); } catch (e) { errors[e && e.key || key] = e && e.msg || String(e); } };
  const o = input && typeof input === 'object' ? input : {};
  const S = (spec, v, label) => { try { return check(spec, v, label); } catch (m) { throw { key: label, msg: String(m) }; } };

  run('eventName', () => S({ type: 'string', required: true, max: 80 }, o.eventName, 'eventName'));
  run('subtitle', () => S({ type: 'string', required: true, max: 120 }, o.subtitle, 'subtitle'));
  run('presenter', () => S({ type: 'string', max: 120 }, o.presenter, 'presenter'));
  run('organizers', () => {
    need(Array.isArray(o.organizers) && o.organizers.length >= 1 && o.organizers.length <= 10, 'organizers', 'Keep between 1 and 10 organizers.');
    return o.organizers.map(x => ({ name: S({ type: 'string', required: true, max: 120 }, x && x.name, 'organizers'), role: S({ type: 'string', max: 80 }, x && x.role, 'organizers') }));
  });
  run('timezone', () => {
    const tz = S({ type: 'string', required: true, max: 60 }, o.timezone, 'timezone');
    try { new Intl.DateTimeFormat('en', { timeZone: tz }); } catch (e) { throw { key: 'timezone', msg: 'Unknown timezone.' }; }
    return tz;
  });
  run('days', () => {
    need(Array.isArray(o.days) && o.days.length >= 1 && o.days.length <= 10, 'days', 'Provide 1 to 10 event days.');
    const seen = new Set();
    return o.days.map(d => {
      const id = S({ type: 'string', required: true, max: 30, pattern: /^[a-z0-9-]+$/ }, d && d.id, 'days');
      need(!seen.has(id), 'days', 'Duplicate day id.'); seen.add(id);
      return { id, label: S({ type: 'string', required: true, max: 60 }, d.label, 'days'), date: S({ type: 'date' }, d.date, 'days'), note: S({ type: 'string', max: 120 }, d.note, 'days') };
    });
  });
  run('idFormat', () => {
    const f = o.idFormat || {};
    return { prefix: S({ type: 'string', max: 8, pattern: /^[A-Za-z0-9-]*$/ }, f.prefix, 'idFormat'), digits: S({ type: 'int', required: true, min: 1, max: 8 }, f.digits, 'idFormat') };
  });
  run('assignmentInstructions', () => S({ type: 'string', max: 2000 }, o.assignmentInstructions, 'assignmentInstructions'));
  run('visibility', () => {
    const v = o.visibility || {};
    return Object.fromEntries(VIS_KEYS.map(k => [k, v[k] !== false]));
  });
  run('contact', () => {
    const c = o.contact || {};
    return { email: S({ type: 'string', max: 160 }, c.email, 'contact'), phone: S({ type: 'string', max: 60 }, c.phone, 'contact'), helpdesk: S({ type: 'string', max: 160 }, c.helpdesk, 'contact') };
  });
  run('eventInfo', () => {
    const e = o.eventInfo || {};
    return { date: S({ type: 'string', max: 120 }, e.date, 'eventInfo'), venue: S({ type: 'string', max: 160 }, e.venue, 'eventInfo') };
  });
  run('registrationFields', () => {
    const r = o.registrationFields || {};
    return Object.fromEntries(REG_KEYS.map(k => {
      const show = !(r[k] && r[k].show === false);
      return [k, { show, required: show && !!(r[k] && r[k].required) }];
    }));
  });
  if (Object.keys(errors).length) throw new AppError(422, 'Please fix the highlighted settings.', { errors });
  return out;
}

function save(db, value) {
  db.prepare("INSERT INTO settings (key,value,updated_at) VALUES ('main',?,?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at")
    .run(JSON.stringify(value), now());
}

module.exports = { loadSeed, defaults, get, save, validateSettings };
