/* ==========================================================
   Boot — loads data from the server, builds the page shell, then
   runs the page script. Page scripts register with Boot.run(fn).
   ========================================================== */
const Boot = (() => {
  'use strict';
  const area = document.body.dataset.area;
  const ROOT = document.body.dataset.root || '';

  function showError(e) {
    const main = document.getElementById('main');
    const msg = e && e.message ? e.message : 'Something went wrong.';
    main.innerHTML = `<div class="container" style="padding:var(--s-7) 0">${UI.stateBlock({ icon: 'alert', title: 'We couldn’t load this page', text: UI.esc(msg), action: '<button class="btn btn-primary" type="button" onclick="location.reload()">Try again</button>' })}</div>`;
  }

  const ready = (async () => {
    try {
      if (area === 'bare') return true; // login screen loads nothing up front
      await Store.init();
      Shell.build();
      return true;
    } catch (e) {
      if (area === 'admin' && e.status === 401) {
        location.replace(`${ROOT}login.html?next=${encodeURIComponent(location.pathname)}`);
      } else if (area === 'admin' && e.code === 'PASSWORD_CHANGE_REQUIRED') {
        location.replace(`${ROOT}login.html?change=1`);
      } else showError(e);
      return false;
    }
  })();

  return { ready, run(fn) { ready.then(ok => { if (ok) fn(); }); } };
})();
