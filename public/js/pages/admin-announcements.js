Boot.run(() => {
  'use strict';
  const { icon, esc, badge, fmtDate, $, on, fieldHtml, setError, val } = UI;
  const main = document.getElementById('main');
  let filter = '';

  main.innerHTML = `${Shell.pageHead('Announcements', 'Draft, preview, publish and archive messages. Published items appear on the public Announcements page straight away.',
    `<a class="btn btn-secondary" href="../announcements.html" target="_blank" rel="noopener">${icon('eye', 16)} Open public page</a><button class="btn btn-primary" type="button" id="new">${icon('plus', 16)} New announcement</button>`)}
    <section class="card"><div class="toolbar"><div class="field"><label for="fs">Status</label><select class="select" id="fs"><option value="">All</option><option>Published</option><option>Draft</option><option>Archived</option></select></div></div><div id="out"></div></section>`;

  const isExpired = a => a.expiry && a.expiry < new Date().toISOString().slice(0, 10);

  function draw() {
    const list = Store.list('announcements').filter(a => !filter || a.status === filter).sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
    $('#out').innerHTML = list.length ? `<div class="table-wrap"><table class="table table-cards"><thead><tr><th>Title</th><th>Audience</th><th>Published</th><th>Priority</th><th>Status</th><th>Expiry</th><th><span class="sr-only">Actions</span></th></tr></thead><tbody>
      ${list.map(a => `<tr><td data-label="Title"><span class="cell-strong">${esc(a.title)}</span><span class="cell-sub">${esc(a.message.length > 80 ? a.message.slice(0, 77) + '…' : a.message)}</span></td>
        <td data-label="Audience">${esc(a.audience === 'Specific team' ? Domain.teamName(a.teamId) : a.audience)}</td><td data-label="Published">${fmtDate(a.publishedAt)}</td><td data-label="Priority">${badge(a.priority)}</td>
        <td data-label="Status">${badge(a.status)}${isExpired(a) && a.status === 'Published' ? ' <span class="badge badge-bad">Expired</span>' : ''}</td><td data-label="Expiry">${a.expiry ? fmtDate(a.expiry) : '—'}</td>
        <td class="cell-actions"><div class="row-actions"><button class="btn btn-ghost btn-icon btn-sm" data-preview="${a.id}" aria-label="Preview" title="Preview">${icon('eye', 16)}</button><button class="btn btn-ghost btn-icon btn-sm" data-edit="${a.id}" aria-label="Edit ${esc(a.title)}" title="Edit">${icon('edit', 16)}</button>
        ${a.status !== 'Published' ? `<button class="btn btn-ghost btn-sm" data-publish="${a.id}">Publish</button>` : ''}
        ${a.status !== 'Archived' ? `<button class="btn btn-danger-ghost btn-icon btn-sm" data-archive="${a.id}" aria-label="Archive ${esc(a.title)}" title="Archive">${icon('archive', 16)}</button>` : ''}</div></td></tr>`).join('')}</tbody></table></div>`
      : UI.stateBlock({ icon: 'megaphone', title: 'No announcements', text: 'Create one to share updates with volunteers.', action: '<button class="btn btn-primary" id="new2" type="button">New announcement</button>' });
  }

  function previewHtml(a) {
    return `<article class="card ann-card priority-${(a.priority || 'Normal').toLowerCase()}"><div class="ann-meta">${badge(a.priority + ' priority', { High: 'bad', Normal: 'gold', Low: '' }[a.priority])}<span>${icon('calendar', 13)} ${fmtDate(a.publishedAt || new Date().toISOString())}</span><span>${icon('users', 13)} ${esc(a.audience === 'Specific team' ? Domain.teamName(a.teamId) : a.audience)}</span></div><h3>${esc(a.title || 'Untitled')}</h3><p>${esc(a.message || 'Your message will appear here.')}</p></article>`;
  }
  const preview = id => UI.openModal({ title: 'Public preview', size: 'md', body: previewHtml(Store.get('announcements', id)), footer: '<button class="btn btn-secondary" data-close type="button">Close</button>' });

  function form(id) {
    const a = id ? Store.get('announcements', id) : { title: '', message: '', audience: 'All volunteers', teamId: '', priority: 'Normal', status: 'Draft', expiry: '' };
    const m = UI.openModal({
      title: id ? 'Edit announcement' : 'New announcement', size: 'lg',
      body: `<form id="a-form" novalidate><div class="field-grid">
        ${fieldHtml({ id: 'an-title', name: 'title', label: 'Title', required: true, value: a.title, className: 'span-2', attrs: ' maxlength="120"' })}
        ${fieldHtml({ id: 'an-msg', name: 'message', label: 'Message', type: 'textarea', rows: 4, required: true, value: a.message, className: 'span-2', attrs: ' maxlength="1000"' })}
        ${fieldHtml({ id: 'an-aud', name: 'audience', label: 'Audience', type: 'select', value: a.audience, options: ['All volunteers', 'Specific team'] })}
        ${fieldHtml({ id: 'an-team', name: 'team', label: 'Team', type: 'select', value: a.teamId, options: [{ value: '', label: 'Select team…' }, ...Domain.activeTeams().map(t => ({ value: t.id, label: t.name }))] })}
        ${fieldHtml({ id: 'an-pri', name: 'priority', label: 'Priority', type: 'select', value: a.priority, options: ['High', 'Normal', 'Low'] })}
        ${fieldHtml({ id: 'an-status', name: 'status', label: 'Publish status', type: 'select', value: a.status, options: ['Draft', 'Published', 'Archived'] })}
        ${fieldHtml({ id: 'an-exp', name: 'expiry', label: 'Expiry date (optional)', type: 'date', value: a.expiry, hint: 'Hidden from the public page after this date.' })}
      </div><h3 style="margin:var(--s-5) 0 var(--s-2)">Preview</h3><div id="an-prev"></div></form>`,
      footer: `<button class="btn btn-secondary" type="button" data-close>Cancel</button><button class="btn btn-primary" type="button" id="a-save">${id ? 'Save' : 'Create'}</button>`
    });
    const f = $('#a-form', m.el);
    const cur = () => ({ title: val(f, 'title'), message: val(f, 'message'), audience: val(f, 'audience'), teamId: val(f, 'team'), priority: val(f, 'priority'), publishedAt: a.publishedAt });
    const sync = () => { f.elements.team.disabled = f.elements.audience.value !== 'Specific team'; $('#an-prev', m.el).innerHTML = previewHtml(cur()); };
    f.addEventListener('input', sync); f.addEventListener('change', sync); sync();
    $('#a-save', m.el).addEventListener('click', async e => {
      UI.clearErrors(f);
      const d = cur(); const spec = d.audience === 'Specific team';
      const err = { title: d.title ? '' : 'Enter a title.', message: d.message ? '' : 'Enter a message.', team: spec && !d.teamId ? 'Select a team.' : '' };
      Object.keys(err).forEach(k => setError(f, k, err[k])); if (Object.values(err).some(Boolean)) return;
      const status = val(f, 'status');
      const rec = { title: d.title, message: d.message, audience: d.audience, teamId: spec ? d.teamId : null, priority: d.priority, status, expiry: val(f, 'expiry') };
      const done = await UI.attempt(async () => {
        if (id) await Store.update('announcements', id, rec); else await Store.insert('announcements', rec);
        UI.toast(id ? 'Announcement saved' : (status === 'Published' ? 'Announcement published' : 'Draft saved'));
      }, { form: f, map: { teamId: 'team' }, btn: e.currentTarget });
      if (done) { m.close(); draw(); }
    });
  }

  main.addEventListener('change', e => { if (e.target.id === 'fs') { filter = e.target.value; draw(); } });
  on(main, 'click', '#new, #new2', () => form(null));
  on(main, 'click', '[data-edit]', (e, t) => form(t.dataset.edit));
  on(main, 'click', '[data-preview]', (e, t) => preview(t.dataset.preview));
  on(main, 'click', '[data-publish]', async (e, t) => {
    const a = Store.get('announcements', t.dataset.publish);
    if (await UI.attempt(() => Store.update('announcements', a.id, { status: 'Published' }))) UI.toast('Published — now visible on the public page');
    draw();
  });
  on(main, 'click', '[data-archive]', async (e, t) => {
    const a = Store.get('announcements', t.dataset.archive);
    if (await UI.confirm({ title: 'Archive announcement?', message: `“${esc(a.title)}” will be removed from the public page. You can republish it later.`, confirmLabel: 'Archive', danger: true })) {
      if (await UI.attempt(() => Store.update('announcements', a.id, { status: 'Archived' }))) UI.toast('Announcement archived');
      draw();
    }
  });
  draw();
  if (new URLSearchParams(location.search).get('new')) form(null);
});
