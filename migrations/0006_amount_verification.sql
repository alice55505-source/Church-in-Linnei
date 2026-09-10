-- 金額核對機制：上傳憑證時登記憑證上的金額，系統自動比對登記金額；
-- 不相符時需人工填寫說明才能繼續（finalize / confirm）。

ALTER TABLE expense_requests ADD COLUMN receipt_amount REAL;

ALTER TABLE ledger_expenses ADD COLUMN receipt_amount REAL;
ALTER TABLE ledger_expenses ADD COLUMN amount_override_note TEXT;

ALTER TABLE regular_expense_items ADD COLUMN payment_amount REAL;
ALTER TABLE regular_expense_items ADD COLUMN amount_override_note TEXT;

ALTER TABLE monthly_reconciliation ADD COLUMN amount_override_note TEXT;
