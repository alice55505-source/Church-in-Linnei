import { requireTier } from '../../../_lib/auth.js';
import { nowISO, json, badRequest, unauthorized, saveDataUrlImage } from '../../../_lib/db.js';

const FEE_AMOUNT = 15;

export async function onRequestPatch({ request, env, params }) {
  const session = await requireTier(request, env, 'ledger');
  if (!session) return unauthorized();
  const body = await request.json().catch(() => ({}));
  const row = await env.DB.prepare('SELECT * FROM ledger_expenses WHERE id=?').bind(params.id).first();
  if (!row) return json({ error: '找不到' }, 404);
  if (row.status === 'finalized') return badRequest('已入帳，無法修改');

  const action = body.action;

  // 簽名一旦完成即鎖定，不可重簽或取消，避免財務紀錄被竄改
  // 請款簽收：由請款人本人簽名確認已收到款項，不是上傳照片
  if (action === 'sign_requester') {
    if (row.requester_signature_key) return badRequest('已簽收，無法重簽');
    const key = await saveDataUrlImage(env, body.signature, 'signatures');
    if (!key) return badRequest('缺少請款人簽名');
    await env.DB.prepare('UPDATE ledger_expenses SET requester_signature_key=?, requester_signed_at=? WHERE id=?')
      .bind(key, nowISO(), row.id).run();
    return json({ ok: true });
  }

  // 轉帳手續費由記帳頁決定是否計入，不是請款人自己填
  if (action === 'set_fee') {
    const fee_amount = body.include ? FEE_AMOUNT : 0;
    try {
      await env.DB.prepare('UPDATE ledger_expenses SET fee_amount=? WHERE id=?').bind(fee_amount, row.id).run();
    } catch (e) {
      return badRequest('資料庫尚未支援手續費欄位，請稍後再試');
    }
    return json({ ok: true });
  }

  if (action === 'finalize') {
    if (!row.requester_signature_key) return badRequest('需先由請款人簽收');

    await env.DB.batch([
      env.DB.prepare("UPDATE ledger_expenses SET status='finalized', finalized_at=? WHERE id=?").bind(nowISO(), row.id),
      env.DB.prepare("UPDATE expense_requests SET status='archived' WHERE id=?").bind(row.request_id)
    ]);
    return json({ ok: true });
  }

  return badRequest('未知的操作');
}
