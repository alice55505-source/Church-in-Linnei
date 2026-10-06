-- 經常費支出改為「召會支出」，分三種週期：每月固定／每年固定／一次性
ALTER TABLE regular_expense_items ADD COLUMN expense_type TEXT NOT NULL DEFAULT 'monthly';
ALTER TABLE regular_expense_items ADD COLUMN recur_month INTEGER;
ALTER TABLE regular_expense_items ADD COLUMN active INTEGER NOT NULL DEFAULT 1;
