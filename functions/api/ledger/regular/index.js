import { requireTier } from '../../../_lib/auth.js';
import { uid, nowISO, json, badRequest, unauthorized } from '../../../_lib/db.js';

export async function onRequestGet({ request, env }) {
  const session = await requireTier(request, env, 'ledger');
  if (!session) return unauthorized();
  const url = new URL(request.url);
  const month = url.searchParams.get('month') || nowISO().slice(0, 7);

  let { results } = await env.DB.prepare('SELECT * FROM regular_expense_items WHERE month=? ORDER BY created_at').bind(month).all();

  // 每月自動更新：若本月尚無項目，從最近一個月的項目自動帶入（金額、名稱沿用，狀態重設）
  if (results.length === 0) {
    const prev = await env.DB.prepare(`SELECT DISTINCT month FROM regular_expense_items WHERE month < ? ORDER BY month DESC LIMIT 1`).bind(month).first();
    if (prev) {
      const prevItems = await env.DB.prepare('SELECT * FROM regular_expense_items WHERE month=?').bind(prev.month).all();
      const now = nowISO();
      const stmts = prevItems.results.map(it =>
        env.DB.prepare(`INSERT INTO regular_expense_items (id, month, name, amount, note, paid, status, created_at) VALUES (?,?,?,?,?,0,'open',?)`)
          .bind(uid(), month, it.name, it.amount, it.note || '', now)
      );
      if (stmts.length) {
        await env.DB.batch(stmts);
        const r2 = await env.DB.prepare('SELECT * FROM regular_expense_items WHERE month=? ORDER BY created_at').bind(month).all();
        results = r2.results;
      }
    }
  }
  return json({ month, items: results });
}

export async function onRequestPost({ request, env }) {
  const session = await requireTier(request, env, 'ledger');
  if (!session) return unauthorized();
  const body = await request.json().catch(() => ({}));
  const { month, name, amount, note } = body;
  if (!month || !name) return badRequest('缺少月份或項目名稱');
  const id = uid();
  await env.DB.prepare(`INSERT INTO regular_expense_items (id, month, name, amount, note, paid, status, created_at) VALUES (?,?,?,?,?,0,'open',?)`)
    .bind(id, month, String(name).slice(0, 200), Number(amount) || 0, note || '', nowISO()).run();
  return json({ ok: true, id }, 201);
}
