Boot.run(() => {
  'use strict';
  const { icon, esc, badge, fmtRange, fmtTime, timeAgo, $, on } = UI;
  const main = document.getElementById('main');
  const state = { q: '', team: '', status: '', issues: '', page: 1 };
  const PAGE = 10;

  main.innerHTML = `${Shell.pageHead('Assignments', 'Create and edit volunteer assignments. Changes appear on the public Find My Role page as soon as they are saved.',
    `<button class="btn btn-secondary" type="button" id="exp">${icon('download', 16)} Export CSV</button><button class="btn btn-primary" type="button" id="new">${icon('plus', 16)} New assignment</button>`)}
    <div id="summary" class="stat-grid"></div>
    <section class="card">
      <div class="toolbar">
        <div class="field grow"><label for="q">Search volunteer</label><div class="input-icon"><span aria-hidden="true">${icon('search', 16)}</span><input class="input" id="q" type="search" placeholder="Name or Volunteer ID"></div></div>
        <div class="field"><label for="ft">Team</label><select class="select" id="ft"><option value="">All teams</option>${Domain.activeTeams().map(t => `<option value="${t.id}">${esc(t.name)}</option>`).join('')}</select></div>
        <div class="field"><label for="fs">Status</label><select class="select" id="fs"><option value="">All</option><option>Active</option><option>Draft</option><option>Cancelled</option></select></div>
        <div class="field"><label for="fi">Warnings</label><select class="select" id="fi"><option value="">All</option><option value="warn">With warnings</option><option value="ok">No warnings</option></select></div>
      </div>
      <div id="list"></div></section>`;

  function filtered() {
    const q = state.q.toLowerCase();
    return Store.list('assignments').filter(a => {
      const v = Domain.volunteer(a.volunteerId); if (!v) return false;
      if (q && !(v.name.toLowerCase().includes(q) || Domain.volCode(v).toLowerCase().includes(q))) return false;
      if (state.team && a.teamId !== state.team) return false;
      if (state.status && a.status !== state.status) return false;
      const iss = Domain.assignmentIssues(a).length;
      if (state.issues === 'warn' && !iss) return false;
      if (state.issues === 'ok' && iss) return false;
      return true;
    }).sort((x, y) => (y.updatedAt || '').localeCompare(x.updatedAt || ''));
  }

  function draw() {
    const all = Store.list('assignments'), st = Domain.stats();
    const warn = all.filter(a => a.status === 'Active' && Domain.assignmentIssues(a).length).length;
    $('#summary').innerHTML = [['Active assignments', all.filter(a => a.status === 'Active').length, 'clipboard', ''], ['Drafts', all.filter(a => a.status === 'Draft').length, 'edit', ''], ['With warnings', warn, 'alert', warn ? 'stat-warn' : ''], ['Volunteers to assign', st.unassigned, 'user', st.unassigned ? 'stat-warn' : '']]
      .map(c => `<div class="card stat ${c[3]}"><div class="stat-top"><span>${c[0]}</span><span class="stat-ic">${icon(c[2], 17)}</span></div><div class="stat-val">${c[1]}</div></div>`).join('');
    const list = filtered(); const pg = UI.paginate(list, state.page, PAGE); state.page = pg.page;
    if (!list.length) { $('#list').innerHTML = UI.stateBlock({ icon: 'clipboard', title: all.length ? 'No assignments match' : 'No assignments yet', text: all.length ? 'Adjust the filters to see more.' : 'Create the first assignment to get started.', action: `<button class="btn btn-primary" type="button" id="new2">New assignment</button>` }); return; }
    $('#list').innerHTML = `<div class="table-wrap"><table class="table table-cards"><thead><tr><th>Volunteer</th><th>Team</th><th>Role</th><th>Venue</th><th>Reporting</th><th>Shift</th><th>Status</th><th>Updated</th><th><span class="sr-only">Actions</span></th></tr></thead><tbody>
      ${pg.slice.map(a => { const v = Domain.volunteer(a.volunteerId); const iss = Domain.assignmentIssues(a); return `<tr>
        <td data-label="Volunteer"><span class="cell-strong">${esc(v.name)}</span><span class="cell-sub">${esc(Domain.volCode(v))}</span></td>
        <td data-label="Team">${esc(Domain.teamName(a.teamId))}</td><td data-label="Role">${esc(a.role)}</td><td data-label="Venue">${esc(Domain.venueName(a.venueId))}</td>
        <td data-label="Reporting" class="nowrap">${a.reportTime ? fmtTime(a.reportTime) : '<span class="warn-inline">Missing</span>'}<span class="cell-sub">${esc(Domain.dayLabel(a.day))}</span></td>
        <td data-label="Shift" class="nowrap">${a.startTime ? fmtRange(a.startTime, a.endTime) : '—'}${iss.length && a.status === 'Active' ? `<span class="warn-inline" style="display:flex" title="${esc(iss.join('; '))}">${icon('alert', 12)} ${iss.length} warning${iss.length > 1 ? 's' : ''}</span>` : ''}</td>
        <td data-label="Status">${badge(a.status)}</td><td data-label="Updated" class="muted nowrap">${timeAgo(a.updatedAt)}</td>
        <td class="cell-actions"><div class="row-actions"><button class="btn btn-ghost btn-icon btn-sm" data-edit="${a.id}" aria-label="Edit assignment for ${esc(v.name)}" title="Edit">${icon('edit', 16)}</button>
        <button class="btn btn-danger-ghost btn-icon btn-sm" data-del="${a.id}" aria-label="Remove assignment for ${esc(v.name)}" title="Remove">${icon('trash', 16)}</button></div></td></tr>`; }).join('')}
      </tbody></table></div>${UI.paginationHtml(pg, 'assignments')}`;
  }

  const deb = UI.debounce(() => { state.page = 1; draw(); }, 200);
  main.addEventListener('input', e => { if (e.target.id === 'q') { state.q = e.target.value; deb(); } });
  main.addEventListener('change', e => {
    const m = { ft: 'team', fs: 'status', fi: 'issues' }[e.target.id];
    if (m) { state[m] = e.target.value; state.page = 1; draw(); }
  });
  on(main, 'click', '[data-page]', (e, t) => { state.page = Number(t.dataset.page); draw(); });
  on(main, 'click', '#new, #new2', () => AssignmentForm.open({ onSave: draw }));
  on(main, 'click', '[data-edit]', (e, t) => AssignmentForm.open({ assignmentId: t.dataset.edit, onSave: draw }));
  on(main, 'click', '[data-del]', async (e, t) => {
    const a = Store.get('assignments', t.dataset.del), v = Domain.volunteer(a.volunteerId);
    if (await UI.confirm({ title: 'Remove this assignment?', message: `${esc(v.name)} will no longer be assigned as <strong>${esc(a.role)}</strong> (${esc(Domain.teamName(a.teamId))}). This also removes it from Find My Role.`, confirmLabel: 'Remove', danger: true })) {
      if (await UI.attempt(() => Store.remove('assignments', a.id))) UI.toast('Assignment removed');
      draw();
    }
  });
  on(main, 'click', '#exp', () => UI.downloadCSV('anubhav-assignments.csv', [
    { key: 'id', label: 'Volunteer ID' }, { key: 'name', label: 'Volunteer' }, { key: 'team', label: 'Team' }, { key: 'role', label: 'Role' }, { key: 'venue', label: 'Venue' }, { key: 'day', label: 'Day' },
    { key: 'report', label: 'Reporting time' }, { key: 'start', label: 'Shift start' }, { key: 'end', label: 'Shift end' }, { key: 'status', label: 'Status' }, { key: 'warnings', label: 'Warnings' }
  ], filtered().map(a => { const v = Domain.volunteer(a.volunteerId); return { id: Domain.volCode(v), name: v.name, team: Domain.teamName(a.teamId), role: a.role, venue: Domain.venueName(a.venueId), day: Domain.dayLabel(a.day), report: a.reportTime, start: a.startTime, end: a.endTime, status: a.status, warnings: Domain.assignmentIssues(a).join('; ') }; })));

  Shell.onRefresh(draw);
  draw();
  if (new URLSearchParams(location.search).get('new')) AssignmentForm.open({ onSave: draw });
});
