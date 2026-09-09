-- PWA 推播訂閱與提醒紀錄

ALTER TABLE personal_offerings ADD COLUMN created_at TEXT;
UPDATE personal_offerings SET created_at = (
  SELECT created_at FROM income_sessions WHERE income_sessions.id = personal_offerings.session_id
) WHERE created_at IS NULL;

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id TEXT PRIMARY KEY,
  tier TEXT NOT NULL, -- 'income' | 'ledger'
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  created_at TEXT NOT NULL
);

-- 記錄已發送過的提醒（避免重複提醒），key 例如 regular_start_2026-09、offering_pending_<id>
CREATE TABLE IF NOT EXISTS reminder_log (
  key TEXT PRIMARY KEY,
  sent_at TEXT NOT NULL
);
