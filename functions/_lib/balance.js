// Cumulative balance = 期初餘額（系統上線前既有結餘） + 已歸檔奉獻收入 − 已入帳支出 − 已確認經常費支出，
// 期初餘額之後（as_of_date 之後）的收支才計入，避免與期初餘額重複計算
export async function computeCumulativeBalance(env, throughMonth) {
  const endBound = throughMonth + '-31';

  const obAmount = await env.DB.prepare("SELECT value FROM settings WHERE key='opening_balance_amount'").first();
  const obAsOf = await env.DB.prepare("SELECT value FROM settings WHERE key='opening_balance_as_of'").first();
  const openingBalance = Number(obAmount && obAmount.value) || 0;
  const asOfDate = (obAsOf && obAsOf.value) || '0000-01-01';
  const asOfMonth = asOfDate.slice(0, 7);

  const incomeRow = await env.DB.prepare(
    `SELECT COALESCE(SUM(amount_general+amount_fulltime+amount_taiwan_gospel+amount_overseas+amount_other),0) as total
     FROM income_sessions WHERE status='archived' AND session_date <= ? AND session_date > ?`
  ).bind(endBound, asOfDate).first();

  const expenseRow = await env.DB.prepare(
    `SELECT COALESCE(SUM(er.total_amount),0) as total
     FROM ledger_expenses le JOIN expense_requests er ON er.id = le.request_id
     WHERE le.status='finalized' AND er.expense_date <= ? AND er.expense_date > ?`
  ).bind(endBound, asOfDate).first();

  const regularRow = await env.DB.prepare(
    `SELECT COALESCE(SUM(amount),0) as total FROM regular_expense_items WHERE status='confirmed' AND month <= ? AND month > ?`
  ).bind(throughMonth, asOfMonth).first();

  const base = throughMonth >= asOfMonth ? openingBalance : 0;
  return base + (incomeRow.total || 0) - (expenseRow.total || 0) - (regularRow.total || 0);
}
