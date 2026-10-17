Boot.run(async () => {
  'use strict';
  const { icon, esc, $, setError, clearErrors, fieldHtml } = UI;
  const main = document.getElementById('main');
  main.className = 'login-page';
  const params = new URLSearchParams(location.search);

  // Public settings for the event name (login is a bare page; fetch what we need)
  let s = { eventName: 'Anubhav', subtitle: 'A Day of Learning & Training', organizers: [{ name: 'Sanket Health & Wellness Centre' }, { name: 'PDEU College' }] };
  try { s = (await Api.get('/api/public/bootstrap')).settings; } catch (e) { /* keep defaults */ }

  // Only follow same-site relative redirects after sign-in
  const nextUrl = (() => { const n = params.get('next') || ''; return /^\/admin\/[A-Za-z0-9_-]+\.html$/.test(n) ? n : '/admin/dashboard.html'; })();

  let me = null;
  try { me = (await Api.get('/api/auth/me')).user; } catch (e) { /* server unreachable: show the form */ }
  if (me && !me.mustChangePassword && !params.get('change')) { location.replace(nextUrl); return; }

  const aside = `<aside class="login-aside"><a class="brand" href="index.html">${Shell.brandMark}<span class="brand-text"><span class="brand-name">${esc(s.eventName)}</span><span class="brand-sub">Volunteer Hub</span></span></a>
      <div><span class="eyebrow" style="color:var(--c-gold-200)">Administrators</span><h1>${esc(s.subtitle)}</h1>
        <p>Manage volunteers, teams, venues, shifts and announcements for ${esc(s.organizers.map(o => o.name).join(' and '))}.</p></div>
      <p class="small" style="margin:0;color:#b79ba1">${icon('shield', 14)} Authorised organisers only</p></aside>`;

  function showSignIn() {
    main.innerHTML = `${aside}
    <section class="login-main"><div class="card login-card">
      <h2>Admin sign in</h2><p class="muted">Use your administrator account.</p>
      ${params.get('expired') ? `<div class="alert alert-warn" style="margin-bottom:var(--s-4)">${icon('info')}<div>Your session ended. Please sign in again.</div></div>` : ''}
      <div id="login-alert" aria-live="polite"></div>
      <form id="login-form" novalidate class="stack">
        ${fieldHtml({ id: 'user', name: 'email', label: 'Email', required: true, autocomplete: 'username', placeholder: 'you@example.com' })}
        <div class="field" data-field="password"><label for="pass">Password<span class="req" aria-hidden="true">*</span></label>
          <div class="input-group"><input class="input" id="pass" name="password" type="password" autocomplete="current-password" required aria-describedby="pass-err"><button type="button" class="btn btn-icon btn-ghost btn-sm" id="toggle-pass" aria-label="Show password" aria-pressed="false">${icon('eye')}</button></div>
          <span class="field-error" id="pass-err" role="alert"></span></div>
        <div class="row row-between"><label class="switch"><input type="checkbox" id="remember"><span>Remember me for 30 days</span></label><span class="small muted">Forgot password? Ask an administrator.</span></div>
        <button class="btn btn-primary btn-lg btn-block" type="submit" id="login-btn">Sign in</button>
      </form>
      <hr class="divider">
      <a href="index.html" class="small">${icon('chevleft', 14)} Back to public site</a>
    </div></section>`;
    const form = $('#login-form'), alertBox = $('#login-alert');
    $('#toggle-pass').addEventListener('click', e => {
      const b = e.currentTarget, p = $('#pass'), show = p.type === 'password';
      p.type = show ? 'text' : 'password';
      b.setAttribute('aria-pressed', show); b.setAttribute('aria-label', show ? 'Hide password' : 'Show password');
      b.innerHTML = icon(show ? 'eyeoff' : 'eye');
    });
    form.addEventListener('submit', async e => {
      e.preventDefault(); clearErrors(form); alertBox.innerHTML = '';
      const u = form.email.value.trim(), p = form.password.value;
      setError(form, 'email', u ? '' : 'Enter your email.');
      setError(form, 'password', p ? '' : 'Enter your password.');
      if (!u || !p) return;
      const btn = $('#login-btn'); btn.disabled = true; btn.innerHTML = '<span class="spinner"></span> Signing in…';
      try {
        const r = await Api.post('/api/auth/login', { email: u, password: p, remember: $('#remember').checked });
        if (r.user.mustChangePassword) { me = r.user; showChange(true); return; }
        location.replace(nextUrl);
      } catch (err) {
        form.password.value = '';
        alertBox.innerHTML = `<div class="alert alert-bad" style="margin-bottom:var(--s-4)">${icon('alert')}<div><strong>Sign-in failed</strong>${esc(err.message)}</div></div>`;
        btn.disabled = false; btn.textContent = 'Sign in';
      }
    });
  }

  function showChange(forced) {
    main.innerHTML = `${aside}
    <section class="login-main"><div class="card login-card">
      <h2>${forced ? 'Choose a new password' : 'Change password'}</h2>
      <p class="muted">${forced ? 'Your account uses a temporary password. Set your own to continue.' : `Signed in as ${esc(me.email)}.`}</p>
      <div id="pw-alert" aria-live="polite"></div>
      <form id="pw-form" novalidate class="stack">
        ${fieldHtml({ id: 'cur', name: 'currentPassword', label: forced ? 'Temporary password' : 'Current password', type: 'password', required: true, autocomplete: 'current-password' })}
        ${fieldHtml({ id: 'new', name: 'newPassword', label: 'New password', type: 'password', required: true, autocomplete: 'new-password', hint: 'At least 10 characters, with letters and a number.' })}
        ${fieldHtml({ id: 'new2', name: 'confirm', label: 'Confirm new password', type: 'password', required: true, autocomplete: 'new-password' })}
        <button class="btn btn-primary btn-lg btn-block" type="submit" id="pw-btn">Save password</button>
      </form>
      ${forced ? '' : `<hr class="divider"><a href="admin/dashboard.html" class="small">${icon('chevleft', 14)} Back to dashboard</a>`}
    </div></section>`;
    const form = $('#pw-form');
    form.addEventListener('submit', async e => {
      e.preventDefault(); clearErrors(form);
      const cur = form.currentPassword.value, nw = form.newPassword.value, cf = form.confirm.value;
      setError(form, 'currentPassword', cur ? '' : 'Enter your current password.');
      setError(form, 'newPassword', nw ? '' : 'Enter a new password.');
      setError(form, 'confirm', nw && cf !== nw ? 'Passwords do not match.' : '');
      if (!cur || !nw || cf !== nw) return;
      const btn = $('#pw-btn'); btn.disabled = true;
      try {
        await Api.post('/api/auth/change-password', { currentPassword: cur, newPassword: nw });
        $('#pw-alert').innerHTML = `<div class="alert alert-ok" style="margin-bottom:var(--s-4)">${icon('check')}<div>Password updated. Redirecting…</div></div>`;
        setTimeout(() => location.replace(nextUrl), 700);
      } catch (err) {
        UI.showApiError(err, form);
        btn.disabled = false;
      }
    });
  }

  if (me && (me.mustChangePassword || params.get('change'))) showChange(!!me.mustChangePassword);
  else if (params.get('change')) showSignIn();
  else showSignIn();
});
