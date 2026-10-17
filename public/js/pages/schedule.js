Boot.run(() => {
  'use strict';
  if (Shell.guardVisibility('schedule', 'Event schedule')) return;
  const { icon, esc, fmtTime, fmtRange, on, $ } = UI;
  const main = document.getElementById('main');
  const days = Store.settings().days;
  let day = days[days.length - 1].id;
  let view = 'timeline';

  main.innerHTML = `
    <div class="page-hero"><div class="container"><span class="eyebrow">Plan your day</span><h1>Event Schedule</h1>
      <p>Sessions, venues and the teams that run them.</p></div></div>
    <div class="container section">
      <div class="day-tabs" id="tabs"></div>
      <div id="out"></div>
    </div>`;

  function render() {
    $('#tabs').innerHTML = `<div class="segmented" role="group" aria-label="Select day">${days.map(d => `<button type="button" data-day="${d.id}" aria-pressed="${d.id === day}">${esc(Domain.dayLabel(d.id))}</button>`).join('')}</div>
      <span class="spacer"></span>
      <div class="segmented" role="group" aria-label="Select view"><button type="button" data-view="timeline" aria-pressed="${view === 'timeline'}">${icon('gantt', 15)} Timeline</button><button type="button" data-view="table" aria-pressed="${view === 'table'}">${icon('list', 15)} Table</button></div>`;
    const items = Store.list('sessions').filter(s => s.day === day).sort((a, b) => Domain.toMin(a.startTime) - Domain.toMin(b.startTime));
    const out = $('#out');
    if (!items.length) { out.innerHTML = `<div class="card">${UI.stateBlock({ icon: 'calendar', title: 'No sessions for this day', text: 'Nothing has been scheduled yet.' })}</div>`; return; }
    const dayNote = Domain.dayDate(day) || days.find(d => d.id === day).note;
    if (view === 'timeline') {
      out.innerHTML = `<p class="muted small">${esc(dayNote)}</p><div class="timeline">${items.map(s => `
        <div class="tl-item"><div class="tl-time">${fmtTime(s.startTime)}<small>to ${fmtTime(s.endTime)}</small></div>
          <article class="card tl-card"><h3>${esc(s.name)}</h3>
            <div class="tl-meta"><span>${icon('pin', 15)} ${esc(Domain.venueName(s.venueId))}</span><span>${icon('group', 15)} ${esc(Domain.teamName(s.teamId))}</span><span>${icon('user', 15)} ${esc(s.coordinator)}</span></div>
            ${s.instructions ? `<p class="tl-note">${esc(s.instructions)}</p>` : ''}</article></div>`).join('')}</div>`;
    } else {
      out.innerHTML = `<div class="card"><div class="table-wrap"><table class="table table-cards"><thead><tr><th>Session</th><th>Start</th><th>End</th><th>Venue</th><th>Team</th><th>Coordinator</th><th>Instructions</th></tr></thead><tbody>
        ${items.map(s => `<tr><td data-label="Session" class="cell-strong">${esc(s.name)}</td><td data-label="Start" class="nowrap">${fmtTime(s.startTime)}</td><td data-label="End" class="nowrap">${fmtTime(s.endTime)}</td><td data-label="Venue">${esc(Domain.venueName(s.venueId))}</td><td data-label="Team">${esc(Domain.teamName(s.teamId))}</td><td data-label="Coordinator">${esc(s.coordinator)}</td><td data-label="Instructions">${esc(s.instructions)}</td></tr>`).join('')}
      </tbody></table></div></div>`;
    }
  }
  on(main, 'click', '[data-day]', (e, t) => { day = t.dataset.day; render(); });
  on(main, 'click', '[data-view]', (e, t) => { view = t.dataset.view; render(); });
  render();
});
