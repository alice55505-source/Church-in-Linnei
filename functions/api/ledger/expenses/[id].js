import { requireTier } from '../../../_lib/auth.js';
import { nowISO, json, badRequest, unauthorized, saveDataUrlImage } from '../../../_lib/db.js';

export async function onRequestPatch({ request, env, params }) {
  const session = await requireTier(request, env, 'ledger');
  if (!session) return unauthorized();
  const body = await request.json().catch(() => ({}));
  const row = await env.DB.prepare('SELECT * FROM ledger_expenses WHERE id=?').bind(params.id).first();
  if (!row) return json({ error: '找不到' }, 404);
  if (row.status === 'finalized') return badRequest('已入帳，無法修改');

  const action = body.action;

  if (action === 'sign_incharge') {
    const key = await saveDataUrlImage(env, body.signature, 'signatures');
    if (!key) return badRequest('缺少負責弟兄簽名');
    await env.DB.prepare('UPDATE ledger_expenses SET incharge_signature_key=?, incharge_signed_at=? WHERE id=?')
      .bind(key, nowISO(), row.id).run();
    return json({ ok: true });
  }

  // 請款簽收：由請款人本人簽名確認已收到款項，不是上傳照片
  if (action === 'sign_requester') {
    const key = await saveDataUrlImage(env, body.signature, 'signatures');
    if (!key) return badRequest('缺少請款人簽名');
    await env.DB.prepare('UPDATE ledger_expenses SET requester_signature_key=?, requester_signed_at=? WHERE id=?')
      .bind(key, nowISO(), row.id).run();
    return json({ ok: true });
  }

  // 轉帳截圖為選填佐證，非必要（有簽收簽名即可入帳）
  if (action === 'attach_receipt') {
    if (!body.file_key) return badRequest('缺少轉帳截圖');
    await env.DB.prepare('UPDATE ledger_expenses SET receipt_proof_key=? WHERE id=?')
      .bind(body.file_key, row.id).run();
    return json({ ok: true });
  }

  if (action === 'finalize') {
    if (!row.requester_signature_key) return badRequest('需先由請款人簽收');
    if (!row.incharge_signature_key) return badRequest('需先由負責弟兄簽名');

    await env.DB.batch([
      env.DB.prepare("UPDATE ledger_expenses SET status='finalized', finalized_at=? WHERE id=?").bind(nowISO(), row.id),
      env.DB.prepare("UPDATE expense_requests SET status='archived' WHERE id=?").bind(row.request_id)
    ]);
    return json({ ok: true });
  }

  return badRequest('未知的操作');
}
