import { requireTier, requireIncomeLogin } from '../../_lib/auth.js';
import { json } from '../../_lib/db.js';

export async function onRequestGet({ request, env }) {
  const ledger = !!(await requireTier(request, env, 'ledger'));
  const income = !!(await requireIncomeLogin(request, env));
  // income：是否有奉獻密碼登入（奉獻頁用）；ledger：是否有記帳 Google 登入（記帳頁用）
  return json({ tier: ledger ? 'ledger' : income ? 'income' : null, ledger, income });
}
