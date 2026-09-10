-- 請款簽收改為請款人本人數位簽名，不再只是上傳照片
ALTER TABLE ledger_expenses ADD COLUMN requester_signature_key TEXT;
