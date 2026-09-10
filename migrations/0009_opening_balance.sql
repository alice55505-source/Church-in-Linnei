-- 期初餘額：系統上線前既有的結餘，供累計結餘計算使用
INSERT OR IGNORE INTO settings (key, value) VALUES
  ('opening_balance_amount', '0'),
  ('opening_balance_as_of', '');
