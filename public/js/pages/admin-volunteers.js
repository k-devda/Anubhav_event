Boot.run(() => {
  'use strict';
  const { icon, esc, badge, fmtDate, fmtRange, fmtTime, $, $$, on, fieldHtml, checkGroupHtml, setError, checked, val } = UI;
  const main = document.getElementById('main');
  const params = new URLSearchParams(location.search);
  const PAGE_SIZE = 10;
  const state = { q: '', status: params.get('status') || '', team: params.get('team') || '', assign: params.get('assign') || '', sort: 'seq', dir: 1, page: 1, selected: new Set() };

  const SKILLS = ['Public speaking', 'Event management', 'Photography', 'Video editing', 'Audio/Video setup', 'First aid', 'Hospitality', 'Crowd management', 'Social media', 'Documentation', 'Registration desk', 'Translation'];
  const YEARS = ['1st', '2nd', '3rd', '4th', '5th', 'Postgraduate', 'Other'];

  function rows() {
    return Store.list('volunteers').map(v => {
      const acts = Domain.assignmentsFor(v.id, { activeOnly: true });
      return { v, acts, first: acts[0] || null };
    });
  }
  function filtered() {
    const q = state.q.toLowerCase();
    let list = rows().filter(r => {
      if (q && !(r.v.name.toLowerCase().includes(q) || Domain.volCode(r.v).toLowerCase().includes(q))) return false;
      if (state.status && r.v.status !== state.status) return false;
      if (state.team && !r.acts.some(a => a.teamId === state.team)) return false;
      if (state.assign === 'Assigned' && !r.acts.length) return false;
      if (state.assign === 'Unassigned' && r.acts.length) return false;
      return true;
    });
    const key = {
      seq: r => r.v.seq, name: r => r.v.name.toLowerCase(), institution: r => r.v.institution.toLowerCase(), status: r => r.v.status,
      team: r => (r.first ? Domain.teamName(r.first.teamId) : 'zzz'), role: r => (r.first ? r.first.role : 'zzz'), venue: r => (r.first ? Domain.venueName(r.first.venueId) : 'zzz')
    }[state.sort];
    list.sort((a, b) => (key(a) > key(b) ? 1 : key(a) < key(b) ? -1 : 0) * state.dir);
    return list;
  }

  function th(label, key) {
    const active = state.sort === key;
    return `<th scope="col"${active ? ` aria-sort="${state.dir === 1 ? 'ascending' : 'descending'}"` : ''}><button type="button" class="th-sort" data-sort="${key}">${label} ${icon('sort', 12)}</button></th>`;
  }

  function skeleton() {
    return `<div class="card-body">${'<div class="skeleton" style="height:16px;margin-bottom:14px"></div>'.repeat(6)}</div>`;
  }

  function build() {
    const teams = Domain.activeTeams();
    main.innerHTML = `${Shell.pageHead('Volunteers', 'Review registrations, approve or reject, and assign roles.',
      `<button class="btn btn-secondary" type="button" id="export-all">${icon('download', 16)} Export CSV</button><button class="btn btn-primary" type="button" id="add-vol">${icon('plus', 16)} Add volunteer</button>`)}
      <section class="card">
        <div class="toolbar">
          <div class="field grow"><label for="f-q">Search</label><div class="input-icon"><span aria-hidden="true">${icon('search', 16)}</span><input class="input" id="f-q" type="search" placeholder="Name or Volunteer ID" value="${esc(state.q)}"></div></div>
          <div class="field"><label for="f-status">Registration</label><select class="select" id="f-status"><option value="">All statuses</option>${['Pending', 'Approved', 'Rejected'].map(s => `<option${state.status === s ? ' selected' : ''}>${s}</option>`).join('')}</select></div>
          <div class="field"><label for="f-team">Team</label><select class="select" id="f-team"><option value="">All teams</option>${teams.map(t => `<option value="${t.id}"${state.team === t.id ? ' selected' : ''}>${esc(t.name)}</option>`).join('')}</select></div>
          <div class="field"><label for="f-assign">Assignment</label><select class="select" id="f-assign"><option value="">All</option>${['Assigned', 'Unassigned'].map(s => `<option${state.assign === s ? ' selected' : ''}>${s}</option>`).join('')}</select></div>
          <button class="btn btn-ghost" type="button" id="clear-f">Clear filters</button>
        </div>
        <div id="bulk"></div>
        <div id="table-area">${skeleton()}</div>
      </section>`;
    draw();
  }

  function draw() {
    const list = filtered();
    const pg = UI.paginate(list, state.page, PAGE_SIZE); state.page = pg.page;
    const area = $('#table-area');
    // bulk bar
    const n = state.selected.size;
    $('#bulk').innerHTML = n ? `<div class="bulk-bar" role="region" aria-label="Bulk actions"><strong>${n} selected</strong><span class="spacer"></span>
      <button class="btn btn-secondary btn-sm" data-bulk="approve">${icon('check', 14)} Approve</button><button class="btn btn-secondary btn-sm" data-bulk="reject">${icon('x', 14)} Reject</button>
      <button class="btn btn-secondary btn-sm" data-bulk="assign">${icon('clipboard', 14)} Assign…</button><button class="btn btn-secondary btn-sm" data-bulk="export">${icon('download', 14)} Export selected</button>
      <button class="btn btn-secondary btn-sm" data-bulk="clear">Clear</button></div>` : '';
    if (!list.length) {
      area.innerHTML = UI.stateBlock({ icon: 'search', title: 'No volunteers match', text: 'Try changing or clearing the filters.', action: '<button class="btn btn-secondary" type="button" id="clear-f2">Clear filters</button>' });
      return;
    }
    const allOnPage = pg.slice.every(r => state.selected.has(r.v.id));
    area.innerHTML = `<div class="table-wrap"><table class="table table-cards">
      <thead><tr><th class="col-check"><input type="checkbox" class="check-all" id="sel-all" aria-label="Select all on this page"${allOnPage ? ' checked' : ''}></th>
        ${th('ID', 'seq')}${th('Name', 'name')}${th('Institution', 'institution')}<th scope="col">Skills</th>${th('Status', 'status')}${th('Team', 'team')}${th('Role', 'role')}${th('Venue', 'venue')}<th scope="col"><span class="sr-only">Actions</span></th></tr></thead>
      <tbody>${pg.slice.map(({ v, acts, first }) => `<tr data-id="${v.id}">
        <td class="col-check"><input type="checkbox" data-sel="${v.id}" aria-label="Select ${esc(v.name)}"${state.selected.has(v.id) ? ' checked' : ''}></td>
        <td data-label="ID" class="nowrap">${esc(Domain.volCode(v))}</td>
        <td data-label="Name"><button type="button" class="btn-link cell-strong" data-view="${v.id}" style="background:none;border:0;padding:0;cursor:pointer;color:var(--c-burgundy-700);font-weight:600;text-align:left">${esc(v.name)}</button></td>
        <td data-label="Institution">${esc(v.institution)}</td>
        <td data-label="Skills">${v.skills.slice(0, 2).map(s => `<span class="chip">${esc(s)}</span>`).join('')}${v.skills.length > 2 ? `<span class="chip">+${v.skills.length - 2}</span>` : ''}${!v.skills.length ? '<span class="muted">—</span>' : ''}</td>
        <td data-label="Status">${badge(v.status)}</td>
        <td data-label="Team">${first ? esc(Domain.teamName(first.teamId)) + (acts.length > 1 ? ` <span class="badge badge-brand">+${acts.length - 1}</span>` : '') : badge('Unassigned')}</td>
        <td data-label="Role">${first ? esc(first.role) : '—'}</td>
        <td data-label="Venue">${first ? esc(Domain.venueName(first.venueId)) : '—'}</td>
        <td class="cell-actions"><div class="row-actions">
          <button class="btn btn-ghost btn-icon btn-sm" data-view="${v.id}" aria-label="View ${esc(v.name)}" title="View details">${icon('eye', 16)}</button>
          <button class="btn btn-ghost btn-icon btn-sm" data-edit="${v.id}" aria-label="Edit ${esc(v.name)}" title="Edit">${icon('edit', 16)}</button>
          ${v.status === 'Pending' ? `<button class="btn btn-ghost btn-icon btn-sm" data-approve="${v.id}" aria-label="Approve ${esc(v.name)}" title="Approve" style="color:var(--c-ok)">${icon('check', 16)}</button><button class="btn btn-ghost btn-icon btn-sm" data-reject="${v.id}" aria-label="Reject ${esc(v.name)}" title="Reject" style="color:var(--c-bad)">${icon('x', 16)}</button>` : ''}
          ${v.status === 'Approved' ? `<button class="btn btn-ghost btn-icon btn-sm" data-assign="${v.id}" aria-label="Assign ${esc(v.name)}" title="Assign">${icon('clipboard', 16)}</button>` : ''}
        </div></td></tr>`).join('')}</tbody></table></div>${UI.paginationHtml(pg, 'volunteers')}`;
  }

  /* ---------- details ---------- */
  function detail(id) {
    const v = Domain.volunteer(id);
    const hist = Domain.assignmentsFor(id);
    const m = UI.openModal({
      title: 'Volunteer details', drawer: true, size: 'md',
      body: `<div class="detail-head"><span class="avatar avatar-lg">${UI.initials(v.name)}</span><div><h3>${esc(v.name)}</h3><div class="muted small">${esc(Domain.volCode(v))} · ${badge(v.status)}</div></div></div>
        <dl class="kv"><dt>Institution</dt><dd>${esc(v.institution)}</dd><dt>Course / year</dt><dd>${esc(v.course)} · ${esc(v.year)}</dd><dt>Mobile</dt><dd>${esc(v.mobile)}</dd><dt>Email</dt><dd>${esc(v.email)}</dd>
        <dt>Skills</dt><dd>${v.skills.map(s => `<span class="chip">${esc(s)}</span>`).join('') || '—'}</dd><dt>Preferred areas</dt><dd>${v.areas.map(a => `<span class="chip">${esc(Domain.teamName(a))}</span>`).join('') || '—'}</dd>
        <dt>Availability</dt><dd>${esc((v.availability || []).join(', ') || '—')}</dd><dt>Experience</dt><dd>${esc(v.experience || '—')}</dd><dt>Notes</dt><dd>${esc(v.notes || '—')}</dd><dt>Registered</dt><dd>${fmtDate(v.registeredAt)}</dd></dl>
        <hr class="divider"><h3 style="margin-bottom:var(--s-3)">Assignment history</h3>
        ${hist.length ? `<ul class="history">${hist.map(a => { const iss = Domain.assignmentIssues(a); return `<li><div class="row row-between"><strong>${esc(a.role)}</strong>${badge(a.status)}</div><div class="muted">${esc(Domain.teamName(a.teamId))} · ${esc(Domain.venueName(a.venueId))}</div><div>${esc(Domain.dayLabel(a.day))} · report ${a.reportTime ? fmtTime(a.reportTime) : 'TBC'} · ${fmtRange(a.startTime, a.endTime)}</div>${iss.length ? `<div class="warn-inline" style="margin-top:4px">${icon('alert', 13)} ${esc(iss.join('; '))}</div>` : ''}<div class="small muted">Updated ${fmtDate(a.updatedAt)}</div></li>`; }).join('')}</ul>`
          : UI.stateBlock({ icon: 'clipboard', title: 'No assignments', text: v.status === 'Approved' ? 'This volunteer is approved and ready to be assigned.' : 'Approve this registration before assigning a role.' })}`,
      footer: `<button class="btn btn-secondary" type="button" data-close>Close</button><button class="btn btn-secondary" type="button" id="d-edit">${icon('edit', 15)} Edit</button>${v.status === 'Approved' ? `<button class="btn btn-primary" type="button" id="d-assign">${icon('clipboard', 15)} Assign</button>` : v.status === 'Pending' ? '<button class="btn btn-primary" type="button" id="d-approve">Approve</button>' : ''}`
    });
    $('#d-edit', m.el).addEventListener('click', () => { m.close(); editForm(id); });
    const a = $('#d-assign', m.el); if (a) a.addEventListener('click', () => { m.close(); assign([id]); });
    const ap = $('#d-approve', m.el); if (ap) ap.addEventListener('click', () => { m.close(); setStatus([id], 'Approved'); });
  }

  /* ---------- add / edit ---------- */
  function editForm(id) {
    const v = id ? Domain.volunteer(id) : { name: '', mobile: '', email: '', institution: '', course: '', year: '', skills: [], availability: [], experience: '', notes: '', status: 'Pending', areas: [] };
    const m = UI.openModal({
      title: id ? 'Edit volunteer' : 'Add volunteer', size: 'lg',
      body: `<form id="v-form" novalidate><div class="field-grid">
        ${fieldHtml({ id: 'vf-name', name: 'name', label: 'Full name', required: true, value: v.name })}
        ${fieldHtml({ id: 'vf-mobile', name: 'mobile', label: 'Mobile number', required: true, value: v.mobile })}
        ${fieldHtml({ id: 'vf-email', name: 'email', label: 'Email', type: 'email', required: true, value: v.email })}
        ${fieldHtml({ id: 'vf-inst', name: 'institution', label: 'College / institution', required: true, value: v.institution })}
        ${fieldHtml({ id: 'vf-course', name: 'course', label: 'Course / department', value: v.course })}
        ${fieldHtml({ id: 'vf-year', name: 'year', label: 'Year of study', type: 'select', value: v.year, options: ['', ...YEARS] })}
        ${fieldHtml({ id: 'vf-status', name: 'status', label: 'Registration status', type: 'select', value: v.status, options: ['Pending', 'Approved', 'Rejected'] })}
        ${checkGroupHtml({ name: 'skills', label: 'Skills', options: SKILLS, values: v.skills, className: 'span-2' })}
        ${fieldHtml({ id: 'vf-notes', name: 'notes', label: 'Notes', type: 'textarea', value: v.notes, className: 'span-2' })}
      </div></form>`,
      footer: `<button class="btn btn-secondary" type="button" data-close>Cancel</button><button class="btn btn-primary" type="button" id="v-save">Save</button>`
    });
    $('#v-save', m.el).addEventListener('click', async e => {
      const f = $('#v-form', m.el);
      UI.clearErrors(f);
      let ok = true;
      const chk = (n, bad, msg) => { setError(f, n, bad ? msg : ''); if (bad) ok = false; };
      chk('name', val(f, 'name').length < 2, 'Enter a name.');
      chk('mobile', !/^[\d\s+()-]{10,18}$/.test(val(f, 'mobile')), 'Enter a valid mobile number.');
      chk('email', !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(val(f, 'email')), 'Enter a valid email.');
      if (!ok) return;
      const rec = { name: val(f, 'name'), mobile: val(f, 'mobile'), email: val(f, 'email'), institution: val(f, 'institution'), course: val(f, 'course'), year: val(f, 'year'), status: val(f, 'status'), notes: val(f, 'notes'), skills: checked(f, 'skills') };
      const done = await UI.attempt(async () => {
        if (id) { await Store.update('volunteers', id, rec); UI.toast('Volunteer updated'); }
        else { await Store.insert('volunteers', rec); UI.toast('Volunteer added'); }
      }, { form: f, btn: e.currentTarget });
      if (done) { m.close(); draw(); }
    });
  }

  /* ---------- status + assign ---------- */
  async function setStatus(ids, status) {
    if (status === 'Rejected') {
      const ok = await UI.confirm({ title: `Reject ${ids.length} registration${ids.length > 1 ? 's' : ''}?`, message: 'Rejected volunteers cannot be assigned, their current assignments are cancelled, and they will not be found on Find My Role. You can approve them again later.', confirmLabel: 'Reject', danger: true });
      if (!ok) return;
    }
    const ok = await UI.attempt(async () => {
      for (const id of ids) await Store.update('volunteers', id, { status });
    });
    if (ok) UI.toast(`${ids.length} volunteer${ids.length > 1 ? 's' : ''} ${status.toLowerCase()}`);
    state.selected.clear(); draw();
  }
  function assign(ids) { AssignmentForm.open({ volunteerIds: ids, onSave: () => { state.selected.clear(); draw(); } }); }

  function exportRows(list) {
    UI.downloadCSV('anubhav-volunteers.csv', [
      { key: 'id', label: 'Volunteer ID' }, { key: 'name', label: 'Name' }, { key: 'institution', label: 'Institution' }, { key: 'course', label: 'Course' }, { key: 'year', label: 'Year' },
      { key: 'skills', label: 'Skills' }, { key: 'status', label: 'Status' }, { key: 'team', label: 'Team(s)' }, { key: 'role', label: 'Role(s)' }, { key: 'venue', label: 'Venue(s)' }
    ], list.map(({ v, acts }) => ({ id: Domain.volCode(v), name: v.name, institution: v.institution, course: v.course, year: v.year, skills: v.skills.join('; '), status: v.status, team: acts.map(a => Domain.teamName(a.teamId)).join('; '), role: acts.map(a => a.role).join('; '), venue: acts.map(a => Domain.venueName(a.venueId)).join('; ') })));
  }

  /* ---------- events ---------- */
  const debounced = UI.debounce(() => { state.page = 1; draw(); }, 200);
  build();
  Shell.onRefresh(draw);
  main.addEventListener('input', e => { if (e.target.id === 'f-q') { state.q = e.target.value; debounced(); } });
  main.addEventListener('change', e => {
    const t = e.target;
    if (t.id === 'f-status') state.status = t.value;
    else if (t.id === 'f-team') state.team = t.value;
    else if (t.id === 'f-assign') state.assign = t.value;
    else if (t.id === 'sel-all') { const pageIds = $$('[data-sel]', main).map(c => c.dataset.sel); pageIds.forEach(id => t.checked ? state.selected.add(id) : state.selected.delete(id)); draw(); return; }
    else if (t.dataset.sel) { t.checked ? state.selected.add(t.dataset.sel) : state.selected.delete(t.dataset.sel); draw(); return; }
    else return;
    state.page = 1; draw();
  });
  const clear = () => { Object.assign(state, { q: '', status: '', team: '', assign: '', page: 1 }); build(); };
  on(main, 'click', '#clear-f, #clear-f2', clear);
  on(main, 'click', '[data-sort]', (e, t) => { const k = t.dataset.sort; state.dir = state.sort === k ? -state.dir : 1; state.sort = k; draw(); });
  on(main, 'click', '[data-page]', (e, t) => { state.page = Number(t.dataset.page); draw(); });
  on(main, 'click', '[data-view]', (e, t) => detail(t.dataset.view));
  on(main, 'click', '[data-edit]', (e, t) => editForm(t.dataset.edit));
  on(main, 'click', '[data-approve]', (e, t) => setStatus([t.dataset.approve], 'Approved'));
  on(main, 'click', '[data-reject]', (e, t) => setStatus([t.dataset.reject], 'Rejected'));
  on(main, 'click', '[data-assign]', (e, t) => assign([t.dataset.assign]));
  on(main, 'click', '#add-vol', () => editForm(null));
  on(main, 'click', '#export-all', () => exportRows(filtered()));
  on(main, 'click', '[data-bulk]', (e, t) => {
    const ids = [...state.selected];
    switch (t.dataset.bulk) {
      case 'approve': setStatus(ids, 'Approved'); break;
      case 'reject': setStatus(ids, 'Rejected'); break;
      case 'assign': assign(ids); break;
      case 'export': exportRows(filtered().filter(r => state.selected.has(r.v.id))); break;
      case 'clear': state.selected.clear(); draw(); break;
    }
  });
});
