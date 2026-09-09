// Cumulative balance = 已歸檔奉獻收入 − 已入帳支出 − 已確認經常費支出，計算至指定月份月底為止
export async function computeCumulativeBalance(env, throughMonth) {
  const endBound = throughMonth + '-31';

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

  return (incomeRow.total || 0) - (expenseRow.total || 0) - (regularRow.total || 0);
}
