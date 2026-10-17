Boot.run(() => {
  'use strict';
  if (Shell.guardVisibility('teams', 'Teams')) return;
  const { icon, esc, fmtRange, fmtTime, on } = UI;
  const main = document.getElementById('main');

  const teams = Domain.activeTeams();
  main.innerHTML = `
    <div class="page-hero"><div class="container"><span class="eyebrow">The people behind Anubhav</span><h1>Event Teams</h1>
      <p>Every volunteer belongs to a team. Browse the teams, their leaders and responsibilities.</p></div></div>
    <div class="container section">
      ${teams.length ? `<div class="grid grid-3">${teams.map(t => {
        const uniq = t.memberCount;
        return `<article class="card team-card">
          <h3>${esc(t.name)}</h3><p class="desc">${esc(t.description)}</p>
          <div class="team-meta">
            <div>${icon('user', 16)}<span><strong>Leader:</strong> ${esc(t.leader || 'To be announced')}</span></div>
            <div>${icon('users', 16)}<span>${uniq} member${uniq === 1 ? '' : 's'}</span></div>
            <div>${icon('pin', 16)}<span>${esc(Domain.venueName(t.venueId))}</span></div>
          </div>
          <div>${t.responsibilities.slice(0, 3).map(r => `<span class="chip">${esc(r)}</span>`).join('')}</div>
          <div class="foot"><button class="btn btn-secondary btn-sm" type="button" data-team="${t.id}">View Team ${icon('chevright', 14)}</button></div></article>`;
      }).join('')}</div>` : `<div class="card">${UI.stateBlock({ icon: 'group', title: 'No teams published yet', text: 'Teams will appear here once the organisers create them.' })}</div>`}
    </div>`;

  function detail(id) {
    const t = Domain.team(id);
    const members = t.members;
    const shifts = Domain.teamShifts(id);
    UI.openModal({
      title: esc(t.name), size: 'lg', drawer: false,
      body: `<p>${esc(t.description)}</p>
        <div class="grid grid-2" style="margin-bottom:var(--s-4)">
          <dl class="kv"><dt>Team leader</dt><dd>${esc(t.leader || 'To be announced')}</dd><dt>Assistant leader</dt><dd>${esc(t.assistant || '—')}</dd><dt>Venue</dt><dd>${esc(Domain.venueName(t.venueId))}</dd></dl>
          <div><div class="fieldset-label" style="margin-bottom:6px">Main responsibilities</div>${t.responsibilities.map(r => `<span class="chip">${esc(r)}</span>`).join('')}</div></div>
        ${t.instructions ? `<div class="alert alert-info" style="margin-bottom:var(--s-4)">${icon('info')}<div><strong>Team guidance</strong>${esc(t.instructions)}</div></div>` : ''}
        <h3 style="margin-bottom:var(--s-2)">Shifts</h3>
        <div class="table-wrap" style="margin-bottom:var(--s-4)"><table class="table table-cards"><thead><tr><th>Shift</th><th>Day</th><th>Reporting</th><th>Time</th></tr></thead><tbody>
          ${shifts.map(s => `<tr><td data-label="Shift" class="cell-strong">${esc((s.name.split('—')[1] || s.name).trim())}</td><td data-label="Day">${esc(Domain.dayLabel(s.day))}</td><td data-label="Reporting">${s.reportTime ? fmtTime(s.reportTime) : 'TBC'}</td><td data-label="Time">${fmtRange(s.startTime, s.endTime)}</td></tr>`).join('') || '<tr><td colspan="4" class="muted">No shifts yet.</td></tr>'}
        </tbody></table></div>
        <h3 style="margin-bottom:var(--s-2)">Members (${t.memberCount})</h3>
        ${members.length ? `<ul class="member-list">${members.map(m => `<li><span class="avatar">${UI.initials(m.name)}</span><div class="grow"><strong>${esc(m.name)}</strong><div class="small muted">${esc(m.role)} · ${esc(Domain.dayLabel(m.day))} ${fmtRange(m.startTime, m.endTime)}</div></div></li>`).join('')}</ul>`
          : UI.stateBlock({ icon: 'users', title: t.memberCount ? 'Member names are not shown publicly' : 'No members assigned yet', text: t.memberCount ? 'The organisers have chosen not to list names on this page.' : 'Volunteers will appear here once assignments are published.' })}`,
      footer: '<button type="button" class="btn btn-secondary" data-close>Close</button>'
    });
  }
  on(main, 'click', '[data-team]', (e, t) => detail(t.dataset.team));
});
