/* ==========================================================
   Page shell — builds the public header/footer or the admin
   sidebar/topbar around each page's <main id="main">.
   Pages declare themselves with data attributes on <body>:
     data-area="public|admin|bare"  data-page="<key>"  data-root="../"
   Shell.build() runs after the data has loaded (see boot.js).
   ========================================================== */
const Shell = (() => {
  'use strict';
  const { icon, esc, $, $$ } = UI;
  const body = document.body;
  const area = body.dataset.area || 'public';
  const page = body.dataset.page || '';
  const ROOT = body.dataset.root || '';

  const PUBLIC_NAV = [
    { key: 'home', label: 'Home', href: 'index.html' },
    { key: 'register', label: 'Volunteer Registration', href: 'register.html', vis: 'registration' },
    { key: 'find-role', label: 'Find My Role', href: 'find-role.html', vis: 'findRole' },
    { key: 'teams', label: 'Teams', href: 'teams.html', vis: 'teams' },
    { key: 'schedule', label: 'Schedule', href: 'schedule.html', vis: 'schedule' },
    { key: 'announcements', label: 'Announcements', href: 'announcements.html', vis: 'announcements' }
  ];
  const ADMIN_NAV = [
    { key: 'dashboard', label: 'Dashboard', icon: 'dashboard' },
    { key: 'volunteers', label: 'Volunteers', icon: 'users' },
    { key: 'assignments', label: 'Assignments', icon: 'clipboard' },
    { key: 'teams', label: 'Teams', icon: 'group' },
    { key: 'venues', label: 'Venues', icon: 'building' },
    { key: 'shifts', label: 'Shifts & Schedule', icon: 'clock' },
    { key: 'attendance', label: 'Attendance', icon: 'checksquare' },
    { key: 'announcements', label: 'Announcements', icon: 'megaphone' },
    { key: 'reports', label: 'Reports & Exports', icon: 'chart' },
    { key: 'settings', label: 'Settings', icon: 'settings', adminOnly: true }
  ];
  const ROLE_LABEL = { admin: 'Administrator', coordinator: 'Coordinator', viewer: 'Viewer (read-only)' };

  const brandMark = `<svg class="brand-mark" viewBox="0 0 40 40" aria-hidden="true"><rect width="40" height="40" rx="10" fill="#5e1b2c"/><circle cx="20" cy="20" r="14" fill="none" stroke="#b8963e" stroke-width="1.2"/><path d="M12.5 28 20 11l7.5 17M15.5 22.5h9" fill="none" stroke="#f5edd3" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  const brand = (href) => `<a class="brand" href="${href}" aria-label="${esc(Store.settings().eventName)} home">${brandMark}<span class="brand-text"><span class="brand-name">${esc(Store.settings().eventName)}</span><span class="brand-sub">Volunteer Hub</span></span></a>`;
  const isVisible = key => !key || (Store.settings().visibility || {})[key] !== false;
  const role = () => (Store.me() || {}).role;
  const can = perm => ({ admin: ['read', 'write', 'delete', 'settings', 'users'], coordinator: ['read', 'write'], viewer: ['read'] }[role()] || []).includes(perm);

  /* ---------------- Public ---------------- */
  function buildPublic() {
    const s = Store.settings();
    const main = $('#main');
    main.classList.add('site-main');
    main.setAttribute('tabindex', '-1');
    const nav = PUBLIC_NAV.filter(n => isVisible(n.vis)).map(n => `<a href="${ROOT}${n.href}"${n.key === page ? ' aria-current="page"' : ''}>${n.label}</a>`).join('');
    const header = document.createElement('div');
    header.innerHTML = `<a class="skip-link" href="#main">Skip to main content</a>
      <header class="site-header no-print"><div class="container">${brand(ROOT + 'index.html')}
        <button class="btn btn-icon btn-ghost nav-toggle" type="button" aria-expanded="false" aria-controls="site-nav" aria-label="Toggle navigation">${icon('menu', 22)}</button>
        <nav class="site-nav" id="site-nav" aria-label="Main">${nav}<a class="btn btn-secondary btn-sm" href="${ROOT}login.html">${icon('lock', 15)} Admin login</a></nav></div></header>`;
    body.insertBefore(header, main);
    const footer = document.createElement('footer');
    footer.className = 'site-footer no-print';
    footer.innerHTML = `<div class="container"><div class="footer-grid">
      <div><div class="footer-brand">${esc(s.eventName)} — ${esc(s.subtitle)}</div>
        <p style="margin-top:8px">Presented by ${s.organizers.map(o => esc(o.name)).join(' and ')}.</p>
        <p class="muted" style="color:#b79ba1">${esc(s.eventInfo.date)} · ${esc(s.eventInfo.venue)}</p></div>
      <div><h4>Explore</h4><ul>${PUBLIC_NAV.filter(n => isVisible(n.vis)).map(n => `<li><a href="${ROOT}${n.href}">${n.label}</a></li>`).join('')}</ul></div>
      <div><h4>Contact</h4><ul><li>${esc(s.contact.email)}</li><li>${esc(s.contact.phone)}</li><li>${esc(s.contact.helpdesk)}</li></ul></div></div>
      <div class="footer-bottom"><span>© ${esc(s.eventName)}</span><span>${esc(s.organizers.map(o => o.name).join(' · '))}</span></div></div>`;
    body.appendChild(footer);
    const toggle = $('.nav-toggle'), navEl = $('#site-nav');
    toggle.addEventListener('click', () => { const o = navEl.classList.toggle('is-open'); toggle.setAttribute('aria-expanded', o); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape') { navEl.classList.remove('is-open'); toggle.setAttribute('aria-expanded', 'false'); } });
  }

  /* ---------------- Admin ---------------- */
  async function signOut() {
    try { await Api.post('/api/auth/logout'); } catch (e) { /* session may already be gone */ }
    location.href = ROOT + 'login.html';
  }

  function buildAdmin() {
    const s = Store.settings();
    const me = Store.me();
    const main = $('#main');
    main.classList.add('admin-content');
    main.setAttribute('tabindex', '-1');
    if (role() === 'viewer') body.classList.add('is-readonly');
    const pending = Domain.stats().pending;
    const shell = document.createElement('div');
    shell.className = 'app-shell';
    const banner = role() === 'admin' ? '' : `<div class="admin-banner no-print">${icon('info', 14)} ${role() === 'viewer' ? 'You have read-only access. Ask an administrator if you need to make changes.' : 'Coordinator access: Settings and user management are limited to administrators.'}</div>`;
    shell.innerHTML = `<a class="skip-link" href="#main">Skip to main content</a>
      <aside class="sidebar no-print" id="sidebar" aria-label="Admin navigation">
        ${brand('dashboard.html')}
        <nav class="side-nav">${ADMIN_NAV.filter(n => !n.adminOnly || can('settings')).map(n => `<a href="${n.key}.html"${n.key === page ? ' aria-current="page"' : ''}>${icon(n.icon)}<span>${n.label}</span>${n.key === 'volunteers' && pending ? `<span class="count" title="${pending} pending">${pending}</span>` : ''}</a>`).join('')}</nav>
        <div class="side-foot"><div style="margin-bottom:8px;color:#b79ba1">${esc(s.subtitle)}</div><a href="${ROOT}index.html">${icon('home', 15)} View public site</a></div>
      </aside>
      <div class="sidebar-scrim no-print" id="scrim"></div>
      <div class="admin-main">
        <header class="topbar no-print">
          <button type="button" class="btn btn-icon btn-ghost menu-btn" id="menu-btn" aria-label="Open navigation" aria-controls="sidebar" aria-expanded="false">${icon('menu', 22)}</button>
          <div class="event-tag"><strong>${esc(s.eventName)} <span class="badge badge-gold" style="vertical-align:middle">Admin</span></strong><span>${esc(s.subtitle)}</span></div>
          <div class="spacer"></div>
          <div class="dropdown"><button type="button" class="profile-btn" id="profile-btn" aria-haspopup="true" aria-expanded="false"><span class="avatar">${esc(UI.initials(me.name))}</span><span class="who"><strong>${esc(me.name)}</strong><span>${esc(ROLE_LABEL[me.role] || me.role)}</span></span>${icon('chevdown', 16)}</button>
            <div class="dropdown-menu" id="profile-menu" hidden>
              <div class="dropdown-head"><strong>${esc(me.name)}</strong><div class="muted small">${esc(me.email)}</div></div><hr>
              <a href="${ROOT}index.html">${icon('home', 16)} View public site</a>
              ${can('settings') ? `<a href="settings.html">${icon('settings', 16)} Settings</a>` : ''}
              <a href="${ROOT}login.html?change=1">${icon('lock', 16)} Change password</a><hr>
              <button type="button" id="sign-out">${icon('logout', 16)} Sign out</button></div></div>
        </header>
        ${banner}
        <div id="main-slot"></div>
      </div>`;
    body.insertBefore(shell, main);
    $('#main-slot', shell).replaceWith(main);

    const sidebar = $('#sidebar'), scrim = $('#scrim'), menuBtn = $('#menu-btn');
    const setNav = open => { sidebar.classList.toggle('is-open', open); scrim.classList.toggle('is-open', open); menuBtn.setAttribute('aria-expanded', open); };
    menuBtn.addEventListener('click', () => setNav(!sidebar.classList.contains('is-open')));
    scrim.addEventListener('click', () => setNav(false));
    const pbtn = $('#profile-btn'), pmenu = $('#profile-menu');
    function closeMenu() { pmenu.hidden = true; pbtn.setAttribute('aria-expanded', 'false'); }
    document.addEventListener('keydown', e => { if (e.key === 'Escape') { setNav(false); closeMenu(); } });
    pbtn.addEventListener('click', e => { e.stopPropagation(); pmenu.hidden = !pmenu.hidden; pbtn.setAttribute('aria-expanded', String(!pmenu.hidden)); });
    document.addEventListener('click', e => { if (!pmenu.contains(e.target)) closeMenu(); });
    $('#sign-out').addEventListener('click', signOut);
    Store.subscribe(updateVolunteerBadge);
    startAutoRefresh();
  }

  /* Keep the dashboard live: new registrations and other admins' changes appear without a reload. */
  const refreshHooks = [];
  const onRefresh = fn => refreshHooks.push(fn);
  const REFRESH_MS = 30000;

  function updateVolunteerBadge() {
    const link = $('.side-nav a[href="volunteers.html"]');
    if (!link) return;
    const pending = Domain.stats().pending;
    let badge = $('.count', link);
    if (pending && !badge) { badge = document.createElement('span'); badge.className = 'count'; link.appendChild(badge); }
    if (badge) { if (pending) { badge.textContent = pending; badge.title = pending + ' pending'; } else badge.remove(); }
  }

  async function refreshNow() {
    if (document.hidden || document.querySelector('.modal-backdrop')) return;
    const known = new Set(Store.list('volunteers').map(v => v.id));
    try { await Store.refresh(); }
    catch (e) { if (e && e.status === 401) location.href = ROOT + 'login.html?next=' + encodeURIComponent(location.pathname); return; }
    const fresh = Store.list('volunteers').filter(v => !known.has(v.id));
    if (fresh.length) UI.toast(fresh.length === 1 ? `New registration: ${fresh[0].name}` : `${fresh.length} new registrations received`);
    updateVolunteerBadge();
    // don't redraw while someone is typing in a field on the page
    const a = document.activeElement;
    const typing = a && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName) && $('#main').contains(a);
    if (!typing && !document.querySelector('.modal-backdrop')) refreshHooks.forEach(fn => { try { fn(); } catch (e) { console.error(e); } });
  }

  function startAutoRefresh() {
    setInterval(refreshNow, REFRESH_MS);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) refreshNow(); });
  }

  /** Page header block used by every admin page. */
  function pageHead(title, subtitle, actionsHtml) {
    return `<div class="page-head"><div><h1>${esc(title)}</h1>${subtitle ? `<p>${subtitle}</p>` : ''}</div><div class="page-actions">${actionsHtml || ''}</div></div>`;
  }

  /** For public pages the admin can hide from Settings. Returns true when hidden. */
  function guardVisibility(key, label) {
    if (isVisible(key)) return false;
    $('#main').innerHTML = `<div class="container section">${UI.stateBlock({ icon: 'lock', title: `${label} is not public right now`, text: 'The organisers have switched this page off.', action: `<a class="btn btn-primary" href="${ROOT}index.html">Back to home</a>` })}</div>`;
    return true;
  }

  function build() {
    if (area === 'public') buildPublic();
    else if (area === 'admin') buildAdmin();
  }

  return { area, page, ROOT, isVisible, can, role, pageHead, guardVisibility, brandMark, build, signOut, onRefresh, refreshNow };
})();
