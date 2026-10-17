Boot.run(() => {
  'use strict';
  const { icon, esc, badge, fmtRange, fmtTime, $, on, fieldHtml, setError, val } = UI;
  const main = document.getElementById('main');
  let showArchived = false;

  main.innerHTML = `${Shell.pageHead('Teams', 'Create teams, assign leaders, manage rosters and see vacancies.',
    `<label class="switch"><input type="checkbox" id="arch"><span>Show archived</span></label><button class="btn btn-primary" type="button" id="new">${icon('plus', 16)} Create team</button>`)}
    <div id="grid"></div>`;

  function draw() {
    const teams = Store.list('teams').filter(t => showArchived || !t.archived);
    $('#grid').innerHTML = teams.length ? `<div class="card-grid">${teams.map(t => {
      const members = new Set(Domain.teamMembers(t.id).map(m => m.volunteer.id)).size; const vac = Domain.teamVacancies(t.id);
      return `<article class="card team-card card-clickable${t.archived ? ' is-archived' : ''}" data-open="${t.id}" tabindex="0" role="button" aria-label="Open ${esc(t.name)}">
        <div class="row row-between"><h3>${esc(t.name)}</h3>${t.archived ? badge('Archived') : vac ? badge(`${vac} vacant`, 'warn') : badge('Full', 'ok')}</div>
        <p class="desc">${esc(t.description)}</p>
        <div class="team-meta"><div>${icon('user', 16)}<span><strong>Leader:</strong> ${t.leader ? esc(t.leader) : '<span class="warn-inline">Not assigned</span>'}</span></div>
          <div>${icon('users', 16)}<span>${members} member${members === 1 ? '' : 's'}</span></div><div>${icon('pin', 16)}<span>${esc(Domain.venueName(t.venueId))}</span></div></div>
        <div class="foot card-actions">
          <button class="btn btn-secondary btn-sm" type="button" data-edit="${t.id}">${icon('edit', 14)} Edit</button>
          <button class="btn btn-ghost btn-sm" type="button" data-leader="${t.id}">${icon('user', 14)} Leader</button>
          ${t.archived ? `<button class="btn btn-ghost btn-sm" type="button" data-restore="${t.id}">Restore</button>` : `<button class="btn btn-danger-ghost btn-sm" type="button" data-archive="${t.id}">${icon('archive', 14)} Archive</button>`}</div></article>`;
    }).join('')}</div>` : UI.stateBlock({ icon: 'group', title: 'No teams yet', text: 'Create your first team to start organising volunteers.', action: '<button class="btn btn-primary" type="button" id="new2">Create team</button>' });
  }

  /* ---------- Team detail ---------- */
  function detail(id, tab) {
    tab = tab || 'roster';
    let m;
    const render = () => {
      const t = Domain.team(id);
      const members = Domain.teamMembers(id).sort((a, b) => a.volunteer.name.localeCompare(b.volunteer.name));
      const shifts = Domain.teamShifts(id);
      const vac = Domain.teamVacancies(id);
      const tabs = [['roster', `Roster (${members.length})`], ['schedule', 'Schedule'], ['vacancies', `Vacancies (${vac})`]];
      let panel;
      if (tab === 'roster') panel = members.length ? `<ul class="member-list">${members.map(x => `<li><span class="avatar">${UI.initials(x.volunteer.name)}</span><div class="grow"><strong>${esc(x.volunteer.name)}</strong><div class="small muted">${esc(x.assignment.role)} · ${esc(Domain.dayLabel(x.assignment.day))} ${fmtRange(x.assignment.startTime, x.assignment.endTime)}</div></div>
          <button class="btn btn-danger-ghost btn-sm" type="button" data-remove="${x.assignment.id}" aria-label="Remove ${esc(x.volunteer.name)} from team">${icon('x', 14)} Remove</button></li>`).join('')}</ul>`
        : UI.stateBlock({ icon: 'users', title: 'No members yet', text: 'Add approved volunteers to this team.' });
      else if (tab === 'schedule') panel = `<div class="table-wrap"><table class="table table-cards"><thead><tr><th>Shift</th><th>Day</th><th>Report</th><th>Time</th><th>Venue</th><th>Coordinator</th></tr></thead><tbody>${shifts.map(s => `<tr><td data-label="Shift" class="cell-strong">${esc((s.name.split('—')[1] || s.name).trim())}</td><td data-label="Day">${esc(Domain.dayLabel(s.day))}</td><td data-label="Report">${s.reportTime ? fmtTime(s.reportTime) : '<span class="warn-inline">Missing</span>'}</td><td data-label="Time">${fmtRange(s.startTime, s.endTime)}</td><td data-label="Venue">${s.venueId ? esc(Domain.venueName(s.venueId)) : '<span class="warn-inline">Missing</span>'}</td><td data-label="Coordinator">${esc(s.coordinator || '—')}</td></tr>`).join('') || '<tr><td colspan="6" class="muted">No shifts. Create one under Shifts &amp; Schedule.</td></tr>'}</tbody></table></div><p class="small muted" style="margin-top:var(--s-3)"><a href="shifts.html">Manage shifts →</a></p>`;
      else panel = shifts.length ? `<ul class="list-plain">${shifts.map(s => { const f = Domain.shiftFilled(s), open = Math.max(0, s.positions - f); return `<li class="shift-item"><div class="what"><strong>${esc((s.name.split('—')[1] || s.name).trim())} · ${esc(Domain.dayLabel(s.day))}</strong><span class="muted small">${f} of ${s.positions} filled</span><div class="progress ${open ? 'gold' : ''}" style="--v:${s.positions ? Math.round(f / s.positions * 100) : 0};margin-top:6px"><span></span></div></div>${open ? badge(`${open} open`, 'warn') : badge('Filled', 'ok')}</li>`; }).join('')}</ul>` : UI.stateBlock({ icon: 'clock', title: 'No shifts defined', text: 'Add shifts to track vacancies.' });
      const html = `<p>${esc(t.description)}</p><dl class="kv" style="margin-bottom:var(--s-4)"><dt>Leader</dt><dd>${esc(t.leader || 'Not assigned')}</dd><dt>Assistant</dt><dd>${esc(t.assistant || '—')}</dd><dt>Venue</dt><dd>${esc(Domain.venueName(t.venueId))}</dd><dt>Responsibilities</dt><dd>${t.responsibilities.map(r => `<span class="chip">${esc(r)}</span>`).join('')}</dd>${t.instructions ? `<dt>Instructions</dt><dd>${esc(t.instructions)}</dd>` : ''}</dl>
        <div class="tabs" role="tablist">${tabs.map(([k, l]) => `<button class="tab" role="tab" type="button" data-tab="${k}" aria-selected="${k === tab}">${l}</button>`).join('')}</div><div style="padding-top:var(--s-4)">${panel}</div>`;
      if (m) { m.setTitle(esc(t.name)); m.body.innerHTML = html; }
      return html;
    };
    const t0 = Domain.team(id);
    m = UI.openModal({
      title: esc(t0.name), size: 'lg', body: render(),
      footer: `<button class="btn btn-secondary" type="button" data-close>Close</button><button class="btn btn-secondary" type="button" id="m-edit">${icon('edit', 15)} Edit team</button><button class="btn btn-primary" type="button" id="m-add">${icon('user_plus', 15)} Add members</button>`,
      onClose: draw
    });
    on(m.el, 'click', '[data-tab]', (e, el) => { tab = el.dataset.tab; render(); });
    on(m.el, 'click', '[data-remove]', async (e, el) => {
      const a = Store.get('assignments', el.dataset.remove), v = Domain.volunteer(a.volunteerId);
      if (await UI.confirm({ title: 'Remove from team?', message: `${esc(v.name)} will be removed from <strong>${esc(Domain.team(id).name)}</strong> (role: ${esc(a.role)}).`, confirmLabel: 'Remove', danger: true })) {
        if (await UI.attempt(() => Store.remove('assignments', a.id))) UI.toast('Member removed');
        render();
      }
    });
    $('#m-edit', m.el).addEventListener('click', () => { m.close(); form(id); });
    $('#m-add', m.el).addEventListener('click', () => { const t = Domain.team(id); AssignmentForm.open({ defaults: { teamId: id, venueId: t.venueId, leader: t.leader, responsibilities: t.responsibilities.join('; ') }, onSave: render }); });
  }

  /* ---------- Create / edit ---------- */
  function form(id) {
    const t = id ? Domain.team(id) : { name: '', description: '', leader: '', assistant: '', responsibilities: [], venueId: '', instructions: '', roles: [] };
    const names = [...new Set(Store.list('volunteers').map(v => v.name))];
    const m = UI.openModal({
      title: id ? 'Edit team' : 'Create team', size: 'lg',
      body: `<form id="t-form" novalidate><div class="field-grid">
        ${fieldHtml({ id: 'tf-name', name: 'name', label: 'Team name', required: true, value: t.name, className: 'span-2' })}
        ${fieldHtml({ id: 'tf-desc', name: 'description', label: 'Description', type: 'textarea', rows: 2, value: t.description, className: 'span-2' })}
        ${fieldHtml({ id: 'tf-leader', name: 'leader', label: 'Team leader', value: t.leader, attrs: ' list="tf-people"', hint: 'Type a name or pick a volunteer.' })}
        ${fieldHtml({ id: 'tf-asst', name: 'assistant', label: 'Assistant leader', value: t.assistant, attrs: ' list="tf-people"' })}
        <datalist id="tf-people">${names.map(n => `<option value="${esc(n)}">`).join('')}</datalist>
        ${fieldHtml({ id: 'tf-venue', name: 'venue', label: 'Venue', type: 'select', value: t.venueId, options: [{ value: '', label: 'No venue yet' }, ...Domain.activeVenues().map(v => ({ value: v.id, label: v.name }))] })}
        ${id ? `<div class="field"><span class="label">Shift</span><div class="small muted" style="padding-top:8px">${Domain.teamShifts(id).length} shift(s) · <a href="shifts.html">manage in Shifts &amp; Schedule</a></div></div>`
          : fieldHtml({ id: 'tf-shift', name: 'shift', label: 'Default shift', type: 'select', value: 'none', options: [{ value: 'none', label: 'Create no shifts yet' }, { value: 'am', label: 'Morning only (event day)' }, { value: 'pm', label: 'Afternoon only (event day)' }, { value: 'both', label: 'Morning and afternoon' }] })}
        ${fieldHtml({ id: 'tf-resp', name: 'responsibilities', label: 'Responsibilities', type: 'textarea', rows: 3, value: t.responsibilities.join('\n'), hint: 'One per line.', className: 'span-2' })}
        ${fieldHtml({ id: 'tf-roles', name: 'roles', label: 'Roles available (comma separated)', value: t.roles.join(', '), placeholder: 'e.g. Guide, Coordinator', className: 'span-2' })}
        ${fieldHtml({ id: 'tf-instr', name: 'instructions', label: 'Special instructions', type: 'textarea', rows: 2, value: t.instructions, className: 'span-2' })}
      </div></form>`,
      footer: `<button class="btn btn-secondary" type="button" data-close>Cancel</button><button class="btn btn-primary" type="button" id="t-save">${id ? 'Save team' : 'Create team'}</button>`
    });
    $('#t-save', m.el).addEventListener('click', async e => {
      const f = $('#t-form', m.el);
      UI.clearErrors(f);
      if (val(f, 'name').length < 2) return setError(f, 'name', 'Enter a team name.');
      const rec = { name: val(f, 'name'), description: val(f, 'description'), leader: val(f, 'leader'), assistant: val(f, 'assistant'), venueId: val(f, 'venue') || null, responsibilities: val(f, 'responsibilities').split('\n').map(s => s.trim()).filter(Boolean), roles: val(f, 'roles').split(',').map(s => s.trim()).filter(Boolean), instructions: val(f, 'instructions') };
      if (!rec.roles.length) rec.roles = ['Team Member'];
      const done = await UI.attempt(async () => {
        if (id) { await Store.update('teams', id, rec); UI.toast('Team updated'); return; }
        const nt = await Store.insert('teams', Object.assign({ archived: false }, rec));
        const mode = val(f, 'shift');
        const mk = kind => Store.insert('shifts', { name: `${rec.name} — ${kind === 'am' ? 'Morning' : 'Afternoon'}`, day: Store.settings().days[0].id, teamId: nt.id, venueId: rec.venueId, reportTime: kind === 'am' ? '07:45' : '12:15', setupTime: kind === 'am' ? '07:30' : '12:00', startTime: kind === 'am' ? '08:30' : '12:30', endTime: kind === 'am' ? '12:30' : '17:00', positions: 3, coordinator: rec.leader, responsibilities: rec.responsibilities.join('; '), instructions: rec.instructions });
        if (mode === 'am' || mode === 'both') await mk('am');
        if (mode === 'pm' || mode === 'both') await mk('pm');
        UI.toast('Team created');
      }, { form: f, map: { venueId: 'venue' }, btn: e.currentTarget });
      if (done) { m.close(); draw(); }
    });
  }

  function leaderForm(id) {
    const t = Domain.team(id);
    const m = UI.openModal({
      title: `Assign leader — ${esc(t.name)}`, size: 'sm',
      body: `<form id="l-form" novalidate class="stack">${fieldHtml({ id: 'lf-leader', name: 'leader', label: 'Team leader', value: t.leader, attrs: ' list="lf-people"' })}${fieldHtml({ id: 'lf-asst', name: 'assistant', label: 'Assistant leader', value: t.assistant, attrs: ' list="lf-people"' })}
        <datalist id="lf-people">${[...new Set(Store.list('volunteers').map(v => v.name))].map(n => `<option value="${esc(n)}">`).join('')}</datalist></form>`,
      footer: '<button class="btn btn-secondary" type="button" data-close>Cancel</button><button class="btn btn-primary" type="button" id="l-save">Save</button>'
    });
    $('#l-save', m.el).addEventListener('click', async e => {
      const f = $('#l-form', m.el);
      const done = await UI.attempt(() => Store.update('teams', id, { leader: val(f, 'leader'), assistant: val(f, 'assistant') }), { form: f, btn: e.currentTarget });
      if (done) { UI.toast('Leadership updated'); m.close(); draw(); }
    });
  }

  $('#arch').addEventListener('change', e => { showArchived = e.target.checked; draw(); });
  on(main, 'click', '#new, #new2', () => form(null));
  on(main, 'click', '[data-edit]', (e, t) => { e.stopPropagation(); form(t.dataset.edit); });
  on(main, 'click', '[data-leader]', (e, t) => { e.stopPropagation(); leaderForm(t.dataset.leader); });
  on(main, 'click', '[data-archive]', async (e, t) => {
    e.stopPropagation(); const team = Domain.team(t.dataset.archive);
    const n = new Set(Domain.teamMembers(team.id).map(x => x.volunteer.id)).size;
    if (await UI.confirm({ title: `Archive “${team.name}”?`, message: `The team will be hidden from the public Teams page and from new assignments.${n ? ` Its ${n} existing member(s) keep their assignments until you change them.` : ''} You can restore it later.`, confirmLabel: 'Archive', danger: true })) {
      if (await UI.attempt(() => Store.update('teams', team.id, { archived: true }))) UI.toast('Team archived');
      draw();
    }
  });
  on(main, 'click', '[data-restore]', async (e, t) => { e.stopPropagation(); if (await UI.attempt(() => Store.update('teams', t.dataset.restore, { archived: false }))) UI.toast('Team restored'); draw(); });
  on(main, 'click', '[data-open]', (e, t) => { if (!e.target.closest('button')) detail(t.dataset.open); });
  on(main, 'keydown', '[data-open]', (e, t) => { if ((e.key === 'Enter' || e.key === ' ') && e.target === t) { e.preventDefault(); detail(t.dataset.open); } });

  draw();
  if (new URLSearchParams(location.search).get('new')) form(null);
});
