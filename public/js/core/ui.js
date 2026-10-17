/* ==========================================================
   UI helpers — icons, escaping, modal, confirm, toast, CSV,
   form field builders and small formatters.
   ========================================================== */
const UI = (() => {
  'use strict';

  const ICONS = {
    dashboard: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/>',
    users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
    clipboard: '<rect x="8" y="2" width="8" height="4" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="M9 14l2 2 4-4"/>',
    group: '<circle cx="12" cy="8" r="3"/><circle cx="5" cy="10" r="2"/><circle cx="19" cy="10" r="2"/><path d="M6 20v-1a6 6 0 0 1 12 0v1"/>',
    pin: '<path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    checksquare: '<path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>',
    megaphone: '<path d="M3 11v2a1 1 0 0 0 1 1h2l5 4V6L6 10H4a1 1 0 0 0-1 1Z"/><path d="M15 9a4 4 0 0 1 0 6"/><path d="M18 6a8 8 0 0 1 0 12"/>',
    chart: '<path d="M3 3v18h18"/><path d="M7 15v3"/><path d="M12 10v8"/><path d="M17 6v12"/>',
    settings: '<line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/><line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="17" y1="16" x2="23" y2="16"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    x: '<path d="M18 6L6 18M6 6l12 12"/>',
    menu: '<path d="M3 6h18M3 12h18M3 18h18"/>',
    eye: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',
    eyeoff: '<path d="M17.9 17.9A10.1 10.1 0 0 1 12 19c-6 0-10-7-10-7a18 18 0 0 1 4.1-4.9M9.9 5.1A9.7 9.7 0 0 1 12 5c6 0 10 7 10 7a18 18 0 0 1-2.2 3.2M1 1l22 22"/>',
    edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
    trash: '<path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14H6L5 6"/>',
    archive: '<rect x="2" y="3" width="20" height="5" rx="1"/><path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8"/><path d="M10 12h4"/>',
    check: '<path d="M20 6L9 17l-5-5"/>',
    alert: '<path d="M10.3 3.9L1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z"/><path d="M12 9v4M12 17h.01"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 16v-4M12 8h.01"/>',
    download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M7 10l5 5 5-5"/><path d="M12 15V3"/>',
    print: '<path d="M6 9V2h12v7"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/>',
    calendar: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
    chevdown: '<path d="M6 9l6 6 6-6"/>',
    chevright: '<path d="M9 6l6 6-6 6"/>',
    chevleft: '<path d="M15 6l-6 6 6 6"/>',
    logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="M16 17l5-5-5-5"/><path d="M21 12H9"/>',
    home: '<path d="M3 11l9-8 9 8"/><path d="M5 10v10h14V10"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21v-1a6 6 0 0 1 16 0v1"/>',
    shield: '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6Z"/>',
    refresh: '<path d="M21 12a9 9 0 1 1-3-6.7L21 8"/><path d="M21 3v5h-5"/>',
    building: '<rect x="4" y="3" width="16" height="18" rx="1"/><path d="M9 7h2M13 7h2M9 11h2M13 11h2M9 15h2M13 15h2"/>',
    sort: '<path d="M7 4v16M7 20l-3-3M7 20l3-3M17 20V4M17 4l-3 3M17 4l3 3"/>',
    link: '<path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7"/><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7"/>',
    list: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
    gantt: '<path d="M3 5h8M7 12h10M5 19h12"/>',
    lock: '<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
    user_plus: '<circle cx="9" cy="8" r="4"/><path d="M2 21v-1a6 6 0 0 1 12 0v1"/><path d="M19 8v6M16 11h6"/>',
    book: '<path d="M4 4h6a4 4 0 0 1 4 4v12a3 3 0 0 0-3-3H4Z"/><path d="M20 4h-6a4 4 0 0 0-4 4"/><path d="M20 4v13h-5"/>',
    mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/>',
    heart: '<path d="M20.8 5.6a5.5 5.5 0 0 0-7.8 0L12 6.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1.1L12 22l7.8-7.5 1-1.1a5.5 5.5 0 0 0 0-7.8Z"/>'
  };

  function icon(name, size) {
    const s = size || 18;
    return `<svg class="icon" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] || ''}</svg>`;
  }

  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));
  function on(root, evt, sel, fn) {
    root.addEventListener(evt, e => { const t = e.target.closest(sel); if (t && root.contains(t)) fn(e, t); });
  }
  const initials = n => String(n || '?').split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase();

  /* ---------- Formatters ---------- */
  function fmtTime(t) {
    if (!t) return '—';
    const [h, m] = t.split(':').map(Number);
    return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
  }
  const fmtRange = (a, b) => (!a && !b ? 'Time TBC' : `${fmtTime(a)} – ${fmtTime(b)}`);
  function fmtDate(iso) {
    if (!iso) return '—';
    const d = new Date(iso);
    return isNaN(d) ? iso : d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  }
  function timeAgo(iso) {
    const diff = Date.now() - new Date(iso).getTime();
    const m = Math.round(diff / 60000);
    if (m < 1) return 'just now';
    if (m < 60) return `${m} min ago`;
    const h = Math.round(m / 60);
    if (h < 24) return `${h} hr ago`;
    const d = Math.round(h / 24);
    return `${d} day${d > 1 ? 's' : ''} ago`;
  }

  /* ---------- Badges ---------- */
  const TONES = {
    Approved: 'ok', Active: 'ok', Present: 'ok', Published: 'ok', Assigned: 'ok',
    Pending: 'warn', Draft: 'warn', Late: 'warn', 'Not Marked': '', Unassigned: 'warn',
    Rejected: 'bad', Absent: 'bad', Cancelled: 'bad', High: 'bad',
    Archived: '', Excused: 'info', Normal: 'gold', Low: '', Inactive: ''
  };
  function badge(text, tone) {
    const t = tone !== undefined ? tone : TONES[text];
    return `<span class="badge${t ? ' badge-' + t : ''}">${esc(text)}</span>`;
  }

  /* ---------- Toast ---------- */
  function toast(message, type) {
    let box = document.getElementById('toasts');
    if (!box) { box = document.createElement('div'); box.id = 'toasts'; box.setAttribute('role', 'status'); box.setAttribute('aria-live', 'polite'); document.body.appendChild(box); }
    const el = document.createElement('div');
    el.className = 'toast' + (type === 'error' ? ' toast-bad' : '');
    el.innerHTML = `${icon(type === 'error' ? 'alert' : 'check')}<span>${esc(message)}</span>`;
    box.appendChild(el);
    setTimeout(() => el.remove(), 3800);
  }

  /* ---------- Modal ---------- */
  const stack = [];
  function openModal(opts) {
    const root = document.createElement('div');
    root.className = 'modal-backdrop';
    const titleId = 'modal-title-' + Math.random().toString(36).slice(2, 7);
    root.innerHTML = `<div class="modal ${opts.drawer ? 'modal-drawer' : ''} modal-${opts.size || 'md'}" role="dialog" aria-modal="true" aria-labelledby="${titleId}">
      <header class="modal-head"><h2 id="${titleId}">${opts.title || ''}</h2><button type="button" class="btn btn-icon btn-ghost" data-close aria-label="Close dialog">${icon('x')}</button></header>
      <div class="modal-body">${opts.body || ''}</div>
      ${opts.footer ? `<footer class="modal-foot">${opts.footer}</footer>` : ''}
    </div>`;
    document.body.appendChild(root);
    document.body.classList.add('modal-open');
    const previous = document.activeElement;
    const api = {
      el: root,
      body: root.querySelector('.modal-body'),
      foot: root.querySelector('.modal-foot'),
      setTitle(t) { root.querySelector('h2').innerHTML = t; },
      close(result) {
        const i = stack.indexOf(api); if (i >= 0) stack.splice(i, 1);
        root.remove();
        if (!stack.length) document.body.classList.remove('modal-open');
        if (previous && previous.focus && document.contains(previous)) previous.focus();
        if (opts.onClose) opts.onClose(result);
      }
    };
    root.addEventListener('mousedown', e => { if (e.target === root) api.close(); });
    root.addEventListener('click', e => { if (e.target.closest('[data-close]')) api.close(); });
    stack.push(api);
    if (opts.onOpen) opts.onOpen(api);
    const focusTarget = root.querySelector('[autofocus]') || root.querySelector('input:not([type=hidden]), select, textarea, .modal-body button') || root.querySelector('[data-close]');
    if (focusTarget) focusTarget.focus();
    return api;
  }
  document.addEventListener('keydown', e => {
    if (!stack.length) return;
    const top = stack[stack.length - 1];
    if (e.key === 'Escape') { top.close(); return; }
    if (e.key === 'Tab') {
      const f = $$('a[href], button:not(:disabled), input:not(:disabled):not([type=hidden]), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])', top.el).filter(n => n.offsetParent !== null);
      if (!f.length) return;
      const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });

  function confirmDialog(o) {
    return new Promise(resolve => {
      let settled = false;
      const done = v => { if (!settled) { settled = true; resolve(v); } };
      const m = openModal({
        title: esc(o.title || 'Are you sure?'), size: 'sm',
        body: `<p>${o.message || ''}</p>`,
        footer: `<button type="button" class="btn btn-secondary" data-close>Cancel</button><button type="button" class="btn ${o.danger ? 'btn-danger' : 'btn-primary'}" data-ok>${esc(o.confirmLabel || 'Confirm')}</button>`,
        onClose: () => done(false)
      });
      m.el.querySelector('[data-ok]').addEventListener('click', () => { done(true); m.close(); });
      m.el.querySelector('[data-ok]').focus();
    });
  }

  /* ---------- Form field builders ---------- */
  function fieldHtml(o) {
    const id = o.id;
    const req = o.required ? '<span class="req" aria-hidden="true">*</span>' : '';
    const common = `id="${id}" name="${o.name || id}"${o.required ? ' required aria-required="true"' : ''}${o.placeholder ? ` placeholder="${esc(o.placeholder)}"` : ''}${o.autocomplete ? ` autocomplete="${o.autocomplete}"` : ''}${o.attrs || ''} aria-describedby="${id}-err${o.hint ? ' ' + id + '-hint' : ''}"`;
    let control;
    if (o.type === 'select') {
      const opts = (o.options || []).map(x => {
        const v = typeof x === 'object' ? x.value : x; const l = typeof x === 'object' ? x.label : x;
        return `<option value="${esc(v)}"${String(o.value) === String(v) ? ' selected' : ''}>${esc(l)}</option>`;
      }).join('');
      control = `<select class="select" ${common}>${opts}</select>`;
    } else if (o.type === 'textarea') {
      control = `<textarea class="textarea" rows="${o.rows || 3}" ${common}>${esc(o.value || '')}</textarea>`;
    } else {
      control = `<input class="input" type="${o.type || 'text'}" value="${esc(o.value || '')}" ${common}>`;
    }
    return `<div class="field ${o.className || ''}" data-field="${o.name || id}">
      <label for="${id}">${esc(o.label)}${req}</label>${control}
      ${o.hint ? `<span class="hint" id="${id}-hint">${o.hint}</span>` : ''}
      <span class="field-error" id="${id}-err" role="alert"></span></div>`;
  }
  function checkGroupHtml(o) {
    return `<fieldset class="field ${o.className || ''}" data-group="${o.name}">
      <legend class="fieldset-label">${esc(o.label)}${o.required ? '<span class="req" aria-hidden="true">*</span>' : ''}</legend>
      <div class="check-grid">${o.options.map((x, i) => {
        const v = typeof x === 'object' ? x.value : x; const l = typeof x === 'object' ? x.label : x;
        return `<label class="check"><input type="checkbox" name="${o.name}" value="${esc(v)}"${(o.values || []).includes(v) ? ' checked' : ''}><span>${esc(l)}</span></label>`;
      }).join('')}</div>
      <span class="field-error" role="alert"></span></fieldset>`;
  }
  function setError(form, name, message) {
    const f = form.querySelector(`[data-field="${name}"], [data-group="${name}"]`);
    if (!f) return;
    f.classList.toggle('has-error', !!message);
    const err = f.querySelector('.field-error'); if (err) err.textContent = message || '';
    const input = f.querySelector('input,select,textarea');
    if (input && input.type !== 'checkbox') input.setAttribute('aria-invalid', message ? 'true' : 'false');
  }
  function clearErrors(form) { $$('.has-error', form).forEach(f => { f.classList.remove('has-error'); }); $$('.field-error', form).forEach(e => { e.textContent = ''; }); }
  const checked = (form, name) => $$(`input[name="${name}"]:checked`, form).map(i => i.value);
  const val = (form, name) => { const el = form.elements[name]; return el ? el.value.trim() : ''; };


  /* ---------- Server errors ---------- */
  function showApiError(err, form, map) {
    const e = err || {};
    if (form && e.errors) {
      Object.entries(e.errors).forEach(([k, msg]) => {
        const name = (map && map[k]) || k;
        if (msg && form.querySelector(`[data-field="${name}"], [data-group="${name}"]`)) setError(form, name, msg);
      });
    }
    toast(e.message || 'Something went wrong.', 'error');
  }
  /** Run an async action; shows a toast (and field errors) on failure. Resolves true on success. */
  async function attempt(fn, o) {
    o = o || {};
    if (o.btn) o.btn.disabled = true;
    try { await fn(); return true; }
    catch (e) {
      if (e && e.status === 401) { location.href = (document.body.dataset.root || '') + 'login.html?next=' + encodeURIComponent(location.pathname); return false; }
      showApiError(e, o.form, o.map); return false;
    } finally { if (o.btn) o.btn.disabled = false; }
  }

  function stateBlock(o) {
    return `<div class="state"><span class="state-icon">${icon(o.icon || 'info', 26)}</span><h3>${esc(o.title)}</h3><p>${o.text || ''}</p>${o.action || ''}</div>`;
  }

  /* ---------- CSV (formula-injection safe) ---------- */
  function toCSV(columns, rows) {
    const cell = v => {
      let s = v == null ? '' : String(v);
      if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
      return `"${s.replace(/"/g, '""')}"`;
    };
    return [columns.map(c => cell(c.label)).join(','), ...rows.map(r => columns.map(c => cell(r[c.key])).join(','))].join('\r\n');
  }
  function downloadCSV(filename, columns, rows) {
    const blob = new Blob(['﻿' + toCSV(columns, rows)], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast(`Exported ${rows.length} row${rows.length === 1 ? '' : 's'} to ${filename}`);
  }

  const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
  function paginate(items, page, size) {
    const pages = Math.max(1, Math.ceil(items.length / size));
    const p = Math.min(Math.max(1, page), pages);
    return { page: p, pages, total: items.length, slice: items.slice((p - 1) * size, p * size), from: items.length ? (p - 1) * size + 1 : 0, to: Math.min(items.length, p * size) };
  }
  function paginationHtml(pg, noun) {
    const btns = [];
    for (let i = 1; i <= pg.pages; i++) btns.push(`<button type="button" class="btn btn-sm ${i === pg.page ? 'btn-primary' : 'btn-secondary'}" data-page="${i}" aria-label="Page ${i}"${i === pg.page ? ' aria-current="page"' : ''}>${i}</button>`);
    return `<div class="pagination"><span>Showing ${pg.from}–${pg.to} of ${pg.total} ${noun}</span><div class="pages">${pg.pages > 1 ? btns.join('') : ''}</div></div>`;
  }

  return { showApiError, attempt, icon, esc, $, $$, on, initials, fmtTime, fmtRange, fmtDate, timeAgo, badge, toast, openModal, confirm: confirmDialog, fieldHtml, checkGroupHtml, setError, clearErrors, checked, val, stateBlock, toCSV, downloadCSV, debounce, paginate, paginationHtml };
})();
