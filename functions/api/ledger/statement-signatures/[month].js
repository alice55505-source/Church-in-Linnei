import { requireTier } from '../../../_lib/auth.js';
import { nowISO, json, badRequest, unauthorized, saveDataUrlImage } from '../../../_lib/db.js';

const ROLE_FIELD = {
  cashier: ['cashier_signature_key', 'cashier_signed_at'],
  accountant: ['accountant_signature_key', 'accountant_signed_at'],
  incharge: ['incharge_signature_key', 'incharge_signed_at']
};

export async function onRequestGet({ request, env, params }) {
  const session = await requireTier(request, env, 'ledger');
  if (!session) return unauthorized();
  const row = await env.DB.prepare('SELECT * FROM statement_signatures WHERE month=?').bind(params.month).first();
  return json({ record: row || null });
}

// 簽名一旦完成即鎖定，不可重簽或取消，避免財務紀錄被竄改
export async function onRequestPatch({ request, env, params }) {
  const session = await requireTier(request, env, 'ledger');
  if (!session) return unauthorized();
  const body = await request.json().catch(() => ({}));
  if (!ROLE_FIELD[body.role]) return badRequest('未知的簽名角色');

  let row = await env.DB.prepare('SELECT * FROM statement_signatures WHERE month=?').bind(params.month).first();
  if (!row) {
    await env.DB.prepare('INSERT INTO statement_signatures (month, created_at) VALUES (?,?)').bind(params.month, nowISO()).run();
    row = { month: params.month };
  }

  const [colKey] = ROLE_FIELD[body.role];
  if (row[colKey]) return badRequest('已簽名，無法重簽');

  const key = await saveDataUrlImage(env, body.signature, 'signatures');
  if (!key) return badRequest('缺少簽名');
  const [k, at] = ROLE_FIELD[body.role];
  await env.DB.prepare(`UPDATE statement_signatures SET ${k}=?, ${at}=? WHERE month=?`).bind(key, nowISO(), params.month).run();
  return json({ ok: true });
}
