# 林內召會收支記帳

Cloudflare Pages + Functions + D1 + R2 建置的三層收支記帳系統。

## 三層架構

1. **最外層／公開**（`/`，`index.html`）：任何人可查詢、提交請款申請（花費日期、用途、品項、請款人、自動請款日期）。不需密碼。
2. **中間層／奉獻**（`/income.html`）：每次開奉獻箱記一筆，含五類金額 + 個人奉獻（只記包數不記金額）。暫存 → 負責弟兄簽名 + 各奉獻對象簽收 → 正式歸檔。用密碼登入（預設 `2016`）。
3. **最內層／記帳**（`/ledger.html`）：
   - 支出記帳：待記帳請款單 → 記帳 → 負責弟兄簽名 + 上傳簽收/轉帳截圖 → 確認入帳。
   - 經常費支出：按月，可編輯，每月自動沿用上月項目；上傳轉帳記錄 + 負責弟兄簽名 → 確認完成。
   - 月結對帳：月底上傳存簿/網銀照片，系統算出累計結餘供比對；出納、會計、負責弟兄三方簽名 → 確認完成。
   - 列印報表：當月支出、收入、經常費、對帳皆完成後才能列印（瀏覽器列印為 PDF），含出納/會計/負責弟兄簽名欄。
   用 **Google 帳號登入**（不是密碼），只有白名單內的信箱能登入，登入後可同時查看奉獻總覽。
4. **管理頁**（`/admin.html`）：同樣用 Google 帳號登入，登入後可直接重設奉獻密碼（不需要知道原密碼），忘記密碼時使用。

## 部署步驟（Cloudflare Pages，網頁操作，不需指令列）

1. 將此 repo push 到 GitHub。
2. Cloudflare Dashboard → **Workers & Pages** → **建立** → **Pages** → **連接到 Git**，選這個 repo。
3. Build 設定：Build command 留空、Build output directory 填 `/`（repo 根目錄）。
4. 部署後進入該 Pages 專案 → **Settings → Functions → Bindings**，新增：
   - **D1 database binding**：變數名稱 `DB`，選擇資料庫 `linnei-church-accounting-db`
   - **R2 bucket binding**：變數名稱 `FILES`，選擇 bucket `linnei-church-accounting-files`
5. **Settings → Environment variables**，新增 Secret：
   - `SESSION_SECRET`：任意一串隨機長字串（登入 session 簽章用，務必設定，否則使用不安全的預設值）
   - `GOOGLE_CLIENT_ID`、`ADMIN_EMAILS`：記帳／管理頁 Google 登入用，見下方「Google 登入設定」
   - `VAPID_PUBLIC_KEY`、`VAPID_PRIVATE_JWK`、`VAPID_SUBJECT`：推播提醒通知用，見下方「提醒通知設定」
6. D1 資料庫結構已透過 `migrations/` 內各檔案建立完成（此 repo 對應的 Cloudflare 帳號已預先執行）。若需在新帳號重新建立，依檔名順序於 D1 資料庫的 **Console** 頁籤貼上各檔案內容執行即可。
7. 奉獻密碼預設為 `2016`，登入後可在頁面下方「變更密碼」功能自行更換；若忘記密碼，改用 Google 帳號登入 `/admin.html` 重設。

## Google 登入設定（記帳／管理頁）

記帳與管理頁不使用密碼，改用「使用 Google 帳號登入」按鈕，只有白名單信箱能登入：

