/* ==========================================================
   Assignment editor — shared by Volunteers, Assignments,
   Teams and Shifts pages. Create for one or many volunteers,
   or edit a single existing assignment.
   ========================================================== */
const AssignmentForm = (() => {
  'use strict';
  const { icon, esc, $, $$, fmtTime, fmtRange, on, fieldHtml } = UI;

  function open(opts) {
    opts = opts || {};
    const editing = opts.assignmentId ? Store.get('assignments', opts.assignmentId) : null;
    const base = editing || Object.assign({ status: 'Active', day: Store.settings().days.slice(-1)[0].id }, opts.defaults || {});
    const teams = Domain.activeTeams();
    const days = Store.settings().days;
    const eligible = Domain.approved().sort((a, b) => a.name.localeCompare(b.name));
    const preselected = new Set(editing ? [editing.volunteerId] : (opts.volunteerIds || []));
    const skippedPending = (opts.volunteerIds || []).filter(id => { const v = Domain.volunteer(id); return v && v.status !== 'Approved'; }).length;

    const volPicker = editing
      ? `<div class="row"><span class="avatar">${UI.initials(Domain.volunteer(editing.volunteerId).name)}</span><div><strong>${esc(Domain.volunteer(editing.volunteerId).name)}</strong><div class="small muted">${esc(Domain.volCode(Domain.volunteer(editing.volunteerId)))}</div></div></div>`
      : `<div class="stack-sm"><div class="input-icon"><span aria-hidden="true">${icon('search', 16)}</span><input class="input input-sm" type="search" id="af-vsearch" placeholder="Search approved volunteers" aria-label="Search volunteers"></div>
         <div class="vol-picker" id="af-vlist" role="group" aria-label="Volunteers">${eligible.map(v => `<label data-name="${esc(v.name.toLowerCase())} ${esc(Domain.volCode(v).toLowerCase())}"><input type="checkbox" name="vol" value="${v.id}"${preselected.has(v.id) ? ' checked' : ''}><span><strong>${esc(v.name)}</strong> <span class="muted">${esc(Domain.volCode(v))} · ${esc(v.institution)}</span></span></label>`).join('')}</div>
         <div class="small muted" id="af-vcount"></div><span class="field-error" id="af-vol-err" role="alert" style="display:none"></span></div>`;

    const body = `${skippedPending ? `<div class="alert alert-warn" style="margin-bottom:var(--s-4)">${icon('alert')}<div>${skippedPending} selected volunteer${skippedPending > 1 ? 's were' : ' was'} skipped because only <strong>Approved</strong> volunteers can be assigned.</div></div>` : ''}
      <form id="af-form" novalidate><div class="wizard"><div>
        <div class="step-title"><span class="n">1</span> Volunteers</div>${volPicker}
        <div class="step-title"><span class="n">2</span> Team &amp; role</div>
        <div class="field-grid">
          ${fieldHtml({ id: 'af-team', name: 'team', label: 'Team', type: 'select', required: true, value: base.teamId || '', options: [{ value: '', label: 'Select team…' }, ...teams.map(t => ({ value: t.id, label: t.name }))] })}
          ${fieldHtml({ id: 'af-role', name: 'role', label: 'Role', required: true, value: base.role || '', attrs: ' list="af-roles"', placeholder: 'Choose or type a role' })}
          <datalist id="af-roles"></datalist></div>
        <div class="step-title"><span class="n">3</span> Venue, day &amp; shift</div>
        <div class="field-grid">
          ${fieldHtml({ id: 'af-venue', name: 'venue', label: 'Venue', type: 'select', value: base.venueId || '', options: [{ value: '', label: 'Select venue…' }, ...Domain.activeVenues().map(v => ({ value: v.id, label: `${v.name} (${v.code})` }))] })}
          ${fieldHtml({ id: 'af-day', name: 'day', label: 'Event date', type: 'select', required: true, value: base.day, options: days.map(d => ({ value: d.id, label: Domain.dayLabel(d.id) })) })}
          ${fieldHtml({ id: 'af-shift', name: 'shift', label: 'Shift template (optional)', type: 'select', value: base.shiftId || '', className: 'span-2', hint: 'Choosing a shift fills the times below. You can still adjust them.', options: [{ value: '', label: 'Custom times' }] })}
        </div>
        <div class="step-title"><span class="n">4</span> Times</div>
        <div class="field-grid" style="grid-template-columns:repeat(3,minmax(0,1fr))">
          ${fieldHtml({ id: 'af-report', name: 'report', label: 'Reporting time', type: 'time', value: base.reportTime || '' })}
          ${fieldHtml({ id: 'af-start', name: 'start', label: 'Shift start', type: 'time', value: base.startTime || '' })}
          ${fieldHtml({ id: 'af-end', name: 'end', label: 'Shift end', type: 'time', value: base.endTime || '' })}</div>
        <div class="step-title"><span class="n">5</span> Reporting person &amp; instructions</div>
        <div class="field-grid">
          ${fieldHtml({ id: 'af-leader', name: 'leader', label: 'Team leader / reporting person', value: base.leader || '', attrs: ' list="af-leaders"', placeholder: 'Who should they report to?' })}
          <datalist id="af-leaders">${[...new Set(teams.flatMap(t => [t.leader, t.assistant]).filter(Boolean))].map(n => `<option value="${esc(n)}">`).join('')}</datalist>
          ${fieldHtml({ id: 'af-status', name: 'status', label: 'Assignment status', type: 'select', value: base.status, options: ['Active', 'Draft', 'Cancelled'], hint: 'Only Active assignments appear on Find My Role.' })}
          ${fieldHtml({ id: 'af-resp', name: 'resp', label: 'Detailed responsibilities', type: 'textarea', className: 'span-2', value: base.responsibilities || '' })}
          ${fieldHtml({ id: 'af-instr', name: 'instr', label: 'Special instructions', type: 'textarea', className: 'span-2', value: base.instructions || '', hint: 'Leave blank to use the default instructions from Settings.' })}
        </div></div>
        <aside><div class="preview-box" aria-live="polite"><h4>${icon('eye', 14)} Assignment preview</h4><div id="af-preview"></div></div><div id="af-warn" style="margin-top:var(--s-3)"></div></aside>
      </div></form>`;

    const modal = UI.openModal({
      title: editing ? 'Edit assignment' : 'New assignment', size: 'xl', body,
      footer: `<button type="button" class="btn btn-secondary" data-close>Cancel</button><button type="button" class="btn btn-primary" id="af-save">${editing ? 'Save changes' : 'Confirm assignment'}</button>`
    });
    const root = modal.el, form = $('#af-form', root);

    function selectedVols() { return editing ? [editing.volunteerId] : $$('input[name="vol"]:checked', root).map(i => i.value); }
    function read() {
      const g = n => form.elements[n].value;
      return { teamId: g('team'), role: g('role').trim(), venueId: g('venue'), day: g('day'), shiftId: g('shift'), reportTime: g('report'), startTime: g('start'), endTime: g('end'), leader: g('leader').trim(), responsibilities: g('resp').trim(), instructions: g('instr').trim(), status: g('status') };
    }

    function fillTeamDependent(initial) {
      const t = Domain.team(form.elements.team.value);
      $('#af-roles', root).innerHTML = t ? t.roles.map(r => `<option value="${esc(r)}">`).join('') : '';
      const sel = form.elements.shift;
      const shifts = t ? Domain.teamShifts(t.id) : [];
      sel.innerHTML = `<option value="">Custom times</option>` + shifts.map(s => `<option value="${s.id}">${esc((s.name.split('—')[1] || s.name).trim())} · ${esc(Domain.dayLabel(s.day))} · ${fmtRange(s.startTime, s.endTime)}</option>`).join('');
      sel.value = shifts.some(s => s.id === (initial ? base.shiftId : '')) ? base.shiftId : '';
      if (!initial && t) {
        if (!form.elements.venue.value) form.elements.venue.value = t.venueId || '';
        if (!form.elements.leader.value) form.elements.leader.value = t.leader || '';
        if (!form.elements.resp.value) form.elements.resp.value = t.responsibilities.join('; ');
      }
    }
    fillTeamDependent(true);

    function applyShift() {
      const s = Domain.shift(form.elements.shift.value);
      if (!s) return;
      form.elements.venue.value = s.venueId || form.elements.venue.value;
      form.elements.day.value = s.day;
      form.elements.report.value = s.reportTime || '';
      form.elements.start.value = s.startTime || '';
      form.elements.end.value = s.endTime || '';
      if (s.coordinator) form.elements.leader.value = s.coordinator;
      if (!form.elements.resp.value || !editing) form.elements.resp.value = s.responsibilities || form.elements.resp.value;
      if (s.instructions && !form.elements.instr.value) form.elements.instr.value = s.instructions;
    }

    function previewAndWarn() {
      const d = read(), ids = selectedVols();
      const names = ids.map(id => Domain.volunteer(id).name);
      const row = (k, v) => `<div><dt>${k}</dt><dd${v ? '' : ' class="empty"'}>${v ? esc(v) : 'Not set'}</dd></div>`;
      $('#af-preview', root).innerHTML = `<dl>${row('Volunteer' + (names.length > 1 ? 's' : ''), names.length > 3 ? `${names.slice(0, 3).join(', ')} +${names.length - 3} more` : names.join(', '))}${row('Team', Domain.teamName(d.teamId) === '—' ? '' : Domain.teamName(d.teamId))}${row('Role', d.role)}${row('Venue', d.venueId ? Domain.venueName(d.venueId) : '')}${row('Day', Domain.dayLabel(d.day))}${row('Report at', d.reportTime ? fmtTime(d.reportTime) : '')}${row('Shift', d.startTime && d.endTime ? fmtRange(d.startTime, d.endTime) : '')}${row('Reports to', d.leader)}</dl>`;
      const warns = [];
      if (!ids.length) warns.push('Select at least one volunteer');
      if (!d.venueId) warns.push('Venue not selected');
      if (!d.reportTime) warns.push('Reporting time missing');
      if (!d.startTime || !d.endTime) warns.push('Shift start/end missing');
      else if (Domain.toMin(d.endTime) <= Domain.toMin(d.startTime)) warns.push('Shift end must be after shift start');
      if (!d.leader) warns.push('No team leader / reporting person');
      if (d.status === 'Active' && d.startTime && d.endTime && Domain.toMin(d.endTime) > Domain.toMin(d.startTime)) {
        ids.forEach(id => {
          const probe = { id: editing ? editing.id : '', volunteerId: id, day: d.day, startTime: d.startTime, endTime: d.endTime, status: 'Active' };
          Domain.conflictsFor(probe).forEach(c => warns.push(`${Domain.volunteer(id).name} already has ${Domain.teamName(c.teamId)} ${c.startTime}–${c.endTime} (overlap)`));
        });
      }
      $('#af-warn', root).innerHTML = warns.length ? `<div class="alert alert-warn">${icon('alert')}<div><strong>${warns.length} warning${warns.length > 1 ? 's' : ''}</strong><ul>${warns.map(w => `<li>${esc(w)}</li>`).join('')}</ul></div></div>` : `<div class="alert alert-ok">${icon('check')}<div><strong>Looks complete</strong>No missing fields or overlaps.</div></div>`;
      const cnt = $('#af-vcount', root); if (cnt) cnt.textContent = `${ids.length} selected`;
    }

    form.addEventListener('input', previewAndWarn);
    form.addEventListener('change', e => {
      if (e.target.name === 'team') { fillTeamDependent(false); }
      if (e.target.name === 'shift') applyShift();
      previewAndWarn();
    });
    const vs = $('#af-vsearch', root);
    if (vs) vs.addEventListener('input', () => { const q = vs.value.toLowerCase(); $$('#af-vlist label', root).forEach(l => { l.hidden = !!q && !l.dataset.name.includes(q); }); });
    previewAndWarn();

    $('#af-save', root).addEventListener('click', async e => {
      const d = read(), ids = selectedVols();
      UI.clearErrors(form);
      let bad = false;
      const volErr = $('#af-vol-err', root);
      if (!ids.length) { volErr.style.display = 'block'; volErr.textContent = 'Select at least one volunteer.'; bad = true; } else if (volErr) volErr.style.display = 'none';
      if (!d.teamId) { UI.setError(form, 'team', 'Select a team.'); bad = true; }
      if (!d.role) { UI.setError(form, 'role', 'Enter or choose a role.'); bad = true; }
      if (!d.day) { UI.setError(form, 'day', 'Select the event date.'); bad = true; }
      if (bad) { UI.toast('Please complete the required fields.', 'error'); return; }
      const rec = { teamId: d.teamId, role: d.role, venueId: d.venueId || null, day: d.day, shiftId: d.shiftId || null, reportTime: d.reportTime, startTime: d.startTime, endTime: d.endTime, leader: d.leader, responsibilities: d.responsibilities, instructions: d.instructions, status: d.status };
      const map = { teamId: 'team', venueId: 'venue', shiftId: 'shift', reportTime: 'report', startTime: 'start', endTime: 'end' };
      const done = await UI.attempt(async () => {
        if (editing) {
          await Store.update('assignments', editing.id, rec);
          UI.toast('Assignment updated');
        } else {
          let made = 0;
          try {
            for (const id of ids) { await Store.insert('assignments', Object.assign({ volunteerId: id }, rec)); made++; }
          } catch (err) {
            if (made) UI.toast(`${made} of ${ids.length} assignments were created before an error stopped the rest.`, 'error');
            throw err;
          }
          UI.toast(`${made} assignment${made > 1 ? 's' : ''} created`);
        }
      }, { form, map, btn: e.currentTarget });
      if (done) { modal.close('saved'); if (opts.onSave) opts.onSave(); }
      else if (!editing && opts.onSave) opts.onSave();
    });
  }

  return { open };
})();
