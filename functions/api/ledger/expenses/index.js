import { requireTier } from '../../../_lib/auth.js';
import { uid, nowISO, json, badRequest, unauthorized } from '../../../_lib/db.js';

export async function onRequestGet({ request, env }) {
  const session = await requireTier(request, env, 'ledger');
  if (!session) return unauthorized();

  const unbooked = await env.DB.prepare(
    `SELECT * FROM expense_requests WHERE status='submitted' ORDER BY expense_date DESC, created_at DESC`
  ).all();
  for (const r of unbooked.results) {
    const items = await env.DB.prepare('SELECT * FROM expense_items WHERE request_id=? ORDER BY rowid').bind(r.id).all();
    r.items = items.results;
  }

  const { results: booked } = await env.DB.prepare(`
    SELECT le.*, er.expense_date, er.purpose, er.requester, er.request_date, er.total_amount
    FROM ledger_expenses le JOIN expense_requests er ON er.id = le.request_id
    ORDER BY er.expense_date DESC, le.booked_at DESC
  `).all();

  return json({ unbooked: unbooked.results, entries: booked });
}

export async function onRequestPost({ request, env }) {
  const session = await requireTier(request, env, 'ledger');
  if (!session) return unauthorized();
  const body = await request.json().catch(() => ({}));
  if (!body.request_id) return badRequest('缺少請款單編號');

  const already = await env.DB.prepare('SELECT id FROM ledger_expenses WHERE request_id=?').bind(body.request_id).first();
  if (already) return badRequest('此請款單已記帳');
  const reqRow = await env.DB.prepare('SELECT id FROM expense_requests WHERE id=?').bind(body.request_id).first();
  if (!reqRow) return badRequest('找不到請款單');

  const id = uid();
  const now = nowISO();
  await env.DB.batch([
    env.DB.prepare(`INSERT INTO ledger_expenses (id, request_id, booked_by, booked_at, status) VALUES (?,?,?,?,?)`)
      .bind(id, body.request_id, String(body.booked_by || '').slice(0, 100), now, 'pending'),
    env.DB.prepare("UPDATE expense_requests SET status='booked' WHERE id=?").bind(body.request_id)
  ]);
  return json({ ok: true, id }, 201);
}
