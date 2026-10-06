-- 請款單手續費（轉帳手續費等），與品項金額分開記錄，避免出帳金額混淆
ALTER TABLE expense_requests ADD COLUMN fee_amount REAL NOT NULL DEFAULT 0;
