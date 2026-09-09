# 林內召會收支記帳

Cloudflare Pages + Functions + D1 + R2 建置的三層收支記帳系統。

## 三層架構

1. **最外層／公開**（`/`，`index.html`）：任何人可查詢、提交請款申請（花費日期、用途、品項、請款人、自動請款日期）。不需密碼。
2. **中間層／奉獻收入**（`/income.html`）：每次開奉獻箱記一筆，含五類金額 + 個人奉獻（只記包數不記金額）。暫存 → 負責弟兄簽名 + 各奉獻對象簽收 → 正式歸檔。需「奉獻收入密碼」。
3. **最內層／記帳**（`/ledger.html`）：
   - 支出記帳：待記帳請款單 → 記帳 → 負責弟兄簽名 + 上傳簽收/轉帳截圖 → 確認入帳。
   - 經常費支出：按月，可編輯，每月自動沿用上月項目；上傳轉帳記錄 + 負責弟兄簽名 → 確認完成。
   - 月結對帳：月底上傳存簿/網銀照片，系統算出累計結餘供比對；出納、會計、負責弟兄三方簽名 → 確認完成。
   - 列印報表：當月支出、收入、經常費、對帳皆完成後才能列印（瀏覽器列印為 PDF），含出納/會計/負責弟兄簽名欄。
   需「記帳密碼」，且與奉獻收入密碼不同（記帳密碼可同時查看收入總覽）。

## 部署步驟（Cloudflare Pages，網頁操作，不需指令列）

1. 將此 repo push 到 GitHub。
2. Cloudflare Dashboard → **Workers & Pages** → **建立** → **Pages** → **連接到 Git**，選這個 repo。
3. Build 設定：Build command 留空、Build output directory 填 `/`（repo 根目錄）。
4. 部署後進入該 Pages 專案 → **Settings → Functions → Bindings**，新增：
   - **D1 database binding**：變數名稱 `DB`，選擇資料庫 `linnei-church-accounting-db`
   - **R2 bucket binding**：變數名稱 `FILES`，選擇 bucket `linnei-church-accounting-files`
5. **Settings → Environment variables**，新增 Secret：
   - `SESSION_SECRET`：任意一串隨機長字串（登入 session 簽章用，務必設定，否則使用不安全的預設值）
   - `SETUP_KEY`（選填）：若設定，`/setup.html` 初始化時需輸入此值才能設定密碼，避免被他人搶先設定
6. D1 資料庫結構（資料表）已透過遷移檔 `migrations/0001_init.sql` 建立完成（此 repo 對應的 Cloudflare 帳號已預先執行）。若需在新帳號重新建立，於 D1 資料庫的 **Console** 頁籤貼上該檔案內容執行即可。
7. 部署完成後，開啟 `https://<你的網域>/setup.html`，設定「奉獻收入密碼」與「記帳密碼」（兩者需不同）。此頁僅能使用一次。
8. 之後各層可在登入後使用頁面下方的「變更密碼」功能更換密碼。

## 檔案結構

```
index.html         最外層：公開請款
income.html         中間層：奉獻收入（密碼）
ledger.html          最內層：記帳（密碼）
setup.html            初始設定（僅用一次）
assets/common.js       前端共用函式（API、簽名板、Toast）
functions/api/...        Cloudflare Pages Functions 後端 API
migrations/0001_init.sql  D1 資料庫結構
wrangler.toml             設定參考（D1 / R2 綁定名稱）
```

## 注意事項

- 簽名一律以觸控/滑鼠手寫簽名板產生 PNG，存放於 R2；照片（收據、轉帳截圖、存簿照片）以檔案上傳存放於 R2，皆需登入對應密碼層級才能讀取。
- 累計結餘計算方式：已歸檔奉獻收入（不含個人奉獻包）－ 已入帳支出 － 已確認經常費支出，計算至指定月份月底。
