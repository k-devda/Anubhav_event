Boot.run(() => {
  'use strict';
  const { icon, esc, badge, $, $$, on, fieldHtml, setError, val } = UI;
  const main = document.getElementById('main');
  if (!Shell.can('settings')) {
    main.innerHTML = `${Shell.pageHead('Settings', '')}<div class="card">${UI.stateBlock({ icon: 'lock', title: 'Administrators only', text: 'Settings and user accounts can only be changed by an administrator.', action: '<a class="btn btn-primary" href="dashboard.html">Back to dashboard</a>' })}</div>`;
    return;
  }
  let section = 'event';
  const SECTIONS = [['event', 'Event details'], ['days', 'Event days'], ['organizers', 'Organizers'], ['timezone', 'Timezone'], ['fields', 'Registration form'], ['idformat', 'Volunteer ID format'], ['instructions', 'Assignment instructions'], ['visibility', 'Public pages'], ['contact', 'Contact details'], ['users', 'Admin users']];
  const TZ = ['Asia/Kolkata', 'Asia/Dubai', 'Asia/Singapore', 'Europe/London', 'America/New_York', 'UTC'];
  const FIELD_LABELS = { institution: 'College / institution', course: 'Course or department', year: 'Year of study', skills: 'Skills', areas: 'Preferred volunteering areas', availability: 'Availability', experience: 'Previous experience', notes: 'Additional notes' };
  const VIS_LABELS = { registration: 'Volunteer Registration', findRole: 'Find My Role', teams: 'Teams', schedule: 'Event Schedule', announcements: 'Announcements', rosterNames: 'Member names on team pages' };
  const ROLES = { admin: 'Administrator — full access', coordinator: 'Coordinator — manage volunteers, assignments, attendance', viewer: 'Viewer — read-only' };
  let users = [];

  main.innerHTML = `${Shell.pageHead('Settings', 'Event details, public page controls and admin accounts. Changes are saved to the database.')}
    <div class="settings-layout"><nav class="card report-nav" aria-label="Settings sections">${SECTIONS.map(([k, l]) => `<button type="button" data-sec="${k}">${l}</button>`).join('')}</nav><div id="panel"></div></div>`;

  const clone = o => JSON.parse(JSON.stringify(o));
  async function saveSettings(patch, form, msg) {
    const ok = await UI.attempt(() => Store.updateSettings(Object.assign(clone(Store.settings()), patch)), { form });
    if (ok) UI.toast(msg || 'Settings saved');
    return ok;
  }
  const panelWrap = (title, desc, body, saveBtn) => `<section class="card"><div class="card-head"><div><h2>${title}</h2><div class="muted small">${desc || ''}</div></div></div><form class="card-body" id="sform" novalidate>${body}${saveBtn === false ? '' : `<div class="row" style="margin-top:var(--s-5)"><button class="btn btn-primary" type="submit">Save changes</button></div>`}</form></section>`;
  const dayRow = (d, i) => `<div class="row day-row" data-id="${esc(d.id || '')}"><div class="field" style="flex:2;min-width:180px"><label class="sr-only" for="day-l${i}">Day name</label><input class="input" id="day-l${i}" name="day-label" value="${esc(d.label)}" placeholder="e.g. Event Day 1" maxlength="60"></div><div class="field" style="flex:1;min-width:160px"><label class="sr-only" for="day-d${i}">Date</label><input class="input" id="day-d${i}" name="day-date" type="date" value="${esc(d.date || '')}"></div><button type="button" class="btn btn-danger-ghost btn-icon" data-rm-day aria-label="Remove day">${icon('trash', 16)}</button></div>`;
  const orgRow = (o, i) => `<div class="row org-row" data-i="${i}"><div class="field" style="flex:2;min-width:180px"><label class="sr-only" for="org-n${i}">Organizer name</label><input class="input" id="org-n${i}" name="org-name" value="${esc(o.name)}" placeholder="Organizer name" maxlength="120"></div><div class="field" style="flex:1;min-width:140px"><label class="sr-only" for="org-r${i}">Role</label><input class="input" id="org-r${i}" name="org-role" value="${esc(o.role)}" placeholder="Role" maxlength="80"></div><button type="button" class="btn btn-danger-ghost btn-icon" data-rm-org aria-label="Remove organizer">${icon('trash', 16)}</button></div>`;

  const RENDER = {
    event(s) {
      return panelWrap('Event details', 'Shown on the home page, header and footer.', `<div class="field-grid">
        ${fieldHtml({ id: 's-name', name: 'eventName', label: 'Event name', required: true, value: s.eventName })}
        ${fieldHtml({ id: 's-sub', name: 'subtitle', label: 'Subtitle', required: true, value: s.subtitle })}
        ${fieldHtml({ id: 's-pres', name: 'presenter', label: 'Presented-by line', value: s.presenter, className: 'span-2' })}
        ${fieldHtml({ id: 's-date', name: 'date', label: 'Event date text', value: s.eventInfo.date, hint: 'Keep the placeholder until the date is confirmed.' })}
        ${fieldHtml({ id: 's-venue', name: 'venue', label: 'Event venue text', value: s.eventInfo.venue })}</div>`);
    },
    days(s) {
      return panelWrap('Event days', 'The dates volunteers and admins pick from when creating shifts, sessions and assignments. A day that is already used cannot be removed.', `<div id="day-list" class="stack-sm">${s.days.map((d, i) => dayRow(d, i)).join('')}</div><button class="btn btn-secondary btn-sm" type="button" id="add-day" style="margin-top:var(--s-3)">${icon('plus', 14)} Add day</button>`);
    },
    organizers(s) {
      return panelWrap('Organizer details', 'Listed in the footer and login screen.', `<div id="org-list" class="stack-sm">${s.organizers.map((o, i) => orgRow(o, i)).join('')}</div><button class="btn btn-secondary btn-sm" type="button" id="add-org" style="margin-top:var(--s-3)">${icon('plus', 14)} Add organizer</button>`);
    },
    timezone(s) {
      return panelWrap('Event timezone', 'Used for displaying shift and reporting times.', `<div class="field-grid">${fieldHtml({ id: 's-tz', name: 'timezone', label: 'Timezone', type: 'select', value: s.timezone, options: TZ.includes(s.timezone) ? TZ : [s.timezone, ...TZ] })}</div><p class="small muted" style="margin-top:var(--s-3)">Current time in this zone: <strong id="tz-now"></strong></p>`);
    },
    fields(s) {
      return panelWrap('Registration form fields', 'Name, mobile, email and consent are always required. Choose what else the public form asks.', `<div class="settings-list">${Object.keys(FIELD_LABELS).map(k => `<div class="setting-row"><div><strong>${FIELD_LABELS[k]}</strong></div><div class="row"><label class="switch"><input type="checkbox" data-show="${k}"${s.registrationFields[k].show ? ' checked' : ''}><span>Show</span></label><label class="switch"><input type="checkbox" data-req="${k}"${s.registrationFields[k].required ? ' checked' : ''}${s.registrationFields[k].show ? '' : ' disabled'}><span>Required</span></label></div></div>`).join('')}</div>
        <p class="small" style="margin-top:var(--s-3)"><a href="../register.html" target="_blank" rel="noopener">Open the registration form to check →</a></p>`, false);
    },
    idformat(s) {
      return panelWrap('Volunteer ID format', 'Existing volunteers are re-displayed with the new format.', `<div class="field-grid">
        ${fieldHtml({ id: 's-prefix', name: 'prefix', label: 'Prefix', value: s.idFormat.prefix, attrs: ' maxlength="8"' })}
        ${fieldHtml({ id: 's-digits', name: 'digits', label: 'Number of digits', type: 'number', value: s.idFormat.digits, attrs: ' min="1" max="8"' })}</div>
        <p class="muted small" style="margin-top:var(--s-3)">Preview: <strong id="id-prev"></strong></p>`);
    },
    instructions(s) {
      return panelWrap('Default assignment instructions', 'Shown on Find My Role when an assignment has no special instructions of its own.', `<div class="field-grid">${fieldHtml({ id: 's-instr', name: 'instructions', label: 'Instructions', type: 'textarea', rows: 6, value: s.assignmentInstructions, className: 'span-2' })}</div>`);
    },
    visibility(s) {
      return panelWrap('Public page visibility', 'Hidden pages disappear from the navigation and show a notice if opened directly.', `<div class="settings-list">${Object.keys(VIS_LABELS).map(k => `<div class="setting-row"><div><strong>${VIS_LABELS[k]}</strong><div class="desc">${s.visibility[k] !== false ? 'Visible to the public' : 'Hidden'}</div></div><label class="switch"><input type="checkbox" data-vis="${k}"${s.visibility[k] !== false ? ' checked' : ''}><span class="sr-only">${VIS_LABELS[k]} visible</span></label></div>`).join('')}</div>`, false);
    },
    contact(s) {
      return panelWrap('Contact information', 'Shown in the public footer and on Find My Role.', `<div class="field-grid">
        ${fieldHtml({ id: 's-email', name: 'email', label: 'Contact email', value: s.contact.email })}
        ${fieldHtml({ id: 's-phone', name: 'phone', label: 'Contact phone', value: s.contact.phone })}
        ${fieldHtml({ id: 's-help', name: 'helpdesk', label: 'Helpdesk location', value: s.contact.helpdesk, className: 'span-2' })}</div>`);
    },
    users() {
      return `<section class="card"><div class="card-head"><div><h2>Admin users</h2><div class="muted small">Who can sign in to this dashboard, and what they can do.</div></div><button class="btn btn-primary btn-sm" type="button" id="add-user">${icon('plus', 14)} Add user</button></div>
        <div id="users-area">${'<div class="card-body"><div class="skeleton" style="height:16px"></div></div>'}</div></section>`;
    }
  };

  async function loadUsers() {
    const area = $('#users-area'); if (!area) return;
    try { users = await Api.get('/api/admin/users'); } catch (e) { area.innerHTML = UI.stateBlock({ icon: 'alert', title: 'Could not load users', text: esc(e.message) }); return; }
    const me = Store.me();
    area.innerHTML = `<div class="table-wrap"><table class="table table-cards"><thead><tr><th>User</th><th>Role</th><th>Status</th><th>Last sign-in</th><th><span class="sr-only">Actions</span></th></tr></thead><tbody>
      ${users.map(u => `<tr><td data-label="User"><span class="cell-strong">${esc(u.name)}${u.id === me.id ? ' <span class="badge badge-brand">You</span>' : ''}</span><span class="cell-sub">${esc(u.email)}</span></td><td data-label="Role">${esc(u.role)}</td>
        <td data-label="Status">${u.active ? badge('Active', 'ok') : badge('Disabled', 'bad')}${u.mustChangePassword ? ' <span class="badge badge-warn">Temp password</span>' : ''}</td><td data-label="Last sign-in">${u.lastLoginAt ? UI.fmtDate(u.lastLoginAt) : 'Never'}</td>
        <td class="cell-actions"><div class="row-actions"><button class="btn btn-ghost btn-sm" data-user="${u.id}">${icon('edit', 14)} Edit</button></div></td></tr>`).join('')}</tbody></table></div>`;
  }

  function randomPassword() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
    const a = new Uint32Array(14); crypto.getRandomValues(a);
    return Array.from(a, n => chars[n % chars.length]).join('') + '7';
  }

  function userForm(id) {
    const u = id ? users.find(x => x.id === id) : { name: '', email: '', role: 'coordinator', active: true };
    const isSelf = id && id === Store.me().id;
    const m = UI.openModal({
      title: id ? 'Edit user' : 'Add user', size: 'md',
      body: `<form id="u-form" novalidate class="stack">
        ${fieldHtml({ id: 'u-name', name: 'name', label: 'Full name', required: true, value: u.name })}
        ${id ? `<div class="field"><span class="label">Email</span><div>${esc(u.email)}</div></div>` : fieldHtml({ id: 'u-email', name: 'email', label: 'Email', type: 'email', required: true, value: u.email, autocomplete: 'off' })}
        ${fieldHtml({ id: 'u-role', name: 'role', label: 'Role', type: 'select', value: u.role, options: Object.entries(ROLES).map(([v, l]) => ({ value: v, label: l })), attrs: isSelf ? ' disabled' : '' })}
        ${id ? `<label class="switch"><input type="checkbox" id="u-active" name="active"${u.active ? ' checked' : ''}${isSelf ? ' disabled' : ''}><span>Account active</span></label>` : ''}
        <div class="field" data-field="password"><label for="u-pass">${id ? 'Reset password (optional)' : 'Temporary password'}${id ? '' : '<span class="req" aria-hidden="true">*</span>'}</label>
          <div class="row" style="flex-wrap:nowrap"><input class="input" id="u-pass" name="password" type="text" autocomplete="new-password" placeholder="${id ? 'Leave blank to keep the current password' : 'At least 10 characters, letters and a number'}"><button class="btn btn-secondary" type="button" id="u-gen">Generate</button></div>
          <span class="hint">${id ? 'Setting a password signs the user out everywhere and forces a change at next sign-in.' : 'The user must change it at first sign-in. Share it securely.'}</span><span class="field-error" role="alert"></span></div>
      </form>`,
      footer: `<button class="btn btn-secondary" type="button" data-close>Cancel</button><button class="btn btn-primary" type="button" id="u-save">${id ? 'Save' : 'Create user'}</button>`
    });
    const f = $('#u-form', m.el);
    $('#u-gen', m.el).addEventListener('click', () => { $('#u-pass', m.el).value = randomPassword(); });
    $('#u-save', m.el).addEventListener('click', async e => {
      UI.clearErrors(f);
      const body = { name: val(f, 'name') };
      if (!isSelf) body.role = val(f, 'role');
      if (id && !isSelf) body.active = $('#u-active', m.el).checked;
      if (!id) { body.email = val(f, 'email'); body.password = val(f, 'password'); }
      else if (val(f, 'password')) body.password = val(f, 'password');
      const done = await UI.attempt(async () => {
        if (id) await Api.put(`/api/admin/users/${encodeURIComponent(id)}`, body);
        else await Api.post('/api/admin/users', body);
        UI.toast(id ? 'User updated' : 'User created');
      }, { form: f, btn: e.currentTarget });
      if (done) { m.close(); loadUsers(); }
    });
  }

  function draw() {
    $$('[data-sec]', main).forEach(b => b.setAttribute('aria-current', b.dataset.sec === section));
    $('#panel').innerHTML = RENDER[section](Store.settings());
    if (section === 'timezone') tz();
    if (section === 'idformat') idPrev();
    if (section === 'users') loadUsers();
  }
  function tz() { try { $('#tz-now').textContent = new Date().toLocaleString('en-IN', { timeZone: $('#s-tz').value, dateStyle: 'medium', timeStyle: 'short' }); } catch (e) { $('#tz-now').textContent = 'n/a'; } }
  function idPrev() { const p = $('#s-prefix').value, d = Math.min(8, Math.max(1, Number($('#s-digits').value) || 1)); $('#id-prev').textContent = p + '7'.padStart(d, '0'); }

  main.addEventListener('input', e => { if (e.target.id === 's-prefix' || e.target.id === 's-digits') idPrev(); });
  main.addEventListener('change', async e => {
    const t = e.target;
    if (t.id === 's-tz') tz();
    if (t.dataset.show || t.dataset.req) {
      const rf = clone(Store.settings().registrationFields);
      if (t.dataset.show) { rf[t.dataset.show].show = t.checked; if (!t.checked) rf[t.dataset.show].required = false; }
      else rf[t.dataset.req].required = t.checked;
      await saveSettings({ registrationFields: rf }, null, 'Registration form updated'); draw();
    }
    if (t.dataset.vis) {
      const vis = clone(Store.settings().visibility); vis[t.dataset.vis] = t.checked;
      if (await saveSettings({ visibility: vis }, null, `${VIS_LABELS[t.dataset.vis]} is now ${t.checked ? 'visible' : 'hidden'}`)) draw(); else draw();
    }
  });
  on(main, 'click', '[data-sec]', (e, t) => { section = t.dataset.sec; draw(); });
  on(main, 'click', '#add-day', () => { const l = $('#day-list'); l.insertAdjacentHTML('beforeend', dayRow({ id: '', label: '', date: '' }, l.children.length + 100)); });
  on(main, 'click', '[data-rm-day]', (e, t) => t.closest('.day-row').remove());
  on(main, 'click', '#add-org', () => { const l = $('#org-list'); l.insertAdjacentHTML('beforeend', orgRow({ name: '', role: '' }, l.children.length + 100)); });
  on(main, 'click', '[data-rm-org]', (e, t) => t.closest('.org-row').remove());
  on(main, 'click', '#add-user', () => userForm(null));
  on(main, 'click', '[data-user]', (e, t) => userForm(t.dataset.user));

  main.addEventListener('submit', async e => {
    e.preventDefault();
    const f = e.target; UI.clearErrors(f);
    switch (section) {
      case 'event': {
        if (!val(f, 'eventName')) return setError(f, 'eventName', 'Event name is required.');
        if (!val(f, 'subtitle')) return setError(f, 'subtitle', 'Subtitle is required.');
        if (await saveSettings({ eventName: val(f, 'eventName'), subtitle: val(f, 'subtitle'), presenter: val(f, 'presenter'), eventInfo: { date: val(f, 'date'), venue: val(f, 'venue') } }, f, 'Event details saved — reload to see them in the header')) draw();
        break;
      }
      case 'days': {
        const old = Store.settings().days;
        const taken = new Set($$('.day-row', f).map(r => r.dataset.id).filter(Boolean));
        let n = 1;
        const rows = [];
        for (const r of $$('.day-row', f)) {
          const label = $('[name=day-label]', r).value.trim(), date = $('[name=day-date]', r).value;
          if (!label && !date && !r.dataset.id) continue;
          if (!label) { UI.toast('Every day needs a name.', 'error'); return; }
          let id = r.dataset.id;
          if (!id) { while (taken.has('day' + n)) n++; id = 'day' + n; taken.add(id); }
          const prev = old.find(d => d.id === id);
          rows.push({ id, label, date, note: prev ? prev.note : '' });
        }
        if (!rows.length) { UI.toast('Keep at least one event day.', 'error'); return; }
        if (await saveSettings({ days: rows }, f, 'Event days saved')) draw();
        break;
      }
      case 'organizers': {
        const rows = $$('.org-row', f).map(r => ({ name: $('[name=org-name]', r).value.trim(), role: $('[name=org-role]', r).value.trim() })).filter(o => o.name);
        if (!rows.length) { UI.toast('Keep at least one organizer.', 'error'); return; }
        await saveSettings({ organizers: rows }, f); break;
      }
      case 'timezone': await saveSettings({ timezone: val(f, 'timezone') }, f); break;
      case 'idformat': {
        const digits = Number(val(f, 'digits'));
        if (!(digits >= 1 && digits <= 8)) return setError(f, 'digits', 'Use 1 to 8 digits.');
        await saveSettings({ idFormat: { prefix: val(f, 'prefix'), digits } }, f); break;
      }
      case 'instructions': await saveSettings({ assignmentInstructions: val(f, 'instructions') }, f); break;
      case 'contact': await saveSettings({ contact: { email: val(f, 'email'), phone: val(f, 'phone'), helpdesk: val(f, 'helpdesk') } }, f); break;
    }
  });
  draw();
});
