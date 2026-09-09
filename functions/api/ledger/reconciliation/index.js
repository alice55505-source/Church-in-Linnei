import { requireTier } from '../../../_lib/auth.js';
import { nowISO, json, badRequest, unauthorized } from '../../../_lib/db.js';
import { computeCumulativeBalance } from '../../../_lib/balance.js';

export async function onRequestGet({ request, env }) {
  const session = await requireTier(request, env, 'ledger');
  if (!session) return unauthorized();
  const url = new URL(request.url);
  const month = url.searchParams.get('month') || nowISO().slice(0, 7);
  const row = await env.DB.prepare('SELECT * FROM monthly_reconciliation WHERE month=?').bind(month).first();
  const computed_balance = await computeCumulativeBalance(env, month);
  if (!row) return json({ month, exists: false, computed_balance });
  return json({ month, exists: true, record: row, computed_balance });
}

export async function onRequestPost({ request, env }) {
  const session = await requireTier(request, env, 'ledger');
  if (!session) return unauthorized();
  const body = await request.json().catch(() => ({}));
  const { month, bank_balance, file_key } = body;
  if (!month || !file_key) return badRequest('缺少月份或存簿/網銀照片');

  const existing = await env.DB.prepare('SELECT status FROM monthly_reconciliation WHERE month=?').bind(month).first();
  if (existing && existing.status === 'confirmed') return badRequest('本月已完成結算，無法修改');

  const computed_balance = await computeCumulativeBalance(env, month);
  const now = nowISO();

  if (existing) {
    await env.DB.prepare('UPDATE monthly_reconciliation SET bank_statement_key=?, bank_balance=?, computed_balance=?, updated_at=? WHERE month=?')
      .bind(file_key, Number(bank_balance) || 0, computed_balance, now, month).run();
  } else {
    await env.DB.prepare(
      `INSERT INTO monthly_reconciliation (month, bank_statement_key, bank_balance, computed_balance, status, created_at, updated_at)
       VALUES (?,?,?,?,?,?,?)`
    ).bind(month, file_key, Number(bank_balance) || 0, computed_balance, 'open', now, now).run();
  }
  return json({ ok: true });
}
