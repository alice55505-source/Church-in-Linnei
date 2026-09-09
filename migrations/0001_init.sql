-- 林內召會收支記帳 - 初始資料庫結構

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

INSERT OR IGNORE INTO settings (key, value) VALUES
  ('income_password_hash', ''),
  ('income_password_salt', ''),
  ('ledger_password_hash', ''),
  ('ledger_password_salt', '');

-- 最外層（公開）：支出請款
CREATE TABLE IF NOT EXISTS expense_requests (
  id TEXT PRIMARY KEY,
  expense_date TEXT NOT NULL,
  purpose TEXT NOT NULL,
  requester TEXT NOT NULL,
  request_date TEXT NOT NULL,
  total_amount REAL NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'submitted', -- submitted -> booked -> archived
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_expense_requests_date ON expense_requests(expense_date);
CREATE INDEX IF NOT EXISTS idx_expense_requests_status ON expense_requests(status);

CREATE TABLE IF NOT EXISTS expense_items (
  id TEXT PRIMARY KEY,
  request_id TEXT NOT NULL REFERENCES expense_requests(id),
  name TEXT NOT NULL,
  unit_price REAL NOT NULL DEFAULT 0,
  qty REAL NOT NULL DEFAULT 0,
  total REAL NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_expense_items_request ON expense_items(request_id);

-- 中間層（不公開）：奉獻收入，每次開奉獻箱一筆
CREATE TABLE IF NOT EXISTS income_sessions (
  id TEXT PRIMARY KEY,
  session_date TEXT NOT NULL,
  amount_general REAL NOT NULL DEFAULT 0,       -- 為召會經常費用
  amount_fulltime REAL NOT NULL DEFAULT 0,      -- 為全時間供給用
  amount_taiwan_gospel REAL NOT NULL DEFAULT 0, -- 為臺灣福音工作用
  amount_overseas REAL NOT NULL DEFAULT 0,      -- 為海外開展用
  amount_other REAL NOT NULL DEFAULT 0,         -- 其他
  other_note TEXT,
  status TEXT NOT NULL DEFAULT 'draft', -- draft(暫存) -> archived(正式歸檔)
  incharge_signature_key TEXT,
  incharge_signed_at TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_income_sessions_date ON income_sessions(session_date);

CREATE TABLE IF NOT EXISTS personal_offerings (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES income_sessions(id),
  church_name TEXT,
  person_name TEXT NOT NULL,
  bag_count INTEGER NOT NULL DEFAULT 1,
  recipient_signature_key TEXT,
  signed_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_personal_offerings_session ON personal_offerings(session_id);

-- 最內層（不公開）：支出記帳，對應每筆請款
CREATE TABLE IF NOT EXISTS ledger_expenses (
  id TEXT PRIMARY KEY,
  request_id TEXT NOT NULL UNIQUE REFERENCES expense_requests(id),
  booked_by TEXT,
  booked_at TEXT,
  incharge_signature_key TEXT,
  incharge_signed_at TEXT,
  receipt_proof_key TEXT,
  requester_signed_at TEXT,
  status TEXT NOT NULL DEFAULT 'pending', -- pending -> finalized
  finalized_at TEXT
);

-- 最內層：召會經常費支出（按月）
CREATE TABLE IF NOT EXISTS regular_expense_items (
  id TEXT PRIMARY KEY,
  month TEXT NOT NULL, -- YYYY-MM
  name TEXT NOT NULL,
  amount REAL NOT NULL DEFAULT 0,
  note TEXT,
  paid INTEGER NOT NULL DEFAULT 0,
  payment_proof_key TEXT,
  incharge_signature_key TEXT,
  incharge_signed_at TEXT,
  status TEXT NOT NULL DEFAULT 'open', -- open -> confirmed
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_regular_expense_items_month ON regular_expense_items(month);

-- 最內層：每月銀行帳戶對帳
CREATE TABLE IF NOT EXISTS monthly_reconciliation (
  month TEXT PRIMARY KEY, -- YYYY-MM
  bank_statement_key TEXT,
  bank_balance REAL,
  computed_balance REAL,
  cashier_signature_key TEXT,
  cashier_signed_at TEXT,
  accountant_signature_key TEXT,
  accountant_signed_at TEXT,
  incharge_signature_key TEXT,
  incharge_signed_at TEXT,
  status TEXT NOT NULL DEFAULT 'open', -- open -> confirmed
  created_at TEXT NOT NULL,
  updated_at TEXT
);
