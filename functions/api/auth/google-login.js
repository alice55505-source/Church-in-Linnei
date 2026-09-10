import { signSession, cookieHeader, sessionSecret } from '../../_lib/auth.js';
import { verifyGoogleIdToken } from '../../_lib/google.js';
import { json, badRequest } from '../../_lib/db.js';

// 最內層（記帳）改用 Google 帳號登入，取代密碼；成功後核發與密碼登入相同的 session cookie，
// 其餘所有需要 tier='ledger' 的權限檢查完全不受影響。
export async function onRequestPost({ request, env }) {
  const body = await request.json().catch(() => ({}));
  if (!body.credential) return badRequest('缺少 Google 登入憑證');

  let email;
  try {
    ({ email } = await verifyGoogleIdToken(env, body.credential));
  } catch (e) {
    return json({ error: e.message || '登入失敗' }, 401);
  }

  const secret = sessionSecret(env);
  const token = await signSession({ tier: 'ledger', email, iat: Date.now(), exp: Date.now() + 12 * 3600 * 1000 }, secret);
  return json({ ok: true, email }, 200, { 'Set-Cookie': cookieHeader('session_ledger', token, 12 * 3600) });
}
