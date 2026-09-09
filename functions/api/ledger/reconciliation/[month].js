import { requireTier } from '../../../_lib/auth.js';
import { nowISO, json, badRequest, unauthorized, saveDataUrlImage } from '../../../_lib/db.js';

const ROLE_FIELD = {
  cashier: ['cashier_signature_key', 'cashier_signed_at'],
  accountant: ['accountant_signature_key', 'accountant_signed_at'],
  incharge: ['incharge_signature_key', 'incharge_signed_at']
};

export async function onRequestPatch({ request, env, params }) {
  const session = await requireTier(request, env, 'ledger');
  if (!session) return unauthorized();
  const body = await request.json().catch(() => ({}));
  const row = await env.DB.prepare('SELECT * FROM monthly_reconciliation WHERE month=?').bind(params.month).first();
  if (!row) return json({ error: '找不到，請先上傳存簿/網銀照片' }, 404);
  if (row.status === 'confirmed') return badRequest('本月已完成結算');

  if (body.action === 'sign' && ROLE_FIELD[body.role]) {
    const key = await saveDataUrlImage(env, body.signature, 'signatures');
    if (!key) return badRequest('缺少簽名');
    const [colKey, colAt] = ROLE_FIELD[body.role];
    await env.DB.prepare(`UPDATE monthly_reconciliation SET ${colKey}=?, ${colAt}=? WHERE month=?`).bind(key, nowISO(), row.month).run();
    return json({ ok: true });
  }

  if (body.action === 'confirm') {
    const fresh = await env.DB.prepare('SELECT * FROM monthly_reconciliation WHERE month=?').bind(row.month).first();
    if (!fresh.cashier_signature_key || !fresh.accountant_signature_key || !fresh.incharge_signature_key) {
      return badRequest('需出納、會計、負責弟兄皆簽名後才能完成');
    }
    await env.DB.prepare("UPDATE monthly_reconciliation SET status='confirmed' WHERE month=?").bind(row.month).run();
    return json({ ok: true });
  }

  return badRequest('未知的操作');
}
