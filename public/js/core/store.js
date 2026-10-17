/* ==========================================================
   Data layer — API-backed.
   Reads are served synchronously from an in-memory copy that is
   loaded from the server at page start. Every write goes to the
   server first and the copy is updated from the server's reply,
   so what you see is what the database holds.
   ========================================================== */
const Store = (() => {
  'use strict';
  const state = { settings: {}, volunteers: [], teams: [], venues: [], shifts: [], assignments: [], sessions: [], announcements: [], attendance: [], activity: [] };
  const listeners = new Set();
  let me = null;
  const notify = () => listeners.forEach(fn => { try { fn(); } catch (e) { console.error(e); } });
  const area = () => document.body.dataset.area;

  async function init() {
    const admin = area() === 'admin';
    const data = await Api.get(admin ? '/api/admin/bootstrap' : '/api/public/bootstrap');
    me = data.me || null;
    delete data.me;
    Object.assign(state, data);
  }

  /** Re-read everything from the server (used by the admin auto-refresh). */
  async function refresh() {
    const data = await Api.get('/api/admin/bootstrap');
    me = data.me || me;
    delete data.me;
    Object.assign(state, data);
    notify();
  }

  const list = coll => state[coll] || [];
  const get = (coll, id) => list(coll).find(r => r.id === id) || null;
  const put = (coll, rec) => {
    const i = state[coll].findIndex(r => r.id === rec.id);
    if (i >= 0) state[coll][i] = rec; else state[coll].push(rec);
  };

  async function reload(colls) {
    for (const c of colls) state[c] = await Api.get(`/api/admin/${c}`);
  }
  async function applyReload(res) {
    const hdr = res.headers.get('X-Reload');
    if (hdr) await reload(hdr.split(',').filter(Boolean));
  }

  async function insert(coll, record) {
    const { data, res } = await Api.raw('POST', `/api/admin/${coll}`, record);
    put(coll, data); await applyReload(res); notify(); return data;
  }
  async function update(coll, id, patch) {
    const { data, res } = await Api.raw('PUT', `/api/admin/${coll}/${encodeURIComponent(id)}`, patch);
    put(coll, data); await applyReload(res); notify(); return data;
  }
  /** Attendance is keyed by assignment id and created on first mark. */
  async function upsert(coll, record) {
    if (coll !== 'attendance') throw new Error('upsert is only used for attendance');
    const { id, status, checkIn, notes } = record;
    const { data } = await Api.raw('PUT', `/api/admin/attendance/${encodeURIComponent(id)}`, { status, checkIn, notes });
    put(coll, data); notify(); return data;
  }
  async function remove(coll, id) {
    const { res } = await Api.raw('DELETE', `/api/admin/${coll}/${encodeURIComponent(id)}`);
    state[coll] = state[coll].filter(r => r.id !== id);
    await applyReload(res); notify();
  }

  const settings = () => state.settings;
  async function updateSettings(patch) {
    state.settings = await Api.put('/api/admin/settings', patch);
    notify();
    return state.settings;
  }

  /** Activity is written by the server for every change; kept for call-site compatibility. */
  const log = () => {};
  const subscribe = fn => { listeners.add(fn); return () => listeners.delete(fn); };

  return { init, refresh, list, get, insert, update, upsert, remove, reload, settings, updateSettings, log, subscribe, me: () => me };
})();
