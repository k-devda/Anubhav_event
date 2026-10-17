Boot.run(() => {
  'use strict';
  if (Shell.guardVisibility('registration', 'Volunteer registration')) return;
  const { icon, esc, fieldHtml, checkGroupHtml, setError, clearErrors, checked, val } = UI;
  const main = document.getElementById('main');
  const cfg = Store.settings().registrationFields;

  const SKILLS = ['Public speaking', 'Event management', 'Photography', 'Video editing', 'Audio/Video setup', 'First aid', 'Hospitality', 'Crowd management', 'Social media', 'Documentation', 'Registration desk', 'Translation'];
  const AVAIL = ['Setup day', 'Event day — morning', 'Event day — afternoon'];
  const YEARS = ['1st', '2nd', '3rd', '4th', '5th', 'Postgraduate', 'Other'];
  const EXP = ['None yet', 'Some (1–2 events)', 'Experienced (3+ events)'];

  const RULES = {
    name: v => (v.length < 2 ? 'Please enter your full name.' : ''),
    mobile: v => (/^(\+91[\s-]?)?[6-9]\d{4}[\s-]?\d{5}$/.test(v) ? '' : 'Enter a valid 10-digit Indian mobile number.'),
    email: v => (/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v) ? '' : 'Enter a valid email address, e.g. name@example.com.')
  };
  const REQUIRED_MSG = { institution: 'Please enter your college or institution.', course: 'Please enter your course or department.', year: 'Please select your year of study.' };

  function render() {
    const f = k => cfg[k] && cfg[k].show;
    const r = k => cfg[k] && cfg[k].required;
    const hidden = Object.keys(cfg).filter(k => !cfg[k].show).length;
    main.innerHTML = `
      <div class="page-hero"><div class="container"><span class="eyebrow">Join the team</span><h1>Volunteer Registration</h1>
        <p>Tell us a little about yourself. The core team reviews every registration and will confirm your role. Fields marked <span class="req">*</span> are required.</p></div></div>
      <div class="container form-shell">
        <div class="card" id="form-card">
          <form id="reg-form" novalidate>
            <div aria-hidden="true" style="position:absolute;left:-9999px"><label>Website <input type="text" name="website" tabindex="-1" autocomplete="off"></label></div>
            <div class="form-section"><h3>About you</h3><p class="muted">We use these details only to contact you about volunteering.</p>
              <div class="field-grid">
                ${fieldHtml({ id: 'name', label: 'Full name', required: true, autocomplete: 'name', placeholder: 'e.g. Aarav Mehta', className: 'span-2' })}
                ${fieldHtml({ id: 'mobile', label: 'Mobile number', type: 'tel', required: true, autocomplete: 'tel', placeholder: '98765 43210', hint: 'Not shown on any public page.' })}
                ${fieldHtml({ id: 'email', label: 'Email address', type: 'email', required: true, autocomplete: 'email', placeholder: 'name@example.com' })}
              </div></div>
            ${f('institution') || f('course') || f('year') ? `<div class="form-section"><h3>Education</h3><p class="muted">&nbsp;</p><div class="field-grid">
              ${f('institution') ? fieldHtml({ id: 'institution', label: 'College / institution', required: r('institution'), placeholder: 'e.g. PDEU' }) : ''}
              ${f('course') ? fieldHtml({ id: 'course', label: 'Course or department', required: r('course'), placeholder: 'e.g. B.Tech Computer Engineering' }) : ''}
              ${f('year') ? fieldHtml({ id: 'year', label: 'Year of study', type: 'select', required: r('year'), options: [{ value: '', label: 'Select year…' }, ...YEARS] }) : ''}
            </div></div>` : ''}
            ${f('skills') || f('areas') ? `<div class="form-section"><h3>Skills &amp; interests</h3><p class="muted">Select as many as apply.</p><div class="stack">
              ${f('skills') ? checkGroupHtml({ name: 'skills', label: 'Skills', options: SKILLS, required: r('skills') }) : ''}
              ${f('areas') ? checkGroupHtml({ name: 'areas', label: 'Preferred volunteering areas', options: Domain.activeTeams().map(t => ({ value: t.id, label: t.name })), required: r('areas') }) : ''}
            </div></div>` : ''}
            ${f('availability') || f('experience') || f('notes') ? `<div class="form-section"><h3>Availability &amp; experience</h3><p class="muted">&nbsp;</p><div class="stack">
              ${f('availability') ? checkGroupHtml({ name: 'availability', label: 'Availability', options: AVAIL, required: r('availability') }) : ''}
              <div class="field-grid">
              ${f('experience') ? fieldHtml({ id: 'experience', label: 'Previous volunteering experience', type: 'select', required: r('experience'), options: [{ value: '', label: 'Select…' }, ...EXP] }) : ''}
              ${f('notes') ? fieldHtml({ id: 'notes', label: 'Additional notes', type: 'textarea', required: r('notes'), className: 'span-2', placeholder: 'Anything the team should know (accessibility, dietary needs, exam dates…)' }) : ''}
              </div></div></div>` : ''}
            <div class="form-section">
              <div class="field" data-field="consent"><label class="check check-plain"><input type="checkbox" id="consent" name="consent" aria-describedby="consent-err"><span>I agree that my details may be used by the Anubhav organisers to coordinate volunteering, and I have read the privacy notice <span class="muted">(placeholder link)</span>. <span class="req">*</span></span></label><span class="field-error" id="consent-err" role="alert"></span></div>
            </div>
            <div class="form-actions"><button class="btn btn-primary btn-lg" type="submit" id="submit-btn">Submit registration</button><span class="muted small" id="form-msg" aria-live="polite"></span></div>
          </form>
        </div>
        <aside class="card side-note"><h3 style="margin-bottom:8px">Before you submit</h3><ul>
          <li>Use an email address you check regularly.</li><li>You will receive a Volunteer ID after submission — keep it handy for Find My Role.</li>
          <li>Your mobile number is never shown publicly.</li>${hidden ? '<li>Some optional questions are hidden by the organisers.</li>' : ''}</ul></aside>
      </div>`;
    bind();
  }

  function validateField(form, name) {
    const v = val(form, name);
    let msg = '';
    if (RULES[name]) msg = RULES[name](v);
    else if (REQUIRED_MSG[name] && cfg[name] && cfg[name].required && !v) msg = REQUIRED_MSG[name];
    else if (cfg[name] && cfg[name].required && cfg[name].show && !v && form.elements[name]) msg = 'This field is required.';
    setError(form, name, msg);
    return !msg;
  }

  function validateAll(form) {
    let ok = true; let first = null;
    ['name', 'mobile', 'email', 'institution', 'course', 'year', 'experience', 'notes'].forEach(n => {
      if (!form.elements[n]) return;
      if (!validateField(form, n)) { ok = false; first = first || form.elements[n]; }
    });
    ['skills', 'areas', 'availability'].forEach(g => {
      if (cfg[g] && cfg[g].show && cfg[g].required && !checked(form, g).length) {
        setError(form, g, 'Please select at least one option.'); ok = false; first = first || form.querySelector(`[name="${g}"]`);
      } else setError(form, g, '');
    });
    if (!form.elements.consent.checked) { setError(form, 'consent', 'Please accept the privacy consent to continue.'); ok = false; first = first || form.elements.consent; }
    else setError(form, 'consent', '');
    return { ok, first };
  }

  function bind() {
    const form = document.getElementById('reg-form');
    form.addEventListener('focusout', e => { const n = e.target.name; if (n && ['name', 'mobile', 'email', 'institution', 'course', 'year'].includes(n)) validateField(form, n); });
    form.addEventListener('change', e => { if (e.target.name === 'consent' && e.target.checked) setError(form, 'consent', ''); });
    form.addEventListener('submit', e => {
      e.preventDefault();
      const { ok, first } = validateAll(form);
      const msg = document.getElementById('form-msg');
      if (!ok) { msg.textContent = 'Please fix the highlighted fields.'; first && first.focus(); return; }
      msg.textContent = '';
      const btn = document.getElementById('submit-btn');
      btn.disabled = true; btn.innerHTML = '<span class="spinner"></span> Submitting…';
      const payload = {
        name: val(form, 'name'), mobile: val(form, 'mobile'), email: val(form, 'email'), consent: form.elements.consent.checked,
        institution: val(form, 'institution'), course: val(form, 'course'), year: val(form, 'year'),
        skills: checked(form, 'skills'), areas: checked(form, 'areas'), availability: checked(form, 'availability'),
        experience: val(form, 'experience'), notes: val(form, 'notes'), website: val(form, 'website')
      };
      Api.post('/api/public/register', payload).then(success).catch(err => {
        btn.disabled = false; btn.textContent = 'Submit registration';
        UI.showApiError(err, form);
        msg.textContent = err.message;
      });
    });
  }

  function success(rec) {
    document.getElementById('form-card').innerHTML = `<div class="success-panel">
      <span class="state-icon">${icon('check', 30)}</span>
      <h2>Thank you, ${esc(String(rec.name).split(' ')[0])}!</h2>
      <p class="muted">Your registration has been received. The core team will review it and confirm your role.</p>
      <div class="success-id" aria-label="Volunteer ID">${esc(rec.code)}</div>
      <p class="small muted">Keep your Volunteer ID — you will use it with the last 4 digits of your mobile number on Find My Role. Registration status: <strong>Pending review</strong>.</p>
      <div class="row" style="justify-content:center;margin-top:var(--s-4)">
        <a class="btn btn-primary" href="find-role.html">${icon('search', 16)} Go to Find My Role</a>
        <button class="btn btn-secondary" type="button" id="again">Register another volunteer</button></div></div>`;
    document.getElementById('again').addEventListener('click', render);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  render();
});
