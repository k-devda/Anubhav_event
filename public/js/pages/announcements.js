Boot.run(() => {
  'use strict';
  if (Shell.guardVisibility('announcements', 'Announcements')) return;
  const { icon, esc, badge, fmtDate, $, on } = UI;
  const main = document.getElementById('main');
  let filter = 'All';

  main.innerHTML = `
    <div class="page-hero"><div class="container"><span class="eyebrow">Stay informed</span><h1>Announcements</h1>
      <p>Official updates for volunteers from the organising team.</p></div></div>
    <div class="container section"><div class="row" style="margin-bottom:var(--s-5)">
      <div class="field" style="min-width:220px"><label for="aud">Show announcements for</label><select class="select" id="aud"></select></div></div>
      <div id="list"></div></div>`;

  const all = Domain.publicAnnouncements();
  const audiences = ['All', ...new Set(all.filter(a => a.audience === 'Specific team').map(a => Domain.teamName(a.teamId)))];
  $('#aud').innerHTML = audiences.map(a => `<option>${esc(a === 'All' ? 'All announcements' : a)}</option>`).join('');
  $('#aud').addEventListener('change', e => { filter = audiences[e.target.selectedIndex]; render(); });

  function render() {
    const items = all.filter(a => filter === 'All' || a.audience !== 'Specific team' || Domain.teamName(a.teamId) === filter);
    $('#list').innerHTML = items.length ? `<div class="grid grid-2">${items.map(a => `
      <article class="card ann-card priority-${a.priority.toLowerCase()}">
        <div class="ann-meta">${badge(a.priority + ' priority', { High: 'bad', Normal: 'gold', Low: '' }[a.priority])}<span>${icon('calendar', 13)} ${fmtDate(a.publishedAt)}</span>
          <span>${icon('users', 13)} ${esc(a.audience === 'Specific team' ? Domain.teamName(a.teamId) : a.audience)}</span>${badge(a.status)}</div>
        <h3>${esc(a.title)}</h3><p>${esc(a.message)}</p></article>`).join('')}</div>`
      : `<div class="card">${UI.stateBlock({ icon: 'megaphone', title: 'No announcements to show', text: 'There are no published announcements for this audience right now.' })}</div>`;
  }
  render();
});
