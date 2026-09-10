-- 支出記帳、經常費支出改為需要「會計」獨立核對簽名（不同於負責弟兄），
-- 取代先前由填單人自行輸入金額比對的方式（自己審自己，無實質審核意義）。

ALTER TABLE ledger_expenses ADD COLUMN accountant_signature_key TEXT;
ALTER TABLE ledger_expenses ADD COLUMN accountant_signed_at TEXT;

ALTER TABLE regular_expense_items ADD COLUMN accountant_signature_key TEXT;
ALTER TABLE regular_expense_items ADD COLUMN accountant_signed_at TEXT;
