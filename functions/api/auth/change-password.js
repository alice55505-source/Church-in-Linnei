import { requireTier, hashPassword, verifyPassword } from '../../_lib/auth.js';
import { json, badRequest } from '../../_lib/db.js';

// 只有奉獻（中間層）有密碼可自行變更；記帳（最內層）改用 Google 登入，沒有密碼可變更。
// 忘記奉獻密碼時，改由管理員（Google 登入）於管理頁直接重設，見 admin-set-income-password.js
export async function onRequestPost({ request, env }) {
  const body = await request.json().catch(() => ({}));
  const { oldPassword, newPassword } = body;
  if (!oldPassword || !newPassword) return badRequest('缺少參數');
  if (String(newPassword).length < 4) return badRequest('新密碼至少需 4 碼');

  const session = await requireTier(request, env, 'income');
  if (!session) return json({ error: '未授權' }, 401);

  const saltRow = await env.DB.prepare('SELECT value FROM settings WHERE key=?').bind('income_password_salt').first();
  const hashRow = await env.DB.prepare('SELECT value FROM settings WHERE key=?').bind('income_password_hash').first();
  const ok = await verifyPassword(oldPassword, saltRow.value, hashRow.value);
  if (!ok) return json({ error: '原密碼錯誤' }, 401);

  const newSalt = crypto.randomUUID();
  const newHash = await hashPassword(newPassword, newSalt);
  await env.DB.batch([
    env.DB.prepare('UPDATE settings SET value=? WHERE key=?').bind(newSalt, 'income_password_salt'),
    env.DB.prepare('UPDATE settings SET value=? WHERE key=?').bind(newHash, 'income_password_hash')
  ]);
  return json({ ok: true });
}
