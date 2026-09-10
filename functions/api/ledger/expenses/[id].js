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

  // 會計核對簽名：需由會計本人查看憑證照片與登記金額確認相符後簽名，與負責弟兄簽名分開、獨立審核
  if (action === 'sign_accountant') {
    const key = await saveDataUrlImage(env, body.signature, 'signatures');
    if (!key) return badRequest('缺少會計簽名');
    await env.DB.prepare('UPDATE ledger_expenses SET accountant_signature_key=?, accountant_signed_at=? WHERE id=?')
      .bind(key, nowISO(), row.id).run();
    return json({ ok: true });
  }

  if (action === 'attach_receipt') {
    if (!body.file_key) return badRequest('缺少簽收照片或轉帳截圖');
    await env.DB.prepare('UPDATE ledger_expenses SET receipt_proof_key=?, requester_signed_at=? WHERE id=?')
      .bind(body.file_key, nowISO(), row.id).run();
    return json({ ok: true });
  }

  if (action === 'finalize') {
    if (!row.receipt_proof_key) return badRequest('需先上傳請款人簽收照片或轉帳截圖');
    if (!row.accountant_signature_key) return badRequest('需先由會計核對憑證金額並簽名');
    if (!row.incharge_signature_key) return badRequest('需先由負責弟兄簽名');

    await env.DB.batch([
      env.DB.prepare("UPDATE ledger_expenses SET status='finalized', finalized_at=? WHERE id=?").bind(nowISO(), row.id),
      env.DB.prepare("UPDATE expense_requests SET status='archived' WHERE id=?").bind(row.request_id)
    ]);
    return json({ ok: true });
  }

  return badRequest('未知的操作');
}
