Boot.run(() => {
  'use strict';
  const { icon, esc, badge, fmtDate } = UI;
  const s = Store.settings();
  const vis = Shell.isVisible;

  const quick = [
    { href: 'register.html', ic: 'user_plus', t: 'Volunteer Registration', d: 'Sign up to support the day.', v: 'registration' },
    { href: 'find-role.html', ic: 'search', t: 'Find My Role', d: 'Look up your team, venue and shift.', v: 'findRole' },
    { href: 'teams.html', ic: 'group', t: 'View Teams', d: 'See who is doing what.', v: 'teams' },
    { href: 'schedule.html', ic: 'calendar', t: 'Event Schedule', d: 'Sessions, venues and coordinators.', v: 'schedule' }
  ].filter(q => vis(q.v));

  const anns = Domain.publicAnnouncements().slice(0, 3);
  const annHtml = !vis('announcements') ? '' : `
    <section class="section" style="padding-top:0" aria-labelledby="ann-h">
      <div class="container">
        <div class="section-head row row-between"><div><span class="eyebrow">Important</span><h2 id="ann-h">Latest announcements</h2></div>
          <a class="btn btn-secondary btn-sm" href="announcements.html">All announcements ${icon('chevright', 15)}</a></div>
        ${anns.length ? `<div class="grid grid-3">${anns.map(a => `
          <article class="card ann-card priority-${a.priority.toLowerCase()}">
            <div class="ann-meta">${badge(a.priority)} <span>${fmtDate(a.publishedAt)}</span> · <span>${esc(a.audience === 'Specific team' ? Domain.teamName(a.teamId) : a.audience)}</span></div>
            <h3>${esc(a.title)}</h3><p>${esc(a.message.length > 120 ? a.message.slice(0, 117) + '…' : a.message)}</p></article>`).join('')}</div>`
        : `<div class="card">${UI.stateBlock({ icon: 'megaphone', title: 'No announcements yet', text: 'Important updates will appear here as soon as they are published.' })}</div>`}
      </div>
    </section>`;

  document.getElementById('main').innerHTML = `
    <section class="hero" aria-labelledby="hero-h">
      <div class="container">
        <div class="hero-presents"><span>Sanket Health &amp; Wellness Centre</span><span class="dot"></span><span>${esc(s.presenter)}</span></div>
        <h1 id="hero-h">${esc(s.eventName)}</h1>
        <p class="hero-sub">${esc(s.subtitle)}</p>
        <p class="lead">Welcome, volunteers. Anubhav brings learners, trainers and wellness practitioners together for a single day of hands-on learning — and it runs on people like you. Register, find your role, and meet your team here.</p>
        <div class="hero-actions">
          ${vis('registration') ? `<a class="btn btn-gold btn-lg" href="register.html">${icon('user_plus', 20)} Volunteer Registration</a>` : ''}
          ${vis('findRole') ? `<a class="btn btn-secondary btn-lg" href="find-role.html">${icon('search', 20)} Find My Role</a>` : ''}
          ${vis('teams') ? `<a class="btn btn-secondary btn-lg" href="teams.html">${icon('group', 20)} View Teams</a>` : ''}
          ${vis('schedule') ? `<a class="btn btn-secondary btn-lg" href="schedule.html">${icon('calendar', 20)} Event Schedule</a>` : ''}
        </div>
        <div class="placeholder-note">${icon('info', 16)} ${esc(s.eventInfo.date)} · ${esc(s.eventInfo.venue)}</div>
      </div>
    </section>

    <section class="section" aria-labelledby="how-h">
      <div class="container">
        <div class="section-head"><span class="eyebrow">How it works</span><h2 id="how-h">Everything a volunteer needs</h2></div>
        <div class="grid grid-4">${quick.map(q => `
          <a class="card card-clickable quick-card" href="${q.href}"><span class="qc-icon">${icon(q.ic, 22)}</span><h3>${q.t}</h3><p>${q.d}</p></a>`).join('')}</div>
      </div>
    </section>
    ${annHtml}`;
});
