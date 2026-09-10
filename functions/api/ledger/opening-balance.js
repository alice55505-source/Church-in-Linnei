import { requireTier } from '../../_lib/auth.js';
import { json, unauthorized } from '../../_lib/db.js';

export async function onRequestGet({ request, env }) {
  const session = await requireTier(request, env, 'ledger');
  if (!session) return unauthorized();
  const amountRow = await env.DB.prepare("SELECT value FROM settings WHERE key='opening_balance_amount'").first();
  return json({ amount: Number(amountRow && amountRow.value) || 0 });
}

export async function onRequestPatch({ request, env }) {
  const session = await requireTier(request, env, 'ledger');
  if (!session) return unauthorized();
  const body = await request.json().catch(() => ({}));
  const amount = Number(body.amount) || 0;
  await env.DB.prepare("UPDATE settings SET value=? WHERE key='opening_balance_amount'").bind(String(amount)).run();
  return json({ ok: true });
}