1. 前往 [Google Cloud Console](https://console.cloud.google.com/) → 建立（或選擇既有）專案。
2. **APIs & Services → OAuth consent screen**：設定一次即可（User type 選 External，填基本資訊）。
3. **APIs & Services → Credentials → Create Credentials → OAuth client ID**：
   - Application type 選 **Web application**
   - **Authorized JavaScript origins** 填你的網域，例如 `https://church-in-linnei.pages.dev`（正式網域也要加）
   - 建立後複製得到的 **Client ID**（長得像 `xxxxxxxx.apps.googleusercontent.com`）
4. 回 Cloudflare Pages **Settings → Environment variables**，新增 Secret：
   - `GOOGLE_CLIENT_ID`：貼上剛剛的 Client ID
   - `ADMIN_EMAILS`：允許登入的 Google 信箱，多個用逗號分隔，例如 `alice55505@gmail.com`
5. 設定完成後重新部署一次，`/ledger.html`、`/admin.html` 就會顯示「使用 Google 帳號登入」按鈕。

## PWA（可安裝成 App）

- 手機瀏覽器開啟網站後，選單中選「加入主畫面／安裝應用程式」即可像 App 一樣使用。
- 已加入 `manifest.webmanifest` 與 `sw.js`（Service Worker，提供離線快取與推播通知），無需額外設定即可安裝。

## 提醒通知設定（Web Push）

由於 Cloudflare Pages 不支援排程（Cron），系統改為：**每次已登入的人開啟「奉獻收入」或「記帳」頁面時，自動檢查一次**是否有到期的提醒，若有則發送推播通知給所有已啟用通知的裝置（每個提醒週期只會發送一次，不會重複騷擾）。因此只要記帳同工大致每天都會開啟一次 App，提醒就會準時送達；若很多天都沒有人開啟 App，提醒會延後到下次有人開啟時才發出。

提醒規則：
- 每月 1-5 日：若本月「召會經常費支出」尚未全部確認完成 → 提醒記帳同工
- 每月 15-17 日：若仍未完成 → 再次提醒
- 每月最後 3 天：若本月「月結對帳」尚未完成 → 提醒上傳存簿／網銀照片
- 個人奉獻包簽收超過 7 天未完成 → 提醒奉獻收入同工
- 請款單超過 14 天未完成入帳 → 提醒記帳同工

設定步驟：
1. 本機（此 repo 建置時）已產生一組 VAPID 金鑰，請在 Cloudflare Pages **Settings → Environment variables** 新增以下三個 **Secret**（值請向建置者索取，或依下方指令自行產生新的一組）：
   - `VAPID_PUBLIC_KEY`
   - `VAPID_PRIVATE_JWK`
   - `VAPID_SUBJECT`：填 `mailto:你的信箱`
2. 若要自行產生新的 VAPID 金鑰（Node.js 環境）：
   ```js
   const crypto = require('crypto');
   const b64url = b => b.toString('base64').replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
   const { publicKey, privateKey } = crypto.generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
   const jwkPriv = privateKey.export({ format: 'jwk' });
   const jwkPub = publicKey.export({ format: 'jwk' });
   const raw = Buffer.concat([Buffer.from([4]), Buffer.from(jwkPub.x,'base64url'), Buffer.from(jwkPub.y,'base64url')]);
   console.log('VAPID_PUBLIC_KEY=' + b64url(raw));
   console.log('VAPID_PRIVATE_JWK=' + JSON.stringify(jwkPriv));
   ```
3. 設定完成後，記帳同工於「奉獻」或「記帳」頁登入後，點「啟用提醒通知」按鈕並允許瀏覽器通知權限即可。

## 檔案結構

```
index.html          最外層：公開請款
income.html          中間層：奉獻（密碼，預設 2016）
ledger.html           最內層：記帳（Google 帳號登入）
admin.html             管理頁：重設奉獻密碼（Google 帳號登入）
manifest.webmanifest    PWA 安裝設定
sw.js                    Service Worker（離線快取、推播通知）
assets/common.js          前端共用函式（API、簽名板、Toast、推播訂閱）
assets/icons/               App 圖示
functions/api/...              Cloudflare Pages Functions 後端 API
functions/_lib/google.js         Google ID Token 驗證
functions/_lib/push.js           VAPID Web Push 發送
functions/_lib/reminders.js       提醒規則檢查
migrations/                        D1 資料庫結構（依序執行）
wrangler.toml                       設定參考（D1 / R2 綁定名稱）
```

## 注意事項

- 簽名一律以觸控/滑鼠手寫簽名板產生 PNG，存放於 R2；照片（收據、轉帳截圖、存簿照片）以檔案上傳存放於 R2，皆需登入對應密碼層級才能讀取。
- 累計結餘計算方式：已歸檔奉獻收入（不含個人奉獻包）－ 已入帳支出 － 已確認經常費支出，計算至指定月份月底。
