import { requireTier } from '../../_lib/auth.js';
import { json, badRequest, unauthorized } from '../../_lib/db.js';

export async function onRequestGet({ request, env }) {
  const session = await requireTier(request, env, 'ledger');
  if (!session) return unauthorized();
  const amountRow = await env.DB.prepare("SELECT value FROM settings WHERE key='opening_balance_amount'").first();
  const asOfRow = await env.DB.prepare("SELECT value FROM settings WHERE key='opening_balance_as_of'").first();
  return json({
    amount: Number(amountRow && amountRow.value) || 0,
    as_of_date: (asOfRow && asOfRow.value) || ''
  });
}

export async function onRequestPatch({ request, env }) {
  const session = await requireTier(request, env, 'ledger');
  if (!session) return unauthorized();
  const body = await request.json().catch(() => ({}));
  if (!body.as_of_date) return badRequest('請填寫期初餘額的計算基準日');
  const amount = Number(body.amount) || 0;
  await env.DB.batch([
    env.DB.prepare("UPDATE settings SET value=? WHERE key='opening_balance_amount'").bind(String(amount)),
    env.DB.prepare("UPDATE settings SET value=? WHERE key='opening_balance_as_of'").bind(body.as_of_date)
  ]);
  return json({ ok: true });
}
