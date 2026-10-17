Boot.run(() => {
  'use strict';
  const { icon, esc, badge, fmtRange, $, on, fieldHtml, setError, val } = UI;
  const main = document.getElementById('main');
  let showArchived = false;

  main.innerHTML = `${Shell.pageHead('Venues', 'Halls, rooms and outdoor areas used during the event.',
    `<label class="switch"><input type="checkbox" id="arch"><span>Show archived</span></label><button class="btn btn-primary" type="button" id="new">${icon('plus', 16)} Create venue</button>`)}<div id="grid"></div>`;

  const teamsAt = id => Store.list('teams').filter(t => !t.archived && t.venueId === id);
  const shiftsAt = id => Store.list('shifts').filter(s => s.venueId === id);

  function draw() {
    const list = Store.list('venues').filter(v => showArchived || v.status !== 'Archived');
    $('#grid').innerHTML = list.length ? `<div class="card"><div class="table-wrap"><table class="table table-cards"><thead><tr><th>Venue</th><th>Code</th><th>Area / floor</th><th>Coordinator</th><th>Capacity</th><th>Teams</th><th>Shifts</th><th>Status</th><th><span class="sr-only">Actions</span></th></tr></thead><tbody>
      ${list.map(v => `<tr><td data-label="Venue"><span class="cell-strong">${esc(v.name)}</span></td><td data-label="Code"><span class="chip">${esc(v.code)}</span></td><td data-label="Area">${esc(v.area)}<span class="cell-sub">${esc(v.floor)}</span></td><td data-label="Coordinator">${esc(v.coordinator || '—')}</td><td data-label="Capacity">${esc(v.capacity || '—')}</td>
        <td data-label="Teams">${teamsAt(v.id).length}</td><td data-label="Shifts">${shiftsAt(v.id).length}</td><td data-label="Status">${badge(v.status)}</td>
        <td class="cell-actions"><div class="row-actions"><button class="btn btn-ghost btn-icon btn-sm" data-view="${v.id}" aria-label="View ${esc(v.name)}" title="View">${icon('eye', 16)}</button><button class="btn btn-ghost btn-icon btn-sm" data-edit="${v.id}" aria-label="Edit ${esc(v.name)}" title="Edit">${icon('edit', 16)}</button>
        ${v.status === 'Archived' ? `<button class="btn btn-ghost btn-sm" data-restore="${v.id}">Restore</button>` : `<button class="btn btn-danger-ghost btn-icon btn-sm" data-archive="${v.id}" aria-label="Archive ${esc(v.name)}" title="Archive">${icon('archive', 16)}</button>`}</div></td></tr>`).join('')}
      </tbody></table></div></div>` : `<div class="card">${UI.stateBlock({ icon: 'building', title: 'No venues yet', text: 'Create a venue to start placing teams and shifts.', action: '<button class="btn btn-primary" id="new2" type="button">Create venue</button>' })}</div>`;
  }

  function view(id) {
    const v = Store.get('venues', id), teams = teamsAt(id), shifts = shiftsAt(id);
    UI.openModal({
      title: esc(v.name), size: 'lg',
      body: `<div class="row" style="margin-bottom:var(--s-4)"><span class="chip">${esc(v.code)}</span>${badge(v.status)}</div><p>${esc(v.description)}</p>
        <dl class="kv" style="margin-bottom:var(--s-4)"><dt>Building / area</dt><dd>${esc(v.area)}</dd><dt>Floor / room</dt><dd>${esc(v.floor)}</dd><dt>Coordinator</dt><dd>${esc(v.coordinator || '—')}</dd><dt>Capacity</dt><dd>${esc(v.capacity || '—')}</dd>
        <dt>Map link</dt><dd>${v.mapLink ? `<a href="${esc(v.mapLink)}" target="_blank" rel="noopener noreferrer">${esc(v.mapLink)}</a>` : '<span class="muted">Placeholder — no link added</span>'}</dd><dt>Setup instructions</dt><dd>${esc(v.setup || '—')}</dd></dl>
        <div class="grid grid-2"><div><h3 style="margin-bottom:8px">Associated teams (${teams.length})</h3>${teams.map(t => `<span class="chip">${esc(t.name)}</span>`).join('') || '<span class="muted small">None</span>'}</div>
        <div><h3 style="margin-bottom:8px">Associated shifts (${shifts.length})</h3>${shifts.length ? `<ul class="list-plain small">${shifts.map(s => `<li style="margin-bottom:4px"><strong>${esc(s.name)}</strong><br><span class="muted">${esc(Domain.dayLabel(s.day))} · ${fmtRange(s.startTime, s.endTime)}</span></li>`).join('')}</ul>` : '<span class="muted small">None</span>'}</div></div>`,
      footer: '<button class="btn btn-secondary" type="button" data-close>Close</button>'
    });
  }

  function form(id) {
    const v = id ? Store.get('venues', id) : { name: '', code: '', area: '', floor: '', description: '', mapLink: '', coordinator: '', capacity: '', setup: '', status: 'Active' };
    const m = UI.openModal({
      title: id ? 'Edit venue' : 'Create venue', size: 'lg',
      body: `<form id="v-form" novalidate><div class="field-grid">
        ${fieldHtml({ id: 'vn-name', name: 'name', label: 'Venue name', required: true, value: v.name })}
        ${fieldHtml({ id: 'vn-code', name: 'code', label: 'Venue code', required: true, value: v.code, hint: 'Short unique code, e.g. AUD.' })}
        ${fieldHtml({ id: 'vn-area', name: 'area', label: 'Building or campus area', value: v.area })}
        ${fieldHtml({ id: 'vn-floor', name: 'floor', label: 'Floor or room', value: v.floor })}
        ${fieldHtml({ id: 'vn-coord', name: 'coordinator', label: 'Venue coordinator', value: v.coordinator })}
        ${fieldHtml({ id: 'vn-cap', name: 'capacity', label: 'Capacity', type: 'number', value: v.capacity, attrs: ' min="0"' })}
        ${fieldHtml({ id: 'vn-map', name: 'mapLink', label: 'Map link (placeholder)', type: 'url', value: v.mapLink, placeholder: 'https://…', className: 'span-2' })}
        ${fieldHtml({ id: 'vn-desc', name: 'description', label: 'Location description', type: 'textarea', rows: 2, value: v.description, className: 'span-2' })}
        ${fieldHtml({ id: 'vn-setup', name: 'setup', label: 'Setup instructions', type: 'textarea', rows: 2, value: v.setup, className: 'span-2' })}
        ${fieldHtml({ id: 'vn-status', name: 'status', label: 'Status', type: 'select', value: v.status, options: ['Active', 'Inactive', 'Archived'] })}
      </div></form>`,
      footer: `<button class="btn btn-secondary" type="button" data-close>Cancel</button><button class="btn btn-primary" type="button" id="v-save">${id ? 'Save venue' : 'Create venue'}</button>`
    });
    $('#v-save', m.el).addEventListener('click', async e => {
      const f = $('#v-form', m.el);
      UI.clearErrors(f);
      const code = val(f, 'code').toUpperCase();
      const e1 = val(f, 'name').length < 2 ? 'Enter a venue name.' : ''; setError(f, 'name', e1);
      const e2 = !code ? 'Enter a venue code.' : ''; setError(f, 'code', e2);
      if (e1 || e2) return;
      const rec = { name: val(f, 'name'), code, area: val(f, 'area'), floor: val(f, 'floor'), coordinator: val(f, 'coordinator'), capacity: val(f, 'capacity') === '' ? null : Number(val(f, 'capacity')), mapLink: val(f, 'mapLink'), description: val(f, 'description'), setup: val(f, 'setup'), status: val(f, 'status') };
      const done = await UI.attempt(async () => {
        if (id) { await Store.update('venues', id, rec); UI.toast('Venue updated'); }
        else { await Store.insert('venues', rec); UI.toast('Venue created'); }
      }, { form: f, btn: e.currentTarget });
      if (done) { m.close(); draw(); }
    });
  }

  $('#arch').addEventListener('change', e => { showArchived = e.target.checked; draw(); });
  on(main, 'click', '#new, #new2', () => form(null));
  on(main, 'click', '[data-view]', (e, t) => view(t.dataset.view));
  on(main, 'click', '[data-edit]', (e, t) => form(t.dataset.edit));
  on(main, 'click', '[data-restore]', async (e, t) => { if (await UI.attempt(() => Store.update('venues', t.dataset.restore, { status: 'Active' }))) UI.toast('Venue restored'); draw(); });
  on(main, 'click', '[data-archive]', async (e, t) => {
    const v = Store.get('venues', t.dataset.archive), n = shiftsAt(v.id).length + teamsAt(v.id).length;
    if (await UI.confirm({ title: `Archive “${v.name}”?`, message: `It will no longer be offered for new assignments.${n ? ` ${teamsAt(v.id).length} team(s) and ${shiftsAt(v.id).length} shift(s) still reference it — review them afterwards.` : ''}`, confirmLabel: 'Archive', danger: true })) {
      if (await UI.attempt(() => Store.update('venues', v.id, { status: 'Archived' }))) UI.toast('Venue archived');
      draw();
    }
  });
  draw();
});
