import { requireTier, hashPassword } from '../../_lib/auth.js';
import { json, badRequest, unauthorized } from '../../_lib/db.js';

// 只有透過 Google 登入取得 ledger session 的管理員可以直接重設奉獻密碼，不需要舊密碼。
export async function onRequestPost({ request, env }) {
  const session = await requireTier(request, env, 'ledger');
  if (!session || session.tier !== 'ledger') return unauthorized();

  const body = await request.json().catch(() => ({}));
  const newPassword = body.new_password;
  if (!newPassword || String(newPassword).length < 4) return badRequest('新密碼至少需 4 碼');

  const newSalt = crypto.randomUUID();
  const newHash = await hashPassword(newPassword, newSalt);
  await env.DB.batch([
    env.DB.prepare('UPDATE settings SET value=? WHERE key=?').bind(newSalt, 'income_password_salt'),
    env.DB.prepare('UPDATE settings SET value=? WHERE key=?').bind(newHash, 'income_password_hash')
  ]);
  return json({ ok: true });
}
