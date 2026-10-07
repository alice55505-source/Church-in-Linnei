import { requireTier } from '../../../_lib/auth.js';
import { json, badRequest, unauthorized } from '../../../_lib/db.js';

const FEE_AMOUNT = 15;

export async function onRequestPatch({ request, env, params }) {
  const session = await requireTier(request, env, 'ledger');
  if (!session) return unauthorized();
  const body = await request.json().catch(() => ({}));
  const row = await env.DB.prepare('SELECT * FROM regular_expense_items WHERE id=?').bind(params.id).first();
  if (!row) return json({ error: '找不到' }, 404);
  const action = body.action;

  // 已入帳／已確認後仍可補勾手續費（功能上線前已入帳的紀錄需要補登）
  if (action === 'set_fee') {
    const fee_amount = body.include ? FEE_AMOUNT : 0;
    try {
      await env.DB.prepare('UPDATE regular_expense_items SET fee_amount=? WHERE id=?').bind(fee_amount, row.id).run();
    } catch (e) {
      return badRequest('資料庫尚未支援手續費欄位，請稍後再試');
    }
    return json({ ok: true });
  }

  if (row.status === 'confirmed') return badRequest('已確認完成，無法修改');

  // 編輯名稱／金額／週期。改名或改週期時，舊名稱的過去紀錄停止自動延續；
  // 本月之後已自動帶入、尚未處理的舊紀錄刪除，之後會依這筆新設定重新帶入
  if (action === 'update') {
    const name = String(body.name || row.name).trim().slice(0, 200);
    const amount = Number(body.amount) || 0;
    const expense_type = ['monthly', 'yearly', 'onetime'].includes(body.expense_type) ? body.expense_type : (row.expense_type || 'monthly');
    const recur_month = expense_type === 'yearly' ? Number(row.month.slice(5, 7)) : null;
    const stmts = [
      env.DB.prepare('UPDATE regular_expense_items SET name=?, amount=?, note=?, expense_type=?, recur_month=?, active=1 WHERE id=?')
        .bind(name, amount, body.note ?? row.note, expense_type, recur_month, row.id),
      env.DB.prepare(`DELETE FROM regular_expense_items WHERE name=? AND month>? AND status!='confirmed' AND payment_proof_key IS NULL AND id!=?`)
        .bind(row.name, row.month, row.id)
    ];
    if (name !== row.name || expense_type !== row.expense_type) {
      stmts.push(env.DB.prepare('UPDATE regular_expense_items SET active=0 WHERE name=? AND month<?').bind(row.name, row.month));
    }
    await env.DB.batch(stmts);
    return json({ ok: true });
  }

  if (action === 'attach_payment_proof') {
    if (!body.file_key) return badRequest('缺少轉帳記錄相片');
    await env.DB.prepare('UPDATE regular_expense_items SET payment_proof_key=?, paid=1 WHERE id=?')
      .bind(body.file_key, row.id).run();
    return json({ ok: true });
  }

  if (action === 'confirm') {
    if (!row.payment_proof_key) return badRequest('需先上傳轉帳記錄相片');
    await env.DB.prepare("UPDATE regular_expense_items SET status='confirmed' WHERE id=?").bind(row.id).run();
    return json({ ok: true });
  }

  return badRequest('未知的操作');
}

// 刪除此項目：同時刪除同名項目在「本月及之後」尚未確認完成的紀錄（含已自動延續到未來月份的），
// 並將同名項目標記為不再自動延續（active=0），避免之後又被自動帶入下個月/明年；
// 已確認完成的過去月份紀錄不受影響、不會被刪除，但同樣停止繼續延續。
export async function onRequestDelete({ request, env, params }) {
  const session = await requireTier(request, env, 'ledger');
  if (!session) return unauthorized();
  const row = await env.DB.prepare('SELECT * FROM regular_expense_items WHERE id=?').bind(params.id).first();
  if (!row) return json({ error: '找不到' }, 404);
  if (row.status === 'confirmed') return badRequest('已確認完成，無法刪除');
  try {
    await env.DB.batch([
      env.DB.prepare(`DELETE FROM regular_expense_items WHERE name=? AND month>=? AND status!='confirmed'`).bind(row.name, row.month),
      env.DB.prepare(`UPDATE regular_expense_items SET active=0 WHERE name=?`).bind(row.name)
    ]);
  } catch (e) {
    // 資料庫尚未套用 active 欄位的遷移時，退回只刪除、不標記停止延續
    await env.DB.prepare(`DELETE FROM regular_expense_items WHERE name=? AND month>=? AND status!='confirmed'`).bind(row.name, row.month).run();
  }
  return json({ ok: true });
}
