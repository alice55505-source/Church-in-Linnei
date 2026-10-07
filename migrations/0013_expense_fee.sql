-- 轉帳手續費：由記帳頁決定（不是請款人填），與品項金額分開記錄，避免出帳金額混淆
ALTER TABLE ledger_expenses ADD COLUMN fee_amount REAL NOT NULL DEFAULT 0;
