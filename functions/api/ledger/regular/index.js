import { requireTier } from '../../../_lib/auth.js';
import { uid, nowISO, json, badRequest, unauthorized } from '../../../_lib/db.js';

const VALID_TYPES = ['monthly', 'yearly', 'onetime'];

export async function onRequestGet({ request, env }) {
  const session = await requireTier(request, env, 'ledger');
  if (!session) return unauthorized();
  const url = new URL(request.url);
  const month = url.searchParams.get('month') || nowISO().slice(0, 7);
  const monthNum = Number(month.slice(5, 7));

  let { results } = await env.DB.prepare('SELECT * FROM regular_expense_items WHERE month=? ORDER BY created_at').bind(month).all();
  const existingNames = new Set(results.map(r => r.name));

  // 每月固定：每個月自動帶入。每年固定：僅在對應月份自動帶入。一次性：不自動帶入。
  // 用「每個名稱最近一次（本月之前、仍在使用中）的紀錄」當作自動帶入的依據。
  // 若資料庫尚未套用 expense_type/active/recur_month 欄位的遷移，略過自動延續，
  // 仍正常回傳本月既有項目，避免整支 API 掛掉。
  try {
    const { results: candidates } = await env.DB.prepare(
      `SELECT t1.* FROM regular_expense_items t1
       INNER JOIN (
         SELECT name, MAX(month) as max_month FROM regular_expense_items
         WHERE expense_type != 'onetime' AND active = 1 AND month < ?
         GROUP BY name
       ) t2 ON t1.name = t2.name AND t1.month = t2.max_month`
    ).bind(month).all();

    const now = nowISO();
    const stmts = candidates
      .filter(c => !existingNames.has(c.name))
      .filter(c => c.expense_type === 'monthly' || (c.expense_type === 'yearly' && c.recur_month === monthNum))
      .map(c =>
        env.DB.prepare(
          `INSERT INTO regular_expense_items (id, month, name, amount, note, expense_type, recur_month, paid, status, active, created_at)
           VALUES (?,?,?,?,?,?,?,0,'open',1,?)`
        ).bind(uid(), month, c.name, c.amount, c.note || '', c.expense_type, c.recur_month, now)
      );

    if (stmts.length) {
      await env.DB.batch(stmts);
      const r2 = await env.DB.prepare('SELECT * FROM regular_expense_items WHERE month=? ORDER BY created_at').bind(month).all();
      results = r2.results;
    }
  } catch (e) {}

  return json({ month, items: results });
}

export async function onRequestPost({ request, env }) {
  const session = await requireTier(request, env, 'ledger');
  if (!session) return unauthorized();
  const body = await request.json().catch(() => ({}));
  const { month, name, amount, note } = body;
  if (!month || !name) return badRequest('缺少月份或項目名稱');
  const expense_type = VALID_TYPES.includes(body.expense_type) ? body.expense_type : 'monthly';
  const recur_month = expense_type === 'yearly' ? Number(month.slice(5, 7)) : null;
  const id = uid();
  try {
    await env.DB.prepare(
      `INSERT INTO regular_expense_items (id, month, name, amount, note, expense_type, recur_month, paid, status, active, created_at)
       VALUES (?,?,?,?,?,?,?,0,'open',1,?)`
    ).bind(id, month, String(name).slice(0, 200), Number(amount) || 0, note || '', expense_type, recur_month, nowISO()).run();
  } catch (e) {
    // 資料庫尚未套用新欄位的遷移時，退回舊欄位寫入
    await env.DB.prepare(
      `INSERT INTO regular_expense_items (id, month, name, amount, note, paid, status, created_at) VALUES (?,?,?,?,?,0,'open',?)`
    ).bind(id, month, String(name).slice(0, 200), Number(amount) || 0, note || '', nowISO()).run();
  }
  return json({ ok: true, id }, 201);
}
