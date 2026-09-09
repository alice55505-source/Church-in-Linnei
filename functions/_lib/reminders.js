import { sendPush } from './push.js';
import { nowISO } from './db.js';

const DAY_MS = 24 * 3600 * 1000;

async function alreadySent(env, key) {
  const row = await env.DB.prepare('SELECT key FROM reminder_log WHERE key=?').bind(key).first();
  return !!row;
}
async function markSent(env, key) {
  await env.DB.prepare('INSERT OR IGNORE INTO reminder_log (key, sent_at) VALUES (?,?)').bind(key, nowISO()).run();
}

async function notifyTier(env, tier, body) {
  if (!env.VAPID_PRIVATE_JWK || !env.VAPID_PUBLIC_KEY) return; // 尚未設定推播金鑰
  const { results } = await env.DB.prepare('SELECT * FROM push_subscriptions WHERE tier=?').bind(tier).all();
  for (const sub of results) {
    try {
      const res = await sendPush(env, sub);
      if (res.status === 404 || res.status === 410) {
        await env.DB.prepare('DELETE FROM push_subscriptions WHERE id=?').bind(sub.id).run();
      }
    } catch (e) {
      // 單一裝置推播失敗不影響其他裝置
    }
  }
}

// 由已登入使用者開啟 income.html / ledger.html 時觸發檢查（取代 Cloudflare Pages 不支援的排程 Cron）。
// 每種提醒以 reminder_log 記錄避免同一週期內重複發送。
export async function checkAndSendReminders(env) {
  const now = new Date();
  const month = now.toISOString().slice(0, 7);
  const day = now.getUTCDate();

  // 1. 月初（1-5 日）：召會經常費支出提醒
  if (day <= 5) {
    const key = `regular_start_${month}`;
    if (!(await alreadySent(env, key))) {
      const items = await env.DB.prepare('SELECT status FROM regular_expense_items WHERE month=?').bind(month).all();
      const done = items.results.length > 0 && items.results.every(i => i.status === 'confirmed');
      if (!done) {
        await notifyTier(env, 'ledger', '本月召會經常費支出尚待登記，請開啟記帳頁處理');
        await markSent(env, key);
      }
    }
  }

  // 2. 月中（15-17 日）：經常費仍未完成再次提醒
  if (day >= 15 && day <= 17) {
    const key = `regular_mid_${month}`;
    if (!(await alreadySent(env, key))) {
      const items = await env.DB.prepare('SELECT status FROM regular_expense_items WHERE month=?').bind(month).all();
      const done = items.results.length > 0 && items.results.every(i => i.status === 'confirmed');
      if (!done) {
        await notifyTier(env, 'ledger', '本月召會經常費支出尚未完成，請盡快處理');
        await markSent(env, key);
      }
    }
  }

  // 3. 月底（最後 3 天）：上傳銀行帳戶餘額照片提醒
  const lastDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0)).getUTCDate();
  if (day >= lastDay - 2) {
    const key = `bank_recon_${month}`;
    if (!(await alreadySent(env, key))) {
      const recon = await env.DB.prepare('SELECT status FROM monthly_reconciliation WHERE month=?').bind(month).first();
      if (!recon || recon.status !== 'confirmed') {
        await notifyTier(env, 'ledger', '月底了，請上傳銀行帳戶存簿照片或網銀截圖進行對帳');
        await markSent(env, key);
      }
    }
  }

  // 4. 個人奉獻包簽收逾一週提醒
  {
    const cutoff = new Date(now.getTime() - 7 * DAY_MS).toISOString();
    const { results } = await env.DB.prepare(
      `SELECT id FROM personal_offerings WHERE recipient_signature_key IS NULL AND created_at IS NOT NULL AND created_at <= ?`
    ).bind(cutoff).all();
    const pending = [];
    for (const r of results) {
      if (!(await alreadySent(env, `offering_pending_${r.id}`))) pending.push(r.id);
    }
    if (pending.length > 0) {
      await notifyTier(env, 'income', `有 ${pending.length} 筆個人奉獻包已逾一週未簽收，請至奉獻收入頁處理`);
      for (const id of pending) await markSent(env, `offering_pending_${id}`);
    }
  }

  // 5. 請款單逾兩週未完成提醒
  {
    const cutoff = new Date(now.getTime() - 14 * DAY_MS).toISOString();
    const { results } = await env.DB.prepare(
      `SELECT id FROM expense_requests WHERE status != 'archived' AND created_at <= ?`
    ).bind(cutoff).all();
    const pending = [];
    for (const r of results) {
      if (!(await alreadySent(env, `expense_pending_${r.id}`))) pending.push(r.id);
    }
    if (pending.length > 0) {
      await notifyTier(env, 'ledger', `有 ${pending.length} 筆請款單已逾兩週未完成入帳，請至記帳頁處理`);
      for (const id of pending) await markSent(env, `expense_pending_${id}`);
    }
  }
}
