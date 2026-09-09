import { requireTier } from '../../_lib/auth.js';
import { json, unauthorized } from '../../_lib/db.js';
import { checkAndSendReminders } from '../../_lib/reminders.js';

// 由已登入的前端頁面在開啟時呼叫一次；本身即完成「檢查＋發送」，
// reminder_log 確保同一提醒週期內不會重複發送。
export async function onRequestGet({ request, env }) {
  const session = await requireTier(request, env, 'income');
  if (!session) return unauthorized();
  await checkAndSendReminders(env);
  return json({ ok: true });
}
