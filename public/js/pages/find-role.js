Boot.run(() => {
  'use strict';
  if (Shell.guardVisibility('findRole', 'Find My Role')) return;
  const { icon, esc, fmtTime, fmtRange, timeAgo, $, on } = UI;
  const main = document.getElementById('main');

  main.innerHTML = `
    <section class="find-hero"><div class="container"><span class="eyebrow" style="color:var(--c-gold-200)">Volunteer lookup</span>
      <h1>Find My Role</h1><p>Enter your name or Volunteer ID and the last 4 digits of your registered mobile number to see your team, venue, reporting time and instructions.</p></div></section>
    <div class="container" style="padding-bottom:var(--s-7)">
      <div class="card find-box">
        <form class="find-form" id="find-form" novalidate>
          <div class="field" data-field="query"><label for="q">Your name or Volunteer ID</label>
            <div class="input-icon"><span aria-hidden="true">${icon('search', 18)}</span><input class="input" id="q" name="query" type="search" autocomplete="off" maxlength="100" placeholder="e.g. ANU-0001 or your full name" aria-describedby="q-err"></div>
            <span class="field-error" id="q-err" role="alert"></span></div>
          <div class="field" data-field="mobileLast4" style="flex:0 1 220px"><label for="m4">Last 4 digits of your mobile</label>
            <input class="input" id="m4" name="mobileLast4" type="password" inputmode="numeric" pattern="\\d{4}" maxlength="4" autocomplete="off" placeholder="••••" aria-describedby="m4-err">
            <span class="field-error" id="m4-err" role="alert"></span></div>
          <button class="btn btn-primary btn-lg" type="submit" id="find-btn">Find My Role</button>
        </form>
        <div class="alert alert-info" style="margin-top:var(--s-4)">${icon('shield')}<div><strong>Private by design</strong>Your details are only shown after both fields match. Contact information is never displayed here. Having trouble? Contact the helpdesk: ${esc(Store.settings().contact.helpdesk)}.</div></div>
      </div>
      <div class="role-result" id="result" aria-live="polite"></div>
    </div>`;

  const form = $('#find-form'), result = $('#result');

  async function search() {
    const query = $('#q').value.trim(), mobileLast4 = $('#m4').value.trim();
    UI.clearErrors(form);
    const e1 = query ? '' : 'Please enter your name or Volunteer ID.';
    const e2 = /^\d{4}$/.test(mobileLast4) ? '' : 'Enter the last 4 digits of your mobile number.';
    UI.setError(form, 'query', e1); UI.setError(form, 'mobileLast4', e2);
    if (e1 || e2) { result.innerHTML = ''; return; }
    const btn = $('#find-btn'); btn.disabled = true; btn.innerHTML = '<span class="spinner"></span> Searching…';
    result.innerHTML = `<div class="card card-pad"><div class="skeleton" style="height:22px;width:40%"></div><div class="skeleton" style="height:14px;width:70%;margin-top:14px"></div><div class="skeleton" style="height:14px;width:55%;margin-top:10px"></div></div>`;
    try {
      const r = await Api.post('/api/public/find-role', { query, mobileLast4 });
      show(r);
    } catch (err) {
      result.innerHTML = `<div class="alert alert-${err.status === 429 ? 'warn' : 'bad'}">${icon('alert')}<div><strong>${err.status === 429 ? 'Please slow down' : 'Something went wrong'}</strong>${esc(err.message)}</div></div>`;
    } finally { btn.disabled = false; btn.textContent = 'Find My Role'; }
  }

  function show(r) {
    if (r.status === 'not_found') {
      result.innerHTML = `<div class="card">${UI.stateBlock({ icon: 'search', title: 'We couldn’t match those details', text: 'Check the spelling of your name (or your Volunteer ID) and the last 4 digits of the mobile number you registered with. If you haven’t registered yet, you can do that now.', action: `<a class="btn btn-primary" href="register.html">Volunteer Registration</a>` })}</div>`;
      return;
    }
    if (r.status === 'ambiguous') {
      result.innerHTML = `<div class="alert alert-warn">${icon('alert')}<div><strong>More than one volunteer matches</strong>Please search with your Volunteer ID (for example ${esc(Domain.volCode({ seq: 1 }))}) instead of your name.</div></div>`;
      return;
    }
    const v = r.volunteer;
    const head = `<div class="row" style="margin-bottom:var(--s-4)"><span class="avatar avatar-lg">${UI.initials(v.name)}</span><div><h2>${esc(v.name)}</h2><span class="muted small">${esc(v.code)}</span></div></div>`;
    if (r.status === 'pending') {
      result.innerHTML = head + `<div class="card">${UI.stateBlock({ icon: 'clock', title: 'Registered — awaiting approval', text: 'Your registration has been received and is waiting for review. Roles are assigned only after approval. Please check back soon.' })}</div>`;
    } else if (r.status === 'unassigned') {
      result.innerHTML = head + `<div class="card">${UI.stateBlock({ icon: 'user', title: 'Registered, but not assigned yet', text: 'You are approved as a volunteer, but a team and role have not been allocated. Check back later — your role will appear here when it is ready.' })}</div>`;
    } else if (r.status === 'no_assignments') {
      result.innerHTML = head + `<div class="card">${UI.stateBlock({ icon: 'clipboard', title: 'No assignments available yet', text: 'Your assignment is still being finalised by the core team. It will appear here as soon as it is published.' })}</div>`;
    } else {
      const list = r.assignments;
      result.innerHTML = head + (list.length > 1 ? `<div class="alert alert-info" style="margin-bottom:var(--s-4)">${icon('info')}<div><strong>You have ${list.length} assignments</strong>They are listed in the order you will report.</div></div>` : '') + list.map(a => card(a, v)).join('');
    }
  }

  function card(a, v) {
    return `<article class="card assign-card" aria-label="Assignment: ${esc(a.role)}">
      <div class="assign-top"><div><div class="team">${esc(a.team)}</div><h2>${esc(a.role)}</h2></div>
        <div class="vol"><strong>${esc(v.name)}</strong>${esc(v.code)}</div></div>
      <div class="assign-facts">
        <div class="fact"><div class="k">${icon('pin', 14)} Venue</div><div class="v">${esc(a.venue ? a.venue.name : 'To be confirmed')}<small>${esc(a.venue ? `${a.venue.area} · ${a.venue.floor}` : '')}</small></div></div>
        <div class="fact"><div class="k">${icon('calendar', 14)} Day</div><div class="v">${esc(a.dayLabel)}<small>${esc(a.date || 'Date to be announced')}</small></div></div>
        <div class="fact"><div class="k">${icon('clock', 14)} Report at</div><div class="v">${a.reportTime ? fmtTime(a.reportTime) : 'To be confirmed'}</div></div>
        <div class="fact"><div class="k">${icon('clock', 14)} Shift</div><div class="v">${fmtRange(a.startTime, a.endTime)}</div></div>
        <div class="fact"><div class="k">${icon('user', 14)} Team leader</div><div class="v">${esc(a.leader || 'To be confirmed')}</div></div>
      </div>
      <div class="assign-body"><div><h4>Responsibilities</h4><p>${esc(a.responsibilities || '—')}</p></div>
        <div><h4>Reporting instructions</h4><p>${esc(a.instructions || '—')}</p></div></div>
      <div class="assign-foot"><span>Latest update: ${timeAgo(a.updatedAt)}</span><span>${esc(Store.settings().eventName)} volunteer hub</span></div></article>`;
  }

  form.addEventListener('submit', e => { e.preventDefault(); search(); });
});
