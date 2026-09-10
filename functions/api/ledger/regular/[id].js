import { requireTier } from '../../../_lib/auth.js';
import { nowISO, json, badRequest, unauthorized, saveDataUrlImage } from '../../../_lib/db.js';

export async function onRequestPatch({ request, env, params }) {
  const session = await requireTier(request, env, 'ledger');
  if (!session) return unauthorized();
  const body = await request.json().catch(() => ({}));
  const row = await env.DB.prepare('SELECT * FROM regular_expense_items WHERE id=?').bind(params.id).first();
  if (!row) return json({ error: '找不到' }, 404);
  if (row.status === 'confirmed') return badRequest('已確認完成，無法修改');

  const action = body.action;

  if (action === 'update') {
    await env.DB.prepare('UPDATE regular_expense_items SET name=?, amount=?, note=? WHERE id=?')
      .bind(body.name || row.name, Number(body.amount) || 0, body.note ?? row.note, row.id).run();
    return json({ ok: true });
  }

  if (action === 'attach_payment_proof') {
    if (!body.file_key) return badRequest('缺少轉帳記錄相片');
    await env.DB.prepare('UPDATE regular_expense_items SET payment_proof_key=?, paid=1 WHERE id=?')
      .bind(body.file_key, row.id).run();
    return json({ ok: true });
  }

  if (action === 'sign_incharge') {
    const key = await saveDataUrlImage(env, body.signature, 'signatures');
    if (!key) return badRequest('缺少負責弟兄簽名');
    await env.DB.prepare('UPDATE regular_expense_items SET incharge_signature_key=?, incharge_signed_at=? WHERE id=?')
      .bind(key, nowISO(), row.id).run();
    return json({ ok: true });
  }

  if (action === 'confirm') {
    if (!row.payment_proof_key) return badRequest('需先上傳轉帳記錄相片');
    if (!row.incharge_signature_key) return badRequest('需先由負責弟兄簽名');
    await env.DB.prepare("UPDATE regular_expense_items SET status='confirmed' WHERE id=?").bind(row.id).run();
    return json({ ok: true });
  }

  return badRequest('未知的操作');
}

export async function onRequestDelete({ request, env, params }) {
  const session = await requireTier(request, env, 'ledger');
  if (!session) return unauthorized();
  const row = await env.DB.prepare('SELECT * FROM regular_expense_items WHERE id=?').bind(params.id).first();
  if (!row) return json({ error: '找不到' }, 404);
  if (row.status === 'confirmed') return badRequest('已確認完成，無法刪除');
  await env.DB.prepare('DELETE FROM regular_expense_items WHERE id=?').bind(row.id).run();
  return json({ ok: true });
}
