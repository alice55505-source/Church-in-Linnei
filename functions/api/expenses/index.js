import { uid, nowISO, json, badRequest } from '../../_lib/db.js';

// 公開：不需登入，但不提供「列出全部請款」，只能用自己知道的請款單編號查詢
// （前端會把自己裝置送出過的 id 存在 localStorage，用這支 API 查回自己的紀錄）
export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const idsParam = url.searchParams.get('ids') || '';
  const ids = idsParam.split(',').map(s => s.trim()).filter(Boolean).slice(0, 200);
  if (ids.length === 0) return json({ requests: [] });

  const placeholders = ids.map(() => '?').join(',');
  const { results } = await env.DB.prepare(
    `SELECT * FROM expense_requests WHERE id IN (${placeholders}) ORDER BY expense_date DESC, created_at DESC`
  ).bind(...ids).all();

  for (const r of results) {
    const items = await env.DB.prepare('SELECT * FROM expense_items WHERE request_id=? ORDER BY rowid').bind(r.id).all();
    r.items = items.results;
    const receipts = await env.DB.prepare('SELECT * FROM expense_request_receipts WHERE request_id=? ORDER BY created_at').bind(r.id).all();
    r.receipts = receipts.results;
  }
  return json({ requests: results });
}

export async function onRequestPost({ request, env }) {
  const body = await request.json().catch(() => ({}));
  const { expense_date, purpose, requester, items, receipt_keys, receipt_amount } = body;
  if (!expense_date || !purpose || !requester || !Array.isArray(items) || items.length === 0) {
    return badRequest('請填寫花費日期、用途、請款人與至少一項品項');
  }

  const id = uid();
  const now = nowISO();
  let total = 0;
  const itemRows = items.map(it => {
    const unit_price = Number(it.unit_price) || 0;
    const qty = Number(it.qty) || 0;
    const t = Math.round((unit_price * qty) * 100) / 100;
    total += t;
    return { id: uid(), name: String(it.name || '').slice(0, 200), unit_price, qty, total: t };
  });

  const safeReceiptKeys = Array.isArray(receipt_keys)
    ? receipt_keys.filter(k => typeof k === 'string' && /^receipts\/[A-Za-z0-9._-]+$/.test(k)).slice(0, 10)
    : [];

  const stmts = [
    env.DB.prepare(
      `INSERT INTO expense_requests (id, expense_date, purpose, requester, request_date, total_amount, receipt_amount, status, created_at)
       VALUES (?,?,?,?,?,?,?,?,?)`
    ).bind(id, expense_date, String(purpose).slice(0, 500), String(requester).slice(0, 100), now.slice(0, 10), total,
      receipt_amount != null && receipt_amount !== '' ? Number(receipt_amount) : null, 'submitted', now),
    ...itemRows.map(it =>
      env.DB.prepare(`INSERT INTO expense_items (id, request_id, name, unit_price, qty, total) VALUES (?,?,?,?,?,?)`)
        .bind(it.id, id, it.name, it.unit_price, it.qty, it.total)
    ),
    ...safeReceiptKeys.map(key =>
      env.DB.prepare(`INSERT INTO expense_request_receipts (id, request_id, file_key, created_at) VALUES (?,?,?,?)`)
        .bind(uid(), id, key, now)
    )
  ];
  await env.DB.batch(stmts);

  return json({ ok: true, id, request_date: now.slice(0, 10), total_amount: total }, 201);
}
