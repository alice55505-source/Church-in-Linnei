import { verifyPassword, signSession, cookieHeader, sessionSecret } from '../../_lib/auth.js';
import { json, badRequest } from '../../_lib/db.js';

export async function onRequestPost({ request, env }) {
  const body = await request.json().catch(() => ({}));
  const { tier, password } = body;
  if (!['income', 'ledger'].includes(tier) || !password) return badRequest('缺少參數');

  const hashKey = tier === 'ledger' ? 'ledger_password_hash' : 'income_password_hash';
  const saltKey = tier === 'ledger' ? 'ledger_password_salt' : 'income_password_salt';
  const hashRow = await env.DB.prepare('SELECT value FROM settings WHERE key = ?').bind(hashKey).first();
  const saltRow = await env.DB.prepare('SELECT value FROM settings WHERE key = ?').bind(saltKey).first();
  if (!hashRow || !saltRow || !hashRow.value) {
    return json({ error: '系統尚未完成初始設定，請先至 /setup.html 設定密碼' }, 500);
  }

  const ok = await verifyPassword(password, saltRow.value, hashRow.value);
  if (!ok) return json({ error: '密碼錯誤' }, 401);

  const secret = sessionSecret(env);
  const token = await signSession({ tier, iat: Date.now(), exp: Date.now() + 12 * 3600 * 1000 }, secret);
  const cookieName = tier === 'ledger' ? 'session_ledger' : 'session_income';
  return json({ ok: true }, 200, { 'Set-Cookie': cookieHeader(cookieName, token, 12 * 3600) });
}
