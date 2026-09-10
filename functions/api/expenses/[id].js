import { requireTier } from '../../_lib/auth.js';
import { uid, nowISO, json, badRequest, unauthorized } from '../../_lib/db.js';

export async function onRequestGet({ params, env }) {
  const r = await env.DB.prepare('SELECT * FROM expense_requests WHERE id=?').bind(params.id).first();
  if (!r) return json({ error: '找不到資料' }, 404);
  const items = await env.DB.prepare('SELECT * FROM expense_items WHERE request_id=? ORDER BY rowid').bind(params.id).all();
  r.items = items.results;
  const receipts = await env.DB.prepare('SELECT * FROM expense_request_receipts WHERE request_id=? ORDER BY created_at').bind(params.id).all();
  r.receipts = receipts.results;
  return json({ request: r });
}

// 公開：知道請款單 id 即可編輯（與查詢同樣的權限模型），但僅限尚未記帳前可修改，
// 一旦記帳頁開始處理（booked/archived）就鎖住，避免和記帳流程衝突。
export async function onRequestPatch({ request, env, params }) {
  const row = await env.DB.prepare('SELECT * FROM expense_requests WHERE id=?').bind(params.id).first();
  if (!row) return json({ error: '找不到資料' }, 404);
  if (row.status !== 'submitted') return badRequest('此請款單已開始記帳，無法修改');

  const body = await request.json().catch(() => ({}));
  const { expense_date, purpose, requester, items, receipt_keys } = body;
  if (!expense_date || !purpose || !requester || !Array.isArray(items) || items.length === 0) {
    return badRequest('請填寫花費日期、用途、請款人與至少一項品項');
  }

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
  const now = nowISO();

  const stmts = [
    env.DB.prepare('UPDATE expense_requests SET expense_date=?, purpose=?, requester=?, total_amount=? WHERE id=?')
      .bind(expense_date, String(purpose).slice(0, 500), String(requester).slice(0, 100), total, row.id),
    env.DB.prepare('DELETE FROM expense_items WHERE request_id=?').bind(row.id),
    ...itemRows.map(it =>
      env.DB.prepare('INSERT INTO expense_items (id, request_id, name, unit_price, qty, total) VALUES (?,?,?,?,?,?)')
        .bind(it.id, row.id, it.name, it.unit_price, it.qty, it.total)
    ),
    env.DB.prepare('DELETE FROM expense_request_receipts WHERE request_id=?').bind(row.id),
    ...safeReceiptKeys.map(key =>
      env.DB.prepare('INSERT INTO expense_request_receipts (id, request_id, file_key, created_at) VALUES (?,?,?,?)')
        .bind(uid(), row.id, key, now)
    )
  ];
  await env.DB.batch(stmts);

  return json({ ok: true, total_amount: total });
}

// 尚未記帳（submitted）：請款人本人（知道 id 即可）可刪除。
// 已記帳但未入帳（booked）：僅記帳頁（ledger 登入）可刪除，一併移除記帳資料。
// 已入帳（archived/finalized）：一律不可刪除，為正式財務紀錄。
export async function onRequestDelete({ request, env, params }) {
  const row = await env.DB.prepare('SELECT * FROM expense_requests WHERE id=?').bind(params.id).first();
  if (!row) return json({ error: '找不到資料' }, 404);

  if (row.status === 'booked') {
    const session = await requireTier(request, env, 'ledger');
    if (!session) return unauthorized();
    const le = await env.DB.prepare('SELECT status FROM ledger_expenses WHERE request_id=?').bind(row.id).first();
    if (le && le.status === 'finalized') return badRequest('已入帳，無法刪除');
  } else if (row.status !== 'submitted') {
    return badRequest('已入帳，無法刪除');
  }

  await env.DB.batch([
    env.DB.prepare('DELETE FROM expense_items WHERE request_id=?').bind(row.id),
    env.DB.prepare('DELETE FROM expense_request_receipts WHERE request_id=?').bind(row.id),
    env.DB.prepare('DELETE FROM ledger_expenses WHERE request_id=?').bind(row.id),
    env.DB.prepare('DELETE FROM expense_requests WHERE id=?').bind(row.id)
  ]);
  return json({ ok: true });
}
