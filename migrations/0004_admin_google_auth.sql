-- 奉獻（中間層）密碼固定預設為 2016；記帳（最內層）改用 Google 帳號登入，不再使用密碼。
UPDATE settings SET value = '3e8ea1bd-b376-4ca6-ba95-d16a19f2de89' WHERE key = 'income_password_salt';
UPDATE settings SET value = 'c5542368af2648cee87f212aed6a24e1db711b137c2927add09aa4a23378c5a4' WHERE key = 'income_password_hash';
