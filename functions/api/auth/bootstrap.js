import { hashPassword } from '../../_lib/auth.js';
import { json, badRequest } from '../../_lib/db.js';

// 一次性初始設定：建立中間層(奉獻收入)與最內層(記帳)的初始密碼。
// 密碼一經設定即失效，之後請改用各層登入後的「變更密碼」功能。
export async function onRequestPost({ request, env }) {
  const body = await request.json().catch(() => ({}));
  const { income_password, ledger_password, setup_key } = body;
  if (!income_password || !ledger_password) return badRequest('請輸入兩組密碼');
  if (income_password === ledger_password) return badRequest('中間層與最內層密碼必須不同');
  if (env.SETUP_KEY && setup_key !== env.SETUP_KEY) return json({ error: '設定金鑰錯誤' }, 401);

  const existing = await env.DB.prepare('SELECT value FROM settings WHERE key=?').bind('income_password_hash').first();
  if (existing && existing.value) return badRequest('系統已完成初始設定，請改用登入後的「變更密碼」功能');

  const incomeSalt = crypto.randomUUID();
  const ledgerSalt = crypto.randomUUID();
  const incomeHash = await hashPassword(income_password, incomeSalt);
  const ledgerHash = await hashPassword(ledger_password, ledgerSalt);

  await env.DB.batch([
    env.DB.prepare('UPDATE settings SET value=? WHERE key=?').bind(incomeSalt, 'income_password_salt'),
    env.DB.prepare('UPDATE settings SET value=? WHERE key=?').bind(incomeHash, 'income_password_hash'),
    env.DB.prepare('UPDATE settings SET value=? WHERE key=?').bind(ledgerSalt, 'ledger_password_salt'),
    env.DB.prepare('UPDATE settings SET value=? WHERE key=?').bind(ledgerHash, 'ledger_password_hash')
  ]);
  return json({ ok: true });
}
