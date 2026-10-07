-- 召會支出也要能計入轉帳手續費，與金額分開記錄
ALTER TABLE regular_expense_items ADD COLUMN fee_amount REAL NOT NULL DEFAULT 0;
