Boot.run(() => {
  'use strict';
  const { icon, esc, $, $$, on, fmtRange } = UI;
  const main = document.getElementById('main');
  const days = Store.settings().days;
  const f = { team: '', venue: '', day: '', status: '' };
  let current = 'volunteers';

  const asgRows = () => Domain.activeAssignments().map(a => ({ a, v: Domain.volunteer(a.volunteerId) })).filter(r => r.v);
  const slot = a => `${Domain.dayLabel(a.day)} ${a.startTime || '?'}–${a.endTime || '?'}`;
  const asgFilter = r => (!f.team || r.a.teamId === f.team) && (!f.venue || r.a.venueId === f.venue) && (!f.day || r.a.day === f.day);

  const REPORTS = {
    volunteers: {
      label: 'Volunteer report', icon: 'users', filters: ['team', 'status'],
      columns: [['id', 'Volunteer ID'], ['name', 'Name'], ['institution', 'Institution'], ['course', 'Course'], ['year', 'Year'], ['status', 'Status'], ['team', 'Team(s)'], ['role', 'Role(s)']],
      rows: () => Store.list('volunteers').filter(v => (!f.status || v.status === f.status) && (!f.team || Domain.assignmentsFor(v.id, { activeOnly: true }).some(a => a.teamId === f.team)))
        .map(v => { const acts = Domain.assignmentsFor(v.id, { activeOnly: true }); return { id: Domain.volCode(v), name: v.name, institution: v.institution, course: v.course, year: v.year, status: v.status, team: acts.map(a => Domain.teamName(a.teamId)).join('; '), role: acts.map(a => a.role).join('; ') }; }),
      summary: rows => [['Volunteers', rows.length], ['Approved', rows.filter(r => r.status === 'Approved').length], ['Pending', rows.filter(r => r.status === 'Pending').length], ['Rejected', rows.filter(r => r.status === 'Rejected').length]]
    },
    team: {
      label: 'Team-wise roster', icon: 'group', filters: ['team', 'day'],
      columns: [['team', 'Team'], ['name', 'Volunteer'], ['id', 'Volunteer ID'], ['role', 'Role'], ['shift', 'Shift'], ['leader', 'Reports to']],
      rows: () => asgRows().filter(asgFilter).map(({ a, v }) => ({ team: Domain.teamName(a.teamId), name: v.name, id: Domain.volCode(v), role: a.role, shift: slot(a), leader: Domain.leaderFor(a) })).sort((x, y) => x.team.localeCompare(y.team) || x.name.localeCompare(y.name)),
      summary: rows => [['Rows', rows.length], ['Teams', new Set(rows.map(r => r.team)).size], ['Volunteers', new Set(rows.map(r => r.id)).size]]
    },
    venue: {
      label: 'Venue-wise roster', icon: 'building', filters: ['venue', 'day'],
      columns: [['venue', 'Venue'], ['name', 'Volunteer'], ['id', 'Volunteer ID'], ['team', 'Team'], ['role', 'Role'], ['shift', 'Shift']],
      rows: () => asgRows().filter(asgFilter).map(({ a, v }) => ({ venue: Domain.venueName(a.venueId), name: v.name, id: Domain.volCode(v), team: Domain.teamName(a.teamId), role: a.role, shift: slot(a) })).sort((x, y) => x.venue.localeCompare(y.venue) || x.name.localeCompare(y.name)),
      summary: rows => [['Rows', rows.length], ['Venues', new Set(rows.map(r => r.venue)).size], ['Volunteers', new Set(rows.map(r => r.id)).size]]
    },
    shift: {
      label: 'Shift-wise roster', icon: 'clock', filters: ['team', 'day'],
      columns: [['shift', 'Shift'], ['report', 'Report'], ['name', 'Volunteer'], ['id', 'Volunteer ID'], ['team', 'Team'], ['role', 'Role']],
      rows: () => asgRows().filter(asgFilter).sort((x, y) => (x.a.day === y.a.day ? Domain.toMin(x.a.startTime) - Domain.toMin(y.a.startTime) : x.a.day === 'setup' ? -1 : 1))
        .map(({ a, v }) => ({ shift: slot(a), report: a.reportTime || 'TBC', name: v.name, id: Domain.volCode(v), team: Domain.teamName(a.teamId), role: a.role })),
      summary: rows => [['Rows', rows.length], ['Distinct shifts', new Set(rows.map(r => r.shift)).size], ['Volunteers', new Set(rows.map(r => r.id)).size]]
    },
    unassigned: {
      label: 'Unassigned volunteers', icon: 'user', filters: [],
      columns: [['id', 'Volunteer ID'], ['name', 'Name'], ['institution', 'Institution'], ['skills', 'Skills'], ['areas', 'Preferred areas'], ['availability', 'Availability']],
      rows: () => Domain.approved().filter(v => !Domain.isAssigned(v)).map(v => ({ id: Domain.volCode(v), name: v.name, institution: v.institution, skills: v.skills.join('; '), areas: v.areas.map(Domain.teamName).join('; '), availability: (v.availability || []).join('; ') })),
      summary: rows => [['Unassigned', rows.length], ['Approved total', Domain.approved().length]]
    },
    attendance: {
      label: 'Attendance report', icon: 'checksquare', filters: ['team', 'day', 'status'],
      columns: [['name', 'Volunteer'], ['id', 'Volunteer ID'], ['team', 'Team'], ['venue', 'Venue'], ['shift', 'Shift'], ['status', 'Status'], ['checkIn', 'Check-in'], ['notes', 'Notes']],
      rows: () => asgRows().filter(asgFilter).map(({ a, v }) => { const t = Domain.attendanceFor(a.id); return { name: v.name, id: Domain.volCode(v), team: Domain.teamName(a.teamId), venue: Domain.venueName(a.venueId), shift: slot(a), status: t.status, checkIn: t.checkIn, notes: t.notes }; }).filter(r => !f.status || r.status === f.status),
      summary: rows => ['Present', 'Late', 'Absent', 'Excused', 'Not Marked'].map(s => [s, rows.filter(r => r.status === s).length])
    }
  };

  const FILTER_UI = {
    team: () => `<div class="field"><label for="r-team">Team</label><select class="select" id="r-team" data-f="team"><option value="">All teams</option>${Domain.activeTeams().map(t => `<option value="${t.id}"${f.team === t.id ? ' selected' : ''}>${esc(t.name)}</option>`).join('')}</select></div>`,
    venue: () => `<div class="field"><label for="r-venue">Venue</label><select class="select" id="r-venue" data-f="venue"><option value="">All venues</option>${Domain.activeVenues().map(v => `<option value="${v.id}"${f.venue === v.id ? ' selected' : ''}>${esc(v.name)}</option>`).join('')}</select></div>`,
    day: () => `<div class="field"><label for="r-day">Day</label><select class="select" id="r-day" data-f="day"><option value="">All days</option>${days.map(d => `<option value="${d.id}"${f.day === d.id ? ' selected' : ''}>${esc(Domain.dayLabel(d.id))}</option>`).join('')}</select></div>`,
    status: () => `<div class="field"><label for="r-status">Status</label><select class="select" id="r-status" data-f="status"><option value="">All</option>${(current === 'attendance' ? ['Present', 'Late', 'Absent', 'Excused', 'Not Marked'] : ['Approved', 'Pending', 'Rejected']).map(s => `<option${f.status === s ? ' selected' : ''}>${s}</option>`).join('')}</select></div>`
  };

  main.innerHTML = `${Shell.pageHead('Reports & Exports', 'Pick a report, filter it, then export CSV or print.',
    `<button class="btn btn-secondary" type="button" id="print">${icon('print', 16)} Print view</button><button class="btn btn-primary" type="button" id="csv">${icon('download', 16)} Export CSV</button>`)}
    <div class="report-layout"><nav class="card report-nav report-nav-card" aria-label="Reports">${Object.entries(REPORTS).map(([k, r]) => `<button type="button" data-report="${k}">${icon(r.icon, 16)} ${r.label}</button>`).join('')}</nav>
    <div id="report-area"></div></div>`;

  function draw() {
    $$('[data-report]', main).forEach(b => b.setAttribute('aria-current', b.dataset.report === current));
    const r = REPORTS[current], rows = r.rows();
    $('#report-area').innerHTML = `<div class="stat-grid" style="grid-template-columns:repeat(auto-fit,minmax(150px,1fr))">${r.summary(rows).map(([k, v]) => `<div class="card stat"><div class="stat-top"><span>${esc(k)}</span></div><div class="stat-val">${v}</div></div>`).join('')}</div>
      <section class="card" id="report-card"><div class="print-title"><h1>Anubhav — ${esc(r.label)}</h1><p>Generated ${new Date().toLocaleString('en-IN')}</p></div>
      ${r.filters.length ? `<div class="toolbar report-filters">${r.filters.map(k => FILTER_UI[k]()).join('')}<button class="btn btn-ghost" type="button" id="reset-f">Clear filters</button></div>` : ''}
      <div class="card-head"><h2>${esc(r.label)}</h2><span class="muted small">${rows.length} row${rows.length === 1 ? '' : 's'}</span></div>
      ${rows.length ? `<div class="table-wrap"><table class="table"><thead><tr>${r.columns.map(c => `<th>${esc(c[1])}</th>`).join('')}</tr></thead><tbody>${rows.map(row => `<tr>${r.columns.map(c => `<td>${esc(row[c[0]] == null || row[c[0]] === '' ? '—' : row[c[0]])}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`
        : UI.stateBlock({ icon: 'chart', title: 'Nothing to report', text: 'No records match the current filters.' })}</section>`;
  }

  main.addEventListener('change', e => { const k = e.target.dataset.f; if (k) { f[k] = e.target.value; draw(); } });
  on(main, 'click', '[data-report]', (e, t) => { current = t.dataset.report; Object.assign(f, { team: '', venue: '', day: '', status: '' }); draw(); });
  on(main, 'click', '#reset-f', () => { Object.assign(f, { team: '', venue: '', day: '', status: '' }); draw(); });
  on(main, 'click', '#print', () => window.print());
  on(main, 'click', '#csv', () => {
    const r = REPORTS[current], rows = r.rows();
    if (!rows.length) { UI.toast('Nothing to export for these filters.', 'error'); return; }
    UI.downloadCSV(`anubhav-${current}-report.csv`, r.columns.map(c => ({ key: c[0], label: c[1] })), rows);
  });
  draw();
});
