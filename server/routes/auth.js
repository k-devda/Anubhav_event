'use strict';
const auth = require('../auth');
const { AppError, now } = require('../util');

module.exports = function ({ db, router, limiter, config }) {
  const GENERIC = 'That email and password combination was not recognised.';

  router.post('/api/auth/login', async ctx => {
    const email = typeof ctx.body.email === 'string' ? ctx.body.email.trim().toLowerCase().slice(0, 160) : '';
    const password = typeof ctx.body.password === 'string' ? ctx.body.password.slice(0, 200) : '';
    if (!email || !password) throw new AppError(422, 'Enter your email and password.', { errors: { email: !email ? 'Enter your email or username.' : '', password: !password ? 'Enter your password.' : '' } });
    if (!(await limiter.take(`login-ip:${ctx.ip}`, 20, 15 * 60e3))) throw new AppError(429, 'Too many sign-in attempts. Try again in a few minutes.');

    const user = await db.get('SELECT * FROM users WHERE email = ?', [email]);
    if (user && user.locked_until && Date.parse(user.locked_until) > Date.now()) {
      await auth.dummyVerify(password);
      throw new AppError(429, 'This account is temporarily locked after repeated failed sign-ins. Try again later.');
    }
    const ok = user && user.active ? await auth.verifyPassword(password, user.password_hash) : (await auth.dummyVerify(password), false);
    if (!ok) {
      if (user) {
        const fails = Number(user.failed_attempts) + 1;
        const lock = fails >= config.loginMaxFailures ? new Date(Date.now() + config.loginLockMinutes * 60e3).toISOString() : null;
        await db.run('UPDATE users SET failed_attempts = ?, locked_until = ? WHERE id = ?', [lock ? 0 : fails, lock, user.id]);
      }
      throw new AppError(401, GENERIC);
    }
    await db.run('UPDATE users SET failed_attempts = 0, locked_until = NULL, last_login_at = ? WHERE id = ?', [now(), user.id]);
    const { token, maxAge } = await auth.createSession(db, user.id, { remember: ctx.body.remember === true, ip: ctx.ip, userAgent: ctx.req.headers['user-agent'] });
    ctx.headers['Set-Cookie'] = auth.cookieHeader(token, maxAge);
    return { user: auth.publicUser({ id: user.id, email: user.email, name: user.name, role: user.role, mustChangePassword: user.must_change_password }) };
  });

  router.post('/api/auth/logout', async ctx => {
    await auth.destroySession(db, ctx.req);
    ctx.headers['Set-Cookie'] = auth.clearCookieHeader();
    return { ok: true };
  });

  router.get('/api/auth/me', async ctx => {
    return { user: ctx.user ? auth.publicUser(ctx.user) : null };
  });

  router.post('/api/auth/change-password', async ctx => {
    if (!ctx.user) throw new AppError(401, 'Please sign in.');
    if (!(await limiter.take(`pw:${ctx.user.id}`, 10, 15 * 60e3))) throw new AppError(429, 'Too many attempts. Try again later.');
    const { currentPassword, newPassword } = ctx.body;
    const row = await db.get('SELECT password_hash FROM users WHERE id = ?', [ctx.user.id]);
    if (typeof currentPassword !== 'string' || !(await auth.verifyPassword(currentPassword, row.password_hash))) {
      throw new AppError(422, 'Your current password is not correct.', { errors: { currentPassword: 'Your current password is not correct.' } });
    }
    const problem = auth.passwordProblem(newPassword, ctx.user.email);
    if (problem) throw new AppError(422, problem, { errors: { newPassword: problem } });
    if (newPassword === currentPassword) throw new AppError(422, 'Choose a different password.', { errors: { newPassword: 'Choose a different password.' } });
    await db.run('UPDATE users SET password_hash = ?, must_change_password = 0, updated_at = ? WHERE id = ?', [await auth.hashPassword(newPassword), now(), ctx.user.id]);
    // end every other session for this user
    await db.run('DELETE FROM auth_sessions WHERE user_id = ? AND token_hash <> ?', [ctx.user.id, ctx.user.tokenHash]);
    return { ok: true };
  });
};
