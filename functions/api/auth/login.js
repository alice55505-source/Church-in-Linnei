import { verifyPassword, signSession, cookieHeader, sessionSecret } from '../../_lib/auth.js';
import { json, badRequest } from '../../_lib/db.js';

// 只有奉獻（中間層）用密碼登入；記帳（最內層）已改為 Google 登入，見 google-login.js
export async function onRequestPost({ request, env }) {
  const body = await request.json().catch(() => ({}));
  const { tier, password } = body;
  if (tier !== 'income' || !password) return badRequest('缺少參數，或此層已改用 Google 登入');

  const hashRow = await env.DB.prepare('SELECT value FROM settings WHERE key = ?').bind('income_password_hash').first();
  const saltRow = await env.DB.prepare('SELECT value FROM settings WHERE key = ?').bind('income_password_salt').first();
  if (!hashRow || !saltRow || !hashRow.value) {
    return json({ error: '系統尚未設定密碼，請聯絡管理員' }, 500);
  }

  const ok = await verifyPassword(password, saltRow.value, hashRow.value);
  if (!ok) return json({ error: '密碼錯誤' }, 401);

  const secret = sessionSecret(env);
  const token = await signSession({ tier: 'income', iat: Date.now(), exp: Date.now() + 12 * 3600 * 1000 }, secret);
  return json({ ok: true }, 200, { 'Set-Cookie': cookieHeader('session_income', token, 12 * 3600) });
}
