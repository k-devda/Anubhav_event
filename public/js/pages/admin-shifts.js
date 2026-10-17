Boot.run(() => {
  'use strict';
  const { icon, esc, badge, fmtRange, fmtTime, $, $$, on, fieldHtml, setError, val } = UI;
  const main = document.getElementById('main');
  const days = Store.settings().days;
  const state = { day: days[days.length - 1].id, team: '', view: 'table' };
  const T0 = 6 * 60, T1 = 19 * 60;

  main.innerHTML = `${Shell.pageHead('Shifts & Schedule', 'Define shifts, attach teams, venues and volunteers, and catch gaps early.',
    `<button class="btn btn-primary" type="button" id="new">${icon('plus', 16)} Create shift</button>`)}
    <div id="warnings"></div>
    <section class="card"><div class="toolbar">
      <div class="field"><label for="fd">Day</label><select class="select" id="fd">${days.map(d => `<option value="${d.id}"${d.id === state.day ? ' selected' : ''}>${esc(Domain.dayLabel(d.id))}</option>`).join('')}</select></div>
      <div class="field"><label for="ft">Team</label><select class="select" id="ft"><option value="">All teams</option>${Domain.activeTeams().map(t => `<option value="${t.id}">${esc(t.name)}</option>`).join('')}</select></div>
      <span class="spacer"></span>
      <div class="segmented" role="group" aria-label="View"><button type="button" data-view="table" aria-pressed="true">${icon('list', 15)} Table</button><button type="button" data-view="timeline" aria-pressed="false">${icon('gantt', 15)} Timeline</button></div></div>
      <div id="out"></div></section>`;

  const shiftsNow = () => Store.list('shifts').filter(s => s.day === state.day && (!state.team || s.teamId === state.team)).sort((a, b) => Domain.toMin(a.startTime) - Domain.toMin(b.startTime));

  function warnings() {
    const all = Store.list('shifts');
    const c = { venue: all.filter(s => !s.venueId).length, leader: all.filter(s => !(Domain.team(s.teamId) || {}).leader).length, report: all.filter(s => !s.reportTime).length, unfilled: all.filter(s => Domain.shiftFilled(s) < s.positions).length };
    const overlaps = Domain.overlapList();
    const items = [];
    if (overlaps.length) overlaps.forEach(o => items.push(`<strong>${esc(o.volunteer.name)}</strong> is double-booked: ${esc(Domain.teamName(o.a.teamId))} (${fmtRange(o.a.startTime, o.a.endTime)}) overlaps ${esc(Domain.teamName(o.b.teamId))} (${fmtRange(o.b.startTime, o.b.endTime)})`));
    if (c.venue) items.push(`${c.venue} shift${c.venue > 1 ? 's' : ''} missing a venue`);
    if (c.leader) items.push(`${c.leader} shift${c.leader > 1 ? 's' : ''} belong to a team without a leader`);
    if (c.report) items.push(`${c.report} shift${c.report > 1 ? 's' : ''} missing a reporting time`);
    if (c.unfilled) items.push(`${c.unfilled} shift${c.unfilled > 1 ? 's' : ''} still have unfilled volunteer positions`);
    $('#warnings').innerHTML = items.length ? `<div class="alert alert-warn" style="margin-bottom:var(--s-4)">${icon('alert')}<div><strong>${items.length} thing${items.length > 1 ? 's' : ''} need attention</strong><ul>${items.map(i => `<li>${i}</li>`).join('')}</ul></div></div>` : `<div class="alert alert-ok" style="margin-bottom:var(--s-4)">${icon('check')}<div><strong>All shifts look complete</strong></div></div>`;
  }

  function draw() {
    warnings();
    $$('[data-view]', main).forEach(b => b.setAttribute('aria-pressed', b.dataset.view === state.view));
    const list = shiftsNow(); const out = $('#out');
    if (!list.length) { out.innerHTML = UI.stateBlock({ icon: 'clock', title: 'No shifts for this selection', text: 'Create a shift or change the day / team filter.', action: '<button class="btn btn-primary" type="button" id="new2">Create shift</button>' }); return; }
    if (state.view === 'table') {
      out.innerHTML = `<div class="table-wrap"><table class="table table-cards"><thead><tr><th>Shift</th><th>Venue</th><th>Report</th><th>Setup</th><th>Start – End</th><th>Filled</th><th>Coordinator</th><th>Warnings</th><th><span class="sr-only">Actions</span></th></tr></thead><tbody>
        ${list.map(s => { const f = Domain.shiftFilled(s), iss = Domain.shiftIssues(s).filter(i => !/unfilled/.test(i)); return `<tr><td data-label="Shift"><span class="cell-strong">${esc(s.name)}</span><span class="cell-sub">${esc(Domain.teamName(s.teamId))}</span></td>
          <td data-label="Venue">${s.venueId ? esc(Domain.venueName(s.venueId)) : '<span class="warn-inline">Missing</span>'}</td><td data-label="Report" class="nowrap">${s.reportTime ? fmtTime(s.reportTime) : '<span class="warn-inline">Missing</span>'}</td><td data-label="Setup" class="nowrap">${s.setupTime ? fmtTime(s.setupTime) : '—'}</td>
          <td data-label="Time" class="nowrap">${fmtRange(s.startTime, s.endTime)}</td><td data-label="Filled">${badge(`${f}/${s.positions}`, f >= s.positions ? 'ok' : 'warn')}</td><td data-label="Coordinator">${esc(s.coordinator || '—')}</td>
          <td data-label="Warnings">${iss.length ? iss.map(i => `<span class="warn-inline" style="display:flex">${icon('alert', 12)} ${esc(i)}</span>`).join('') : '<span class="muted">—</span>'}</td>
          <td class="cell-actions"><div class="row-actions"><button class="btn btn-ghost btn-sm" data-assign="${s.id}">${icon('user_plus', 14)} Volunteers</button><button class="btn btn-ghost btn-icon btn-sm" data-edit="${s.id}" aria-label="Edit ${esc(s.name)}">${icon('edit', 16)}</button><button class="btn btn-danger-ghost btn-icon btn-sm" data-del="${s.id}" aria-label="Delete ${esc(s.name)}">${icon('trash', 16)}</button></div></td></tr>`; }).join('')}</tbody></table></div>`;
    } else {
      const hours = (T1 - T0) / 60; const span = T1 - T0;
      const scale = Array.from({ length: hours }, (_, i) => `<span>${String(6 + i).padStart(2, '0')}:00</span>`).join('');
      const pos = (a, b) => `--l:${Math.max(0, (Domain.toMin(a) - T0) / span * 100).toFixed(2)};--w:${Math.max(1.5, (Domain.toMin(b) - Domain.toMin(a)) / span * 100).toFixed(2)}`;
      out.innerHTML = `<div class="gantt"><div class="gantt-inner"><div class="gantt-scale" style="grid-template-columns:repeat(${hours},1fr)">${scale}</div>
        ${list.map(s => { const warn = Domain.shiftIssues(s).filter(i => !/unfilled/.test(i)).length; return `<div class="gantt-row"><div class="gantt-label" title="${esc(s.name)}">${esc(Domain.teamName(s.teamId))}<small>${esc(((s.name.split('—')[1] || s.name).trim()).trim())}</small></div>
          <div class="gantt-track" style="--hours:${hours}">${s.setupTime && s.startTime ? `<span class="gantt-setup" style="${pos(s.setupTime, s.startTime)}" title="Setup ${fmtTime(s.setupTime)}"></span>` : ''}
          <button type="button" class="gantt-bar${warn ? ' has-warning' : ''}" style="${pos(s.startTime, s.endTime)}" data-edit="${s.id}" title="${esc(s.name)} ${fmtRange(s.startTime, s.endTime)}${warn ? ' — has warnings' : ''}">${fmtTime(s.startTime)}–${fmtTime(s.endTime)} · ${Domain.shiftFilled(s)}/${s.positions}</button></div></div>`; }).join('')}
        <p class="small muted" style="margin-top:var(--s-3)">Gold strip = setup time. Amber bars have warnings. Click a bar to edit.</p></div></div>`;
    }
  }

  function form(id) {
    const s = id ? Domain.shift(id) : { name: '', day: state.day, teamId: state.team, venueId: '', reportTime: '', setupTime: '', startTime: '', endTime: '', positions: 3, coordinator: '', responsibilities: '', instructions: '' };
    const m = UI.openModal({
      title: id ? 'Edit shift' : 'Create shift', size: 'lg',
      body: `<form id="s-form" novalidate><div class="field-grid">
        ${fieldHtml({ id: 'sf-name', name: 'name', label: 'Shift name', required: true, value: s.name, className: 'span-2', placeholder: 'e.g. Registration — Morning' })}
        ${fieldHtml({ id: 'sf-team', name: 'team', label: 'Team', type: 'select', required: true, value: s.teamId, options: [{ value: '', label: 'Select team…' }, ...Domain.activeTeams().map(t => ({ value: t.id, label: t.name }))] })}
        ${fieldHtml({ id: 'sf-venue', name: 'venue', label: 'Venue', type: 'select', value: s.venueId, options: [{ value: '', label: 'Not assigned' }, ...Domain.activeVenues().map(v => ({ value: v.id, label: v.name }))] })}
        ${fieldHtml({ id: 'sf-day', name: 'day', label: 'Day', type: 'select', value: s.day, options: days.map(d => ({ value: d.id, label: Domain.dayLabel(d.id) })) })}
        ${fieldHtml({ id: 'sf-pos', name: 'positions', label: 'Volunteer positions needed', type: 'number', value: s.positions, attrs: ' min="0"' })}
        ${fieldHtml({ id: 'sf-report', name: 'report', label: 'Reporting time', type: 'time', value: s.reportTime })}
        ${fieldHtml({ id: 'sf-setup', name: 'setup', label: 'Setup time', type: 'time', value: s.setupTime })}
        ${fieldHtml({ id: 'sf-start', name: 'start', label: 'Start time', type: 'time', required: true, value: s.startTime })}
        ${fieldHtml({ id: 'sf-end', name: 'end', label: 'End time', type: 'time', required: true, value: s.endTime })}
        ${fieldHtml({ id: 'sf-coord', name: 'coordinator', label: 'Coordinator', value: s.coordinator, className: 'span-2' })}
        ${fieldHtml({ id: 'sf-resp', name: 'responsibilities', label: 'Responsibilities', type: 'textarea', rows: 2, value: s.responsibilities, className: 'span-2' })}
        ${fieldHtml({ id: 'sf-instr', name: 'instructions', label: 'Special instructions', type: 'textarea', rows: 2, value: s.instructions, className: 'span-2' })}
      </div></form>`,
      footer: `<button class="btn btn-secondary" type="button" data-close>Cancel</button><button class="btn btn-primary" type="button" id="s-save">${id ? 'Save shift' : 'Create shift'}</button>`
    });
    const f = $('#s-form', m.el);
    f.elements.team.addEventListener('change', () => { const t = Domain.team(f.elements.team.value); if (!t) return; if (!f.elements.venue.value) f.elements.venue.value = t.venueId || ''; if (!f.elements.coordinator.value) f.elements.coordinator.value = t.leader || ''; });
    $('#s-save', m.el).addEventListener('click', async e => {
      UI.clearErrors(f);
      const err = {
        name: val(f, 'name').length < 2 ? 'Enter a shift name.' : '', team: val(f, 'team') ? '' : 'Select a team.',
        start: val(f, 'start') ? '' : 'Enter a start time.', end: !val(f, 'end') ? 'Enter an end time.' : (val(f, 'start') && Domain.toMin(val(f, 'end')) <= Domain.toMin(val(f, 'start')) ? 'End must be after start.' : '')
      };
      Object.keys(err).forEach(k => setError(f, k, err[k]));
      if (Object.values(err).some(Boolean)) return;
      const rec = { name: val(f, 'name'), teamId: val(f, 'team'), venueId: val(f, 'venue') || null, day: val(f, 'day'), positions: Number(val(f, 'positions')) || 0, reportTime: val(f, 'report'), setupTime: val(f, 'setup'), startTime: val(f, 'start'), endTime: val(f, 'end'), coordinator: val(f, 'coordinator'), responsibilities: val(f, 'responsibilities'), instructions: val(f, 'instructions') };
      const map = { teamId: 'team', venueId: 'venue', reportTime: 'report', setupTime: 'setup', startTime: 'start', endTime: 'end' };
      const done = await UI.attempt(async () => {
        if (id) { await Store.update('shifts', id, rec); UI.toast('Shift updated'); }
        else { await Store.insert('shifts', rec); UI.toast('Shift created'); }
      }, { form: f, map, btn: e.currentTarget });
      if (done) { m.close(); state.day = rec.day; $('#fd').value = rec.day; draw(); }
    });
  }

  function assignVolunteers(id) {
    const s = Domain.shift(id), t = Domain.team(s.teamId);
    const already = new Set(Domain.activeAssignments().filter(a => a.shiftId === id).map(a => a.volunteerId));
    const pool = Domain.approved().filter(v => !already.has(v.id)).sort((a, b) => (b.areas.includes(s.teamId) - a.areas.includes(s.teamId)) || a.name.localeCompare(b.name));
    const open = Math.max(0, s.positions - already.size);
    const m = UI.openModal({
      title: `Assign volunteers — ${esc(s.name)}`, size: 'md',
      body: `<p class="muted small">${already.size} of ${s.positions} filled · ${open} position${open === 1 ? '' : 's'} open. Volunteers who listed this team as a preference appear first.</p>
        <div class="vol-picker" style="max-height:320px">${pool.map(v => `<label><input type="checkbox" value="${v.id}"><span><strong>${esc(v.name)}</strong> <span class="muted">${esc(Domain.volCode(v))}${v.areas.includes(s.teamId) ? ' · prefers this team' : ''}</span></span></label>`).join('') || '<div class="state">No more approved volunteers available.</div>'}</div>
        <div id="sv-warn" style="margin-top:var(--s-3)"></div>
        ${fieldHtml({ id: 'sv-role', name: 'role', label: 'Role', value: (t && t.roles[0]) || '', attrs: ' list="sv-roles"', className: 'stack' })}<datalist id="sv-roles">${(t ? t.roles : []).map(r => `<option value="${esc(r)}">`).join('')}</datalist>`,
      footer: '<button class="btn btn-secondary" type="button" data-close>Cancel</button><button class="btn btn-primary" type="button" id="sv-save">Assign selected</button>'
    });
    const picked = () => $$('input[type=checkbox]:checked', m.el).map(i => i.value);
    const check = () => {
      const w = []; picked().forEach(vid => Domain.conflictsFor({ id: '', volunteerId: vid, day: s.day, startTime: s.startTime, endTime: s.endTime, status: 'Active' }).forEach(c => w.push(`${Domain.volunteer(vid).name} already has ${Domain.teamName(c.teamId)} ${c.startTime}–${c.endTime}`)));
      if (picked().length > open) w.push(`Selecting ${picked().length} exceeds the ${open} open position(s)`);
      $('#sv-warn', m.el).innerHTML = w.length ? `<div class="alert alert-warn">${icon('alert')}<div><ul>${w.map(x => `<li>${esc(x)}</li>`).join('')}</ul></div></div>` : '';
    };
    m.el.addEventListener('change', check);
    $('#sv-save', m.el).addEventListener('click', async e => {
      const ids = picked();
      if (!ids.length) { UI.toast('Select at least one volunteer.', 'error'); return; }
      const role = $('#sv-role', m.el).value.trim() || 'Team Member';
      let made = 0;
      const done = await UI.attempt(async () => {
        for (const vid of ids) {
          await Store.insert('assignments', { volunteerId: vid, teamId: s.teamId, role, venueId: s.venueId || null, day: s.day, reportTime: s.reportTime, startTime: s.startTime, endTime: s.endTime, shiftId: s.id, leader: s.coordinator || (t && t.leader) || '', responsibilities: s.responsibilities, instructions: s.instructions, status: 'Active' });
          made++;
        }
      }, { btn: e.currentTarget });
      if (done) UI.toast(`${made} volunteer${made > 1 ? 's' : ''} assigned`);
      else if (made) UI.toast(`${made} of ${ids.length} were assigned before an error.`, 'error');
      if (done || made) { m.close(); draw(); }
    });
  }

  main.addEventListener('change', e => { if (e.target.id === 'fd') state.day = e.target.value; else if (e.target.id === 'ft') state.team = e.target.value; else return; draw(); });
  on(main, 'click', '[data-view]', (e, t) => { state.view = t.dataset.view; draw(); });
  on(main, 'click', '#new, #new2', () => form(null));
  on(main, 'click', '[data-edit]', (e, t) => form(t.dataset.edit));
  on(main, 'click', '[data-assign]', (e, t) => assignVolunteers(t.dataset.assign));
  on(main, 'click', '[data-del]', async (e, t) => {
    const s = Domain.shift(t.dataset.del); const n = Domain.shiftFilled(s);
    if (await UI.confirm({ title: `Delete “${s.name}”?`, message: n ? `${n} volunteer(s) are linked to this shift. Their assignments will stay, but will no longer be tied to a shift template.` : 'This shift will be removed.', confirmLabel: 'Delete', danger: true })) {
      if (await UI.attempt(() => Store.remove('shifts', s.id))) UI.toast('Shift deleted');
      draw();
    }
  });

  /* ---------- Public schedule sessions ---------- */
  const sessCard = document.createElement('section');
  sessCard.className = 'card';
  sessCard.style.marginTop = 'var(--s-5)';
  main.appendChild(sessCard);

  function drawSessions() {
    const list = Store.list('sessions').slice().sort((a, b) => (a.day === b.day ? Domain.toMin(a.startTime) - Domain.toMin(b.startTime) : (days.findIndex(d => d.id === a.day) - days.findIndex(d => d.id === b.day))));
    sessCard.innerHTML = `<div class="card-head"><div><h2>Public schedule sessions</h2><div class="muted small">These appear on the public Event Schedule page.</div></div><button class="btn btn-secondary btn-sm" type="button" id="snew">${icon('plus', 14)} Add session</button></div>` +
      (list.length ? `<div class="table-wrap"><table class="table table-cards"><thead><tr><th>Session</th><th>Day</th><th>Time</th><th>Venue</th><th>Team</th><th>Coordinator</th><th><span class="sr-only">Actions</span></th></tr></thead><tbody>
        ${list.map(x => `<tr><td data-label="Session" class="cell-strong">${esc(x.name)}</td><td data-label="Day">${esc(Domain.dayLabel(x.day))}</td><td data-label="Time" class="nowrap">${fmtRange(x.startTime, x.endTime)}</td><td data-label="Venue">${x.venueId ? esc(Domain.venueName(x.venueId)) : '—'}</td><td data-label="Team">${x.teamId ? esc(Domain.teamName(x.teamId)) : '—'}</td><td data-label="Coordinator">${esc(x.coordinator || '—')}</td>
          <td class="cell-actions"><div class="row-actions"><button class="btn btn-ghost btn-icon btn-sm" data-sedit="${x.id}" aria-label="Edit ${esc(x.name)}">${icon('edit', 16)}</button><button class="btn btn-danger-ghost btn-icon btn-sm" data-sdel="${x.id}" aria-label="Delete ${esc(x.name)}">${icon('trash', 16)}</button></div></td></tr>`).join('')}</tbody></table></div>`
        : UI.stateBlock({ icon: 'calendar', title: 'No sessions yet', text: 'Add sessions to build the public schedule.' }));
  }

  function sessionForm(id) {
    const x = id ? Store.get('sessions', id) : { name: '', day: state.day, startTime: '', endTime: '', venueId: '', teamId: '', coordinator: '', instructions: '' };
    const m = UI.openModal({
      title: id ? 'Edit session' : 'Add session', size: 'lg',
      body: `<form id="se-form" novalidate><div class="field-grid">
        ${fieldHtml({ id: 'se-name', name: 'name', label: 'Session name', required: true, value: x.name, className: 'span-2' })}
        ${fieldHtml({ id: 'se-day', name: 'day', label: 'Day', type: 'select', value: x.day, options: days.map(d => ({ value: d.id, label: Domain.dayLabel(d.id) })) })}
        ${fieldHtml({ id: 'se-team', name: 'teamId', label: 'Responsible team', type: 'select', value: x.teamId || '', options: [{ value: '', label: 'None' }, ...Domain.activeTeams().map(t => ({ value: t.id, label: t.name }))] })}
        ${fieldHtml({ id: 'se-start', name: 'startTime', label: 'Start time', type: 'time', required: true, value: x.startTime })}
        ${fieldHtml({ id: 'se-end', name: 'endTime', label: 'End time', type: 'time', required: true, value: x.endTime })}
        ${fieldHtml({ id: 'se-venue', name: 'venueId', label: 'Venue', type: 'select', value: x.venueId || '', options: [{ value: '', label: 'None' }, ...Domain.activeVenues().map(v => ({ value: v.id, label: v.name }))] })}
        ${fieldHtml({ id: 'se-coord', name: 'coordinator', label: 'Coordinator', value: x.coordinator })}
        ${fieldHtml({ id: 'se-instr', name: 'instructions', label: 'Instructions', type: 'textarea', rows: 2, value: x.instructions, className: 'span-2' })}
      </div></form>`,
      footer: `<button class="btn btn-secondary" type="button" data-close>Cancel</button><button class="btn btn-primary" type="button" id="se-save">${id ? 'Save session' : 'Add session'}</button>`
    });
    const f = $('#se-form', m.el);
    $('#se-save', m.el).addEventListener('click', async e => {
      UI.clearErrors(f);
      const rec = { name: val(f, 'name'), day: val(f, 'day'), teamId: val(f, 'teamId') || null, venueId: val(f, 'venueId') || null, startTime: val(f, 'startTime'), endTime: val(f, 'endTime'), coordinator: val(f, 'coordinator'), instructions: val(f, 'instructions') };
      const err = { name: rec.name.length < 2 ? 'Enter a session name.' : '', startTime: rec.startTime ? '' : 'Enter a start time.', endTime: !rec.endTime ? 'Enter an end time.' : (rec.startTime && Domain.toMin(rec.endTime) <= Domain.toMin(rec.startTime) ? 'End must be after start.' : '') };
      Object.keys(err).forEach(k => setError(f, k, err[k]));
      if (Object.values(err).some(Boolean)) return;
      const done = await UI.attempt(async () => {
        if (id) await Store.update('sessions', id, rec); else await Store.insert('sessions', rec);
        UI.toast(id ? 'Session updated' : 'Session added');
      }, { form: f, btn: e.currentTarget });
      if (done) { m.close(); drawSessions(); }
    });
  }
  on(main, 'click', '#snew', () => sessionForm(null));
  on(main, 'click', '[data-sedit]', (e, t) => sessionForm(t.dataset.sedit));
  on(main, 'click', '[data-sdel]', async (e, t) => {
    const x = Store.get('sessions', t.dataset.sdel);
    if (await UI.confirm({ title: `Delete “${x.name}”?`, message: 'It will disappear from the public schedule.', confirmLabel: 'Delete', danger: true })) {
      if (await UI.attempt(() => Store.remove('sessions', x.id))) UI.toast('Session deleted');
      drawSessions();
    }
  });
  drawSessions();
  draw();
});
