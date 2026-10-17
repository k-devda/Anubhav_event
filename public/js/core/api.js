/* ==========================================================
   API client — thin fetch wrapper for the Anubhav server.
   Same-origin only; the session lives in an HttpOnly cookie.
   ========================================================== */
const Api = (() => {
  'use strict';

  class ApiError extends Error {
    constructor(status, body) {
      super((body && body.error) || 'Request failed.');
      this.status = status;
      this.errors = (body && body.errors) || {};
      this.code = body && body.code;
    }
  }

  async function raw(method, url, body) {
    const opts = { method, credentials: 'same-origin', headers: { 'X-Requested-With': 'anubhav', Accept: 'application/json' } };
    if (body !== undefined) { opts.headers['Content-Type'] = 'application/json'; opts.body = JSON.stringify(body); }
    let res;
    try { res = await fetch(url, opts); } catch (e) { throw new ApiError(0, { error: 'Could not reach the server. Check your connection and try again.' }); }
    let data = null;
    try { data = await res.json(); } catch (e) { /* empty body */ }
    if (!res.ok) throw new ApiError(res.status, data);
    return { data, res };
  }

  const call = method => async (url, body) => (await raw(method, url, body)).data;
  return { raw, ApiError, get: call('GET'), post: call('POST'), put: call('PUT'), del: call('DELETE') };
})();
