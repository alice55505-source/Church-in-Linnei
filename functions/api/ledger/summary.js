import { requireTier } from '../../_lib/auth.js';
import { json, unauthorized, badRequest } from '../../_lib/db.js';
import { computeCumulativeBalance } from '../../_lib/balance.js';

export async function onRequestGet({ request, env }) {
  const session = await requireTier(request, env, 'ledger');
  if (!session) return unauthorized();
  const url = new URL(request.url);
  const month = url.searchParams.get('month');
  if (!month) return badRequest('缺少月份');

  const expenses = await env.DB.prepare(`
    SELECT er.*, le.status as ledger_status FROM expense_requests er
    JOIN ledger_expenses le ON le.request_id = er.id
    WHERE er.expense_date LIKE ? ORDER BY er.expense_date
  `).bind(month + '%').all();
  for (const e of expenses.results) {
    const items = await env.DB.prepare('SELECT * FROM expense_items WHERE request_id=? ORDER BY rowid').bind(e.id).all();
    e.items = items.results;
  }

  const outstanding = await env.DB.prepare(
    `SELECT COUNT(*) as c FROM expense_requests WHERE expense_date LIKE ? AND status != 'archived'`
  ).bind(month + '%').first();

  const incomeSessions = await env.DB.prepare('SELECT * FROM income_sessions WHERE session_date LIKE ? ORDER BY session_date').bind(month + '%').all();
  const regular = await env.DB.prepare('SELECT * FROM regular_expense_items WHERE month=? ORDER BY created_at').bind(month).all();
  const recon = await env.DB.prepare('SELECT * FROM monthly_reconciliation WHERE month=?').bind(month).first();

  const allExpensesSettled = outstanding.c === 0;
  const allIncomeArchived = incomeSessions.results.length === 0 ? true : incomeSessions.results.every(s => s.status === 'archived');
  const allRegularConfirmed = regular.results.length === 0 ? true : regular.results.every(r => r.status === 'confirmed');
  const reconciliationDone = !!recon && recon.status === 'confirmed';

  const ready = allExpensesSettled && allIncomeArchived && allRegularConfirmed && reconciliationDone;

  const totalIncome = incomeSessions.results
    .filter(s => s.status === 'archived')
    .reduce((s, r) => s + r.amount_general + r.amount_fulltime + r.amount_taiwan_gospel + r.amount_overseas + r.amount_other, 0);
  const totalExpense = expenses.results.reduce((s, r) => s + r.total_amount, 0) +
    regular.results.filter(r => r.status === 'confirmed').reduce((s, r) => s + r.amount, 0);
  const cumulativeBalance = await computeCumulativeBalance(env, month);

  return json({
    month,
    ready,
    reasons: { allExpensesSettled, allIncomeArchived, allRegularConfirmed, reconciliationDone },
    expenses: expenses.results,
    incomeSessions: incomeSessions.results,
    regular: regular.results,
    reconciliation: recon,
    totals: { totalIncome, totalExpense, cumulativeBalance }
  });
}
