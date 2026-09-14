-- 奉獻款入帳憑證，取代「負責弟兄簽名」作為歸檔前置條件
ALTER TABLE income_sessions ADD COLUMN deposit_proof_key TEXT;
