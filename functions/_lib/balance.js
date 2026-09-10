// Cumulative balance = 期初餘額（手動填一次，系統上線前既有結餘） + 已歸檔奉獻收入 − 已入帳支出 − 已確認經常費支出。
// 期初餘額只需填一次，之後每個月都會自動累加在內，不用每月重填。
export async function computeCumulativeBalance(env, throughMonth) {
  const endBound = throughMonth + '-31';

  const obAmount = await env.DB.prepare("SELECT value FROM settings WHERE key='opening_balance_amount'").first();
  const openingBalance = Number(obAmount && obAmount.value) || 0;

  const incomeRow = await env.DB.prepare(
    `SELECT COALESCE(SUM(amount_general+amount_fulltime+amount_taiwan_gospel+amount_overseas+amount_other),0) as total
     FROM income_sessions WHERE status='archived' AND session_date <= ?`
  ).bind(endBound).first();

  const expenseRow = await env.DB.prepare(
    `SELECT COALESCE(SUM(er.total_amount),0) as total
     FROM ledger_expenses le JOIN expense_requests er ON er.id = le.request_id
     WHERE le.status='finalized' AND er.expense_date <= ?`
  ).bind(endBound).first();

  const regularRow = await env.DB.prepare(
    `SELECT COALESCE(SUM(amount),0) as total FROM regular_expense_items WHERE status='confirmed' AND month <= ?`
  ).bind(throughMonth).first();

  return openingBalance + (incomeRow.total || 0) - (expenseRow.total || 0) - (regularRow.total || 0);
}
