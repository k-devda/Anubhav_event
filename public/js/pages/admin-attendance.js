Boot.run(() => {
  'use strict';
  const { icon, esc, badge, fmtRange, $, on } = UI;
  const main = document.getElementById('main');
  const STATUSES = ['Not Marked', 'Present', 'Absent', 'Late', 'Excused'];
  const state = { team: '', shift: '', status: '', day: '' };
  const days = Store.settings().days;

  main.innerHTML = `${Shell.pageHead('Attendance', 'Mark who has checked in. Each change is saved as you make it.',
    `<button class="btn btn-secondary" type="button" id="mark-present">${icon('check', 16)} Mark all shown as Present</button><button class="btn btn-secondary" type="button" id="exp">${icon('download', 16)} Export CSV</button>`)}
    <section class="card">
      <div class="toolbar">
        <div class="field"><label for="fd">Day</label><select class="select" id="fd"><option value="">All days</option>${days.map(d => `<option value="${d.id}">${esc(Domain.dayLabel(d.id))}</option>`).join('')}</select></div>
        <div class="field"><label for="ft">Team</label><select class="select" id="ft"><option value="">All teams</option>${Domain.activeTeams().map(t => `<option value="${t.id}">${esc(t.name)}</option>`).join('')}</select></div>
        <div class="field"><label for="fsh">Shift</label><select class="select" id="fsh"></select></div>
        <div class="field"><label for="fst">Status</label><select class="select" id="fst"><option value="">All</option>${STATUSES.map(s => `<option>${s}</option>`).join('')}</select></div>
      </div>
      <div class="mini-stats" id="mini"></div><div id="out"></div></section>`;

  function shiftOptions() {
    const opts = Store.list('shifts').filter(s => (!state.team || s.teamId === state.team) && (!state.day || s.day === state.day));
    $('#fsh').innerHTML = `<option value="">All shifts</option>` + opts.map(s => `<option value="${s.id}"${state.shift === s.id ? ' selected' : ''}>${esc(s.name)}</option>`).join('');
    if (!opts.some(s => s.id === state.shift)) state.shift = '';
  }

  const rows = () => Domain.activeAssignments().filter(a => (!state.team || a.teamId === state.team) && (!state.day || a.day === state.day) && (!state.shift || a.shiftId === state.shift))
    .map(a => ({ a, v: Domain.volunteer(a.volunteerId), att: Domain.attendanceFor(a.id) })).filter(r => r.v && (!state.status || r.att.status === state.status))
    .sort((x, y) => x.v.name.localeCompare(y.v.name));

  function draw() {
    const list = rows();
    const counts = Object.fromEntries(STATUSES.map(s => [s, list.filter(r => r.att.status === s).length]));
    $('#mini').innerHTML = STATUSES.map(s => `<span>${badge(`${s}: ${counts[s]}`)}</span>`).join('') + `<span class="muted small" style="align-self:center">${list.length} volunteer assignment(s) shown</span>`;
    $('#out').innerHTML = !list.length ? UI.stateBlock({ icon: 'checksquare', title: 'No assignments to mark', text: 'Adjust the filters, or create assignments first.' })
      : `<div class="table-wrap"><table class="table table-cards"><thead><tr><th>Volunteer</th><th>Team</th><th>Venue</th><th>Shift</th><th>Status</th><th>Check-in</th><th>Notes</th></tr></thead><tbody>
        ${list.map(({ a, v, att }) => `<tr data-id="${a.id}"><td data-label="Volunteer"><span class="cell-strong">${esc(v.name)}</span><span class="cell-sub">${esc(Domain.volCode(v))} · ${esc(a.role)}</span></td>
          <td data-label="Team">${esc(Domain.teamName(a.teamId))}</td><td data-label="Venue">${esc(Domain.venueName(a.venueId))}</td><td data-label="Shift" class="nowrap">${fmtRange(a.startTime, a.endTime)}<span class="cell-sub">${esc(Domain.dayLabel(a.day))}</span></td>
          <td data-label="Status"><select class="select select-sm att-select att-${att.status.toLowerCase().replace(' ', '')}" data-status aria-label="Attendance status for ${esc(v.name)}">${STATUSES.map(s => `<option${s === att.status ? ' selected' : ''}>${s}</option>`).join('')}</select></td>
          <td data-label="Check-in"><input class="input input-sm" type="time" data-checkin value="${esc(att.checkIn)}" aria-label="Check-in time for ${esc(v.name)}" style="width:120px"></td>
          <td data-label="Notes"><input class="input input-sm" type="text" data-notes value="${esc(att.notes)}" placeholder="Add note" aria-label="Notes for ${esc(v.name)}" maxlength="200"></td></tr>`).join('')}</tbody></table></div>`;
  }

  async function save(id, patch) {
    const cur = Domain.attendanceFor(id);
    return Store.upsert('attendance', Object.assign({}, cur, patch, { id }));
  }
  const nowHM = () => { const d = new Date(); return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };

  main.addEventListener('change', async e => {
    const t = e.target;
    const map = { fd: 'day', ft: 'team', fsh: 'shift', fst: 'status' };
    if (map[t.id]) { state[map[t.id]] = t.value; if (t.id === 'fd' || t.id === 'ft') shiftOptions(); draw(); return; }
    const tr = t.closest('tr[data-id]'); if (!tr) return;
    const id = tr.dataset.id;
    if (t.matches('[data-status]')) {
      const s = t.value, cur = Domain.attendanceFor(id);
      const patch = { status: s };
      if ((s === 'Present' || s === 'Late') && !cur.checkIn) patch.checkIn = nowHM();
      if (s === 'Absent' || s === 'Not Marked') patch.checkIn = '';
      await UI.attempt(() => save(id, patch));
      draw();
    } else if (t.matches('[data-checkin]')) { if (!await UI.attempt(() => save(id, { checkIn: t.value }))) draw(); }
    else if (t.matches('[data-notes]')) { if (!await UI.attempt(() => save(id, { notes: t.value.trim() }))) draw(); }
  });
  on(main, 'click', '#mark-present', async () => {
    const list = rows().filter(r => r.att.status !== 'Present');
    if (!list.length) { UI.toast('Everyone shown is already marked Present.'); return; }
    if (await UI.confirm({ title: `Mark ${list.length} as Present?`, message: 'This sets the status for every volunteer currently shown and stamps the current time as check-in where empty.', confirmLabel: 'Mark present' })) {
      let n = 0;
      const ok = await UI.attempt(async () => { for (const r of list) { await save(r.a.id, { status: 'Present', checkIn: r.att.checkIn || nowHM() }); n++; } });
      UI.toast(ok ? `${n} marked Present` : `${n} marked Present before an error stopped the rest`, ok ? undefined : 'error');
      draw();
    }
  });
  on(main, 'click', '#exp', () => UI.downloadCSV('anubhav-attendance.csv', [
    { key: 'name', label: 'Volunteer' }, { key: 'id', label: 'Volunteer ID' }, { key: 'team', label: 'Team' }, { key: 'venue', label: 'Venue' }, { key: 'shift', label: 'Shift' }, { key: 'status', label: 'Status' }, { key: 'checkIn', label: 'Check-in' }, { key: 'notes', label: 'Notes' }
  ], rows().map(({ a, v, att }) => ({ name: v.name, id: Domain.volCode(v), team: Domain.teamName(a.teamId), venue: Domain.venueName(a.venueId), shift: `${Domain.dayLabel(a.day)} ${a.startTime}-${a.endTime}`, status: att.status, checkIn: att.checkIn, notes: att.notes }))));

  Shell.onRefresh(draw);
  shiftOptions(); draw();
});
