'use strict';
const { AppError } = require('./util');

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Field spec types: string, email, enum, int, bool, array, time, date, iso, id, url
 * Returns the cleaned value or throws a string message.
 */
function check(spec, raw, label) {
  const t = spec.type;
  if (raw === undefined || raw === null || raw === '') {
    if (spec.required) throw `${label} is required.`;
    if (t === 'int') return spec.nullable === false ? 0 : null;
    if (t === 'bool') return false;
    if (t === 'array') return [];
    if (t === 'id' || t === 'enum') { if (spec.default !== undefined) return spec.default; return spec.nullable ? null : ''; }
    return '';
  }
  switch (t) {
    case 'string': case 'email': case 'url': {
      if (typeof raw !== 'string') throw `${label} must be text.`;
      const v = raw.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').trim();
      if (spec.required && !v) throw `${label} is required.`;
      if (spec.min && v.length < spec.min) throw `${label} must be at least ${spec.min} characters.`;
      if (v.length > (spec.max || 500)) throw `${label} must be at most ${spec.max || 500} characters.`;
      if (t === 'email' && !EMAIL.test(v)) throw `${label} must be a valid email address.`;
      if (t === 'url') { try { const u = new URL(v); if (!/^https?:$/.test(u.protocol)) throw 0; } catch (e) { throw `${label} must be an http(s) link.`; } }
      if (spec.pattern && !spec.pattern.test(v)) throw spec.patternMsg || `${label} is not valid.`;
      return t === 'email' ? v.toLowerCase() : v;
    }
    case 'enum':
      if (!spec.values.includes(raw)) throw `${label} must be one of: ${spec.values.join(', ')}.`;
      return raw;
    case 'int': {
      const n = Number(raw);
      if (!Number.isInteger(n) || n < (spec.min ?? 0) || n > (spec.max ?? 1000000)) throw `${label} must be a whole number between ${spec.min ?? 0} and ${spec.max ?? 1000000}.`;
      return n;
    }
    case 'bool':
      if (typeof raw !== 'boolean') throw `${label} must be true or false.`;
      return raw;
    case 'array': {
      if (!Array.isArray(raw)) throw `${label} must be a list.`;
      if (raw.length > (spec.maxItems || 40)) throw `${label} has too many items.`;
      return raw.map(x => {
        if (typeof x !== 'string') throw `${label} must contain text only.`;
        const v = x.trim();
        if (v.length > (spec.maxLen || 120)) throw `${label} has an item that is too long.`;
        return v;
      }).filter(Boolean);
    }
    case 'time':
      if (typeof raw !== 'string' || !TIME.test(raw)) throw `${label} must be a time like 09:30.`;
      return raw;
    case 'date':
      if (typeof raw !== 'string' || !DATE.test(raw) || isNaN(Date.parse(raw))) throw `${label} must be a date like 2026-01-31.`;
      return raw;
    case 'iso':
      if (typeof raw !== 'string' || isNaN(Date.parse(raw))) throw `${label} must be a valid date-time.`;
      return new Date(raw).toISOString();
    case 'id':
      if (typeof raw !== 'string' || !/^[A-Za-z0-9_-]{1,64}$/.test(raw)) throw `${label} is not valid.`;
      return raw;
    default:
      throw `${label} has an unsupported type.`;
  }
}

/** Validate `body` against `fields`. With partial=true only supplied keys are checked. */
function validate(fields, body, partial) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new AppError(400, 'Request body must be a JSON object.');
  const out = {}; const errors = {};
  for (const [key, spec] of Object.entries(fields)) {
    if (partial && !(key in body)) continue;
    if (spec.readonly) continue;
    try { out[key] = check(spec, body[key], spec.label || key); } catch (m) { errors[key] = String(m); }
  }
  if (Object.keys(errors).length) throw new AppError(422, 'Please fix the highlighted fields.', { errors });
  return out;
}

const toMin = t => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };

module.exports = { validate, check, toMin, TIME, DATE };
