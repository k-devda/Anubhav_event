# Anubhav — Volunteer Management (Phase 2)

The approved vanilla HTML/CSS/JS interface, now backed by a real server and database.

- **Front end:** plain HTML, CSS, JavaScript (`public/`). No frameworks, no build step.
- **Back end:** Node.js (no npm dependencies) with the built-in `node:http` and `node:sqlite`.
- **Database:** SQLite file at `data/anubhav.sqlite` (WAL mode, foreign keys on, versioned migrations).
- **Requires:** Node 22.13 or newer (developed on Node 24).

## Run it

```bash
cd anubhav-app
npm run create-admin -- you@example.com "Your Name"   # prints a one-time temporary password
npm start                                             # http://localhost:3000
```

Sign in at `/login.html`; you must choose a new password on first sign-in.
To explore with sample data first: `npm run seed-demo` (never run this in production).
Locked out? `npm run reset-password -- you@example.com`.

Environment variables: `PORT`, `HOST` (default `127.0.0.1`), `DB_FILE`, `NODE_ENV=production`,
`COOKIE_SECURE=1` (set when served over HTTPS), `TRUST_PROXY=1` (only behind your own reverse proxy).

## Tests

```bash
npm test      # 29 integration tests against the real server and an in-memory database
```

## What is protected, and how

| Area | Behaviour |
|---|---|
| Sign-in | scrypt password hashes, HttpOnly + SameSite=Strict session cookie (Secure over HTTPS), idle (12 h) and absolute (7 d / 30 d "remember me") expiry, per-account lockout after 5 failures, per-IP rate limit, identical error for unknown user vs wrong password |
| Passwords | min 10 chars with letters + a number; temporary passwords force a change before any admin API works; changing/resetting ends other sessions |
| Roles | `admin` (everything, settings, users, deletes) · `coordinator` (read + write operational data) · `viewer` (read-only). Enforced on the server; the UI also hides controls the role can't use |
| CSRF | state-changing requests need `X-Requested-With: anubhav` and a same-origin `Origin`; cookies are SameSite=Strict |
| Public data | the public snapshot contains no emails or mobile numbers. Find My Role requires name/ID **and** the last 4 digits of the registered mobile, is rate-limited per IP and per name, and returns a generic "not found" for any mismatch |
| Input | every field validated server-side (types, lengths, enums, times, references); parameterised SQL only; output escaped in the UI |
| Headers | strict CSP (no inline scripts), nosniff, frame denial, same-origin referrer policy |
| Audit | every change is recorded in an activity log with the signed-in user |

## Before going live (not done for you)

1. Serve behind HTTPS (reverse proxy) and set `NODE_ENV=production`, `COOKIE_SECURE=1`, `TRUST_PROXY=1`.
2. Back up `data/anubhav.sqlite` (plus the `-wal` file, or use `sqlite3 .backup`) on a schedule.
3. Rate limits and lockout counters for the public endpoints are in memory: they reset on restart and assume one server process.
4. There is no email/SMS: volunteers get their ID on screen only, and password resets are done by an admin (`reset-password` or Settings → Admin users).
5. Replace the placeholder contact details and event date in Settings.

## Layout

```
server/   index.js (start) · app.js (router, static, headers) · auth.js · db.js (schema/migrations)
          resources.js (entity definitions) · validate.js · settings.js · routes/ (auth, public, admin) · cli.js
public/   HTML pages, css/, js/core (api, store, domain, ui, shell, boot) and js/pages
tests/    node:test integration tests
```

## Deploying (any host that runs Docker or Node)

The repo includes a `Dockerfile` (no npm install step - the app has no dependencies).

| Setting | Value |
|---|---|
| Start command | `node --no-warnings server/index.js` (Docker: automatic) |
| Port | the platform's `PORT` is used automatically (default 3000) |
| Health check path | `/healthz` |
| **Persistent volume** | mount at `/data` - the SQLite database lives at `/data/anubhav.sqlite`. **Without a volume all data is lost on every redeploy/restart.** |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD` | creates the first admin on first start (only if no admin exists yet). You must choose a new password at first sign-in. Remove `ADMIN_PASSWORD` from the platform afterwards. |
| `ADMIN_NAME` | optional display name for that admin |
| `NODE_ENV`, `COOKIE_SECURE`, `TRUST_PROXY`, `HOST`, `DB_FILE` | already set by the Dockerfile (`production`, `1`, `1`, `0.0.0.0`, `/data/anubhav.sqlite`) |

A brand-new database starts with Event Day 1 (27 Oct 2026), Event Day 2 (28 Oct 2026) and the venue "SLS Building".
Do not run `seed-demo` on a live database. Back up the volume regularly.

## Deploying on Vercel with a free Turso database

Vercel serves the website from its CDN and runs the API as a function (`api/index.js`); the data lives in a
free hosted **Turso** (libSQL/SQLite) database, so nothing is lost when the site is idle or redeployed.

1. Create a Turso database (Vercel Marketplace -> Turso, or turso.tech) and note its URL and auth token.
2. Import this GitHub repo into Vercel (framework: Other, no build command; `vercel.json` sets everything).
3. Environment variables on the Vercel project:

| Variable | Value |
|---|---|
| `TURSO_DATABASE_URL` | `libsql://...` (from Turso / the Marketplace integration) |
| `TURSO_AUTH_TOKEN` | token for that database |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD` | creates the first admin on first start; you must choose a new password at first sign-in. Delete `ADMIN_PASSWORD` afterwards. |

The same code also runs on a plain server (local SQLite file, or Docker + disk). To run the tests against the
hosted-database code path locally: `TEST_BACKEND=libsql npm test`.
