-- 請款申請可附上發票／收據照片（公開層，請款人上傳，不需登入）
CREATE TABLE IF NOT EXISTS expense_request_receipts (
  id TEXT PRIMARY KEY,
  request_id TEXT NOT NULL REFERENCES expense_requests(id),
  file_key TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_expense_request_receipts_request ON expense_request_receipts(request_id);
