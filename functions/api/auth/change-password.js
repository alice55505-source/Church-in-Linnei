import { requireTier, hashPassword, verifyPassword } from '../../_lib/auth.js';
import { json, badRequest } from '../../_lib/db.js';

export async function onRequestPost({ request, env }) {
  const body = await request.json().catch(() => ({}));
  const { tier, oldPassword, newPassword } = body;
  if (!['income', 'ledger'].includes(tier) || !oldPassword || !newPassword) return badRequest('缺少參數');
  if (String(newPassword).length < 4) return badRequest('新密碼至少需 4 碼');

  // 只有登入該層本身才能變更該層密碼（登入內層不可變更中間層密碼，避免混淆權限）
  const session = await requireTier(request, env, tier);
  if (!session || session.tier !== tier) return json({ error: '未授權' }, 401);

  const hashKey = tier === 'ledger' ? 'ledger_password_hash' : 'income_password_hash';
  const saltKey = tier === 'ledger' ? 'ledger_password_salt' : 'income_password_salt';
  const saltRow = await env.DB.prepare('SELECT value FROM settings WHERE key=?').bind(saltKey).first();
  const hashRow = await env.DB.prepare('SELECT value FROM settings WHERE key=?').bind(hashKey).first();
  const ok = await verifyPassword(oldPassword, saltRow.value, hashRow.value);
  if (!ok) return json({ error: '原密碼錯誤' }, 401);

  const newSalt = crypto.randomUUID();
  const newHash = await hashPassword(newPassword, newSalt);
  await env.DB.batch([
    env.DB.prepare('UPDATE settings SET value=? WHERE key=?').bind(newSalt, saltKey),
    env.DB.prepare('UPDATE settings SET value=? WHERE key=?').bind(newHash, hashKey)
  ]);
  return json({ ok: true });
}
