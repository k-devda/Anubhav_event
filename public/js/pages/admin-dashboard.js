Boot.run(() => {
  'use strict';
  const { icon, esc, badge, fmtRange, fmtDate, timeAgo } = UI;
  const main = document.getElementById('main');

  function render() {
    const st = Domain.stats();
    const cards = [
      ['Total Volunteers', st.total, 'users', 'volunteers.html', `${st.rejected} rejected`, ''],
      ['Approved Volunteers', st.approved, 'check', 'volunteers.html?status=Approved', 'Ready to assign', 'stat-ok'],
      ['Pending Registrations', st.pending, 'clock', 'volunteers.html?status=Pending', 'Need review', st.pending ? 'stat-warn' : ''],
      ['Assigned Volunteers', st.assigned, 'clipboard', 'assignments.html', 'With an active assignment', ''],
      ['Unassigned Volunteers', st.unassigned, 'user', 'volunteers.html?assign=Unassigned', 'Approved, no role yet', st.unassigned ? 'stat-warn' : ''],
      ['Total Teams', st.teams, 'group', 'teams.html', 'Active teams', ''],
      ['Total Venues', st.venues, 'building', 'venues.html', 'Active venues', ''],
      ['Vacant Positions', st.vacancies, 'alert', 'shifts.html', `of ${st.positions} shift positions`, st.vacancies ? 'stat-warn' : '']
    ];
    const recent = Store.list('volunteers').slice().sort((a, b) => b.registeredAt.localeCompare(a.registeredAt)).slice(0, 6);
    const upcoming = Store.list('shifts').slice().sort((a, b) => (a.day === b.day ? Domain.toMin(a.startTime) - Domain.toMin(b.startTime) : (a.day === 'setup' ? -1 : 1))).slice(0, 6);
    const pct = st.approved ? Math.round(st.assigned / st.approved * 100) : 0;
    const teams = Domain.activeTeams().map(t => ({ t, n: new Set(Domain.teamMembers(t.id).map(m => m.volunteer.id)).size }));
    const maxN = Math.max(1, ...teams.map(x => x.n));
    const activity = Store.list('activity').slice(0, 7);

    main.innerHTML = `${Shell.pageHead('Dashboard', 'A live summary of your event — every number comes from the database.', `<a class="btn btn-secondary" href="reports.html">${icon('chart', 16)} Reports</a>`)}
      <div class="quick-actions" aria-label="Quick actions">
        <a class="btn btn-primary" href="volunteers.html?status=Pending">${icon('check', 16)} Review pending (${st.pending})</a>
        <a class="btn btn-secondary" href="assignments.html?new=1">${icon('plus', 16)} New assignment</a>
        <a class="btn btn-secondary" href="announcements.html?new=1">${icon('megaphone', 16)} Post announcement</a>
        <a class="btn btn-secondary" href="attendance.html">${icon('checksquare', 16)} Mark attendance</a>
        <a class="btn btn-secondary" href="teams.html?new=1">${icon('group', 16)} Create team</a></div>
      <div class="stat-grid">${cards.map(c => `<a class="card stat ${c[5]}" href="${c[3]}"><div class="stat-top"><span>${c[0]}</span><span class="stat-ic">${icon(c[2], 17)}</span></div><div class="stat-val">${c[1]}</div><div class="stat-note">${c[4]}</div></a>`).join('')}</div>

      <div class="dash-grid">
        <section class="card"><div class="card-head"><h2>Recent registrations</h2><a class="btn btn-ghost btn-sm" href="volunteers.html">View all</a></div>
          <div class="table-wrap"><table class="table table-cards"><thead><tr><th>Volunteer</th><th>Institution</th><th>Registered</th><th>Status</th></tr></thead><tbody>
          ${recent.map(v => `<tr><td data-label="Volunteer"><span class="cell-strong">${esc(v.name)}</span><span class="cell-sub">${esc(Domain.volCode(v))}</span></td><td data-label="Institution">${esc(v.institution)}</td><td data-label="Registered">${fmtDate(v.registeredAt)}</td><td data-label="Status">${badge(v.status)}</td></tr>`).join('')}
          </tbody></table></div></section>
        <section class="card"><div class="card-head"><h2>Assignment completion</h2></div><div class="card-body row" style="gap:var(--s-5);flex-wrap:nowrap">
          <div class="donut" style="--p:${pct}" role="img" aria-label="${pct}% of approved volunteers assigned"><div>${pct}%<small>assigned</small></div></div>
          <ul class="legend"><li><span class="sw"></span>${st.assigned} assigned</li><li><span class="sw alt"></span>${st.unassigned} still to assign</li><li class="muted">of ${st.approved} approved</li>
          <li><a href="volunteers.html?assign=Unassigned">Assign them →</a></li></ul></div></section>
      </div>

      <div class="dash-grid">
        <section class="card"><div class="card-head"><h2>Team-wise volunteers</h2><a class="btn btn-ghost btn-sm" href="teams.html">Manage teams</a></div><div class="card-body">
          ${teams.map(({ t, n }) => { const vac = Domain.teamVacancies(t.id); return `<div class="bar-row"><span class="label" title="${esc(t.name)}">${esc(t.name)}</span><div class="progress ${vac ? 'gold' : ''}" style="--v:${Math.round(n / maxN * 100)}"><span></span></div><span class="num">${n}</span></div>`; }).join('')}
          <p class="small muted" style="margin:0">Bars show distinct active volunteers per team.</p></div></section>
        <section class="card"><div class="card-head"><h2>Upcoming shifts</h2><a class="btn btn-ghost btn-sm" href="shifts.html">All shifts</a></div><div class="card-body" style="padding-top:var(--s-2);padding-bottom:var(--s-2)">
          ${upcoming.map(s => { const filled = Domain.shiftFilled(s); return `<div class="shift-item"><div class="when">${UI.fmtTime(s.startTime)}</div><div class="what"><strong>${esc(s.name)}</strong><span class="muted small">${esc(Domain.dayLabel(s.day))} · ${esc(Domain.venueName(s.venueId))}</span></div>${badge(`${filled}/${s.positions}`, filled >= s.positions ? 'ok' : 'warn')}</div>`; }).join('')}
        </div></section>
      </div>

      <section class="card"><div class="card-head"><h2>Recent activity</h2></div><div class="card-body">
        ${activity.length ? `<ul class="activity">${activity.map(a => `<li><span class="dot"></span><div>${esc(a.text)}<time datetime="${a.at}">${timeAgo(a.at)}${a.userName ? ' · ' + esc(a.userName) : ''}</time></div></li>`).join('')}</ul>` : UI.stateBlock({ icon: 'clock', title: 'No activity yet', text: 'Changes made by your team appear here.' })}
      </div></section>`;
  }
  render();
  Store.subscribe(render);
});
