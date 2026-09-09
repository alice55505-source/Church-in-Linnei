import { json } from '../../_lib/db.js';

export async function onRequestGet({ params, env }) {
  const r = await env.DB.prepare('SELECT * FROM expense_requests WHERE id=?').bind(params.id).first();
  if (!r) return json({ error: '找不到資料' }, 404);
  const items = await env.DB.prepare('SELECT * FROM expense_items WHERE request_id=? ORDER BY rowid').bind(params.id).all();
  r.items = items.results;
  const receipts = await env.DB.prepare('SELECT * FROM expense_request_receipts WHERE request_id=? ORDER BY created_at').bind(params.id).all();
  r.receipts = receipts.results;
  return json({ request: r });
}
