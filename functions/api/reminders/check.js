import { requireTier } from '../../_lib/auth.js';
import { json, unauthorized } from '../../_lib/db.js';

// 提醒（推播通知）已停用：保留端點避免舊版頁面呼叫出錯，但不再發送任何通知
export async function onRequestGet({ request, env }) {
  const session = await requireTier(request, env, 'income');
  if (!session) return unauthorized();
  return json({ ok: true });
}
