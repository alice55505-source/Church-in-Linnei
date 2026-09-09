import { requireTier } from '../../_lib/auth.js';
import { json } from '../../_lib/db.js';

export async function onRequestGet({ request, env }) {
  const ledgerSession = await requireTier(request, env, 'ledger');
  if (ledgerSession) return json({ tier: 'ledger' });
  const incomeSession = await requireTier(request, env, 'income');
  if (incomeSession) return json({ tier: 'income' });
  return json({ tier: null });
}
