-- 月結報表線上簽名（出納／會計／負責弟兄），取代原本支出記帳、經常費支出逐筆簽名，
-- 簽名後直接嵌入列印的 PDF，不用印出來再手簽
CREATE TABLE IF NOT EXISTS statement_signatures (
  month TEXT PRIMARY KEY,
  cashier_signature_key TEXT,
  cashier_signed_at TEXT,
  accountant_signature_key TEXT,
  accountant_signed_at TEXT,
  incharge_signature_key TEXT,
  incharge_signed_at TEXT,
  created_at TEXT NOT NULL
);
