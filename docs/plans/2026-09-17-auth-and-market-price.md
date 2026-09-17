# 玩家回報市價 + 登入機制

> 狀態：設計討論已完成，尚未實作。
> 本文件同時是「登入機制」新 session 的交接 prompt。
> 建立於 2026-09-17。

---

## 這份文件要解決什麼

想在物品頁顯示**玩家回報的市價**。這需要三件現在都不存在的能力：可寫入的資料庫、登入、以及玩家自訂暱稱。

討論過程中發現這些能力有依賴關係，不能一次做完，因此拆成三個階段。**第一階段（登入）請開新 session 處理**，本文件是它的交接說明。

---

## 為什麼要拆

玩家對隱私敏感。用 LINE 登入只是為了確保是真人，但**不能把 LINE 暱稱直接暴露在回報列表上**。

解法是登入當下就給一個不含 LINE 身分的預設暱稱「英雄」，配上 `sub` 末五碼當辨識碼。隱私要求當場滿足，所以**設暱稱不是市價的前置條件** — 玩家想改名再去改，不改也能用。

「個人頁面」（我的回報、我投過的票、刪除帳號）同樣不是前置條件，那些是登入之後的加值功能。

所以切法是：

| 階段 | 範圍 | 是否 block 市價 |
|---|---|---|
| **1. 登入** | writable DB、LINE OAuth、session cookie、預設暱稱、`/me` 改暱稱 | **是** |
| **2. 市價** | 回報表單、參考價計算、投票、台幣匯率設定 | — |
| **3. `/me` 擴充** | 我的回報列表、我投過的票、刪除帳號 | 否 |

階段 1 就開 `/me`，但只放暱稱編輯。階段 3 往上長其他區塊，不另開 `/profile`。

---

## 現況盤點（已查證，附 file:line）

### 這不是靜態網站

- `next.config.ts:4` → `output: "standalone"`（不是 `output: "export"`）
- `Dockerfile:37` → `CMD ["node", "server.js"]`

每個 request 都是真的 Node server 在跑，可以寫入資料庫。單一容器（`docker-compose.yml` 只有一個 service），沒有多實例寫入衝突 — 這正是 SQLite 最適合的場景。

### 現有 DB 層

`src/lib/db.ts:9-12`

```ts
new Database(path.join(process.cwd(), "tthol.sqlite"), {
  readonly: true,
  fileMustExist: true,
});
```

- 路徑寫死，沒走 env
- `readonly: true`
- 用 `globalThis._db` 做 singleton（避開 HMR 重複連線）
- `docker-compose.yml:10-11` 掛載：`/home/hanshino/data/tthol.sqlite:/app/tthol.sqlite:ro`
- `Dockerfile:16` 特地在 build 後刪掉 image 內的 sqlite，強制 runtime 由外部掛入

**不要解除這個 readonly。** 遊戲資料是手動更新的靜態檔，玩家資料是另一個生命週期，混在一起備份和更新都會痛。用第二個 sqlite 檔。

### 現有 API 層

- `src/app/**/route.ts` → **查無**，一個 route handler 都沒有
- Server Action → **查無**

所以階段 1 會是這個專案第一個 mutation layer，沒有既有慣例可循。建議用 Route Handler（不是 Server Action），因為之後 rate limit、驗證、錯誤處理比較好掛。

### 相依套件

`package.json:18-51` — Next 16.2.11、React 19.2.8、better-sqlite3 ^13.0.1。

- ORM → **查無**
- auth 套件 → **查無**
- mysql / pg driver → **查無**

### 環境變數慣例

全專案 `process.env` 只出現在 `scripts/db-changelog.ts:120,267`（`ANTHROPIC_API_KEY`）。

- 沒有 `.env` 檔
- `docker-compose.yml` 沒有 `env_file`
- `Dockerfile` 只設 `NODE_ENV`、`PORT`

**階段 1 需要建立這個慣例**（LINE channel id / secret / session 簽章金鑰）。

### 主題與配色

`src/app/globals.css:52-86` 是**武俠古風亮色**主題：

```css
--background  oklch(0.975 0.008 85)   /* 宣紙 aged paper */
--foreground  oklch(0.22 0.015 260)   /* 墨 cool ink */
--card        oklch(0.985 0.006 85)
--primary     oklch(0.52 0.17 27)     /* 朱砂 cinnabar */
--border      oklch(0.88 0.012 85)    /* brush line */
--radius      0.625rem
```

字體分工（`globals.css:10-13, 132-136`）：`--font-sans-tc` 內文、`--font-serif-tc` 給 h1–h3。

`.dark` block 存在於 `globals.css:88-120`，**但站上永遠不會套用** — 全專案查無 `next-themes` 或任何 ThemeProvider，沒有東西會加上 `.dark` class。只有少數元件（如 `src/components/ranking/preset-chips.tsx:63`）寫了 `dark:` variant 備著。

**新 UI 一律以亮色宣紙主題為準，重點色用朱砂 `--primary`。**

### 遊戲名詞

- 幣制稱「**銀兩**」（`src/lib/format/achievement.ts:6`、`src/lib/constants/field-labels.ts:44-45`）
- 商店另有「金幣」，是商店計價幣別（`src/lib/constants/shop.ts:38-40`），與玩家交易無關
- 物品主鍵是 `items.id`（`src/lib/queries/items.ts:180-186`）
- 伺服器 / 分流概念在 genbu 和 tthol-line-bot 都 **查無**，下列名稱由使用者提供

---

## 定案的設計決策

### 不抽離成獨立後端

用 Next.js Route Handler，跟前端同一個 process。

抽離的成本是多一個 service、多一套部署、CORS、跨服務 token 傳遞、兩邊 schema 同步；換來的好處目前一個都用不到（沒有第二個 consumer、沒有擴展壓力）。

要抽離的時機是 `tthol-line-bot` 也要吃同一份市價資料 — 那時把 route handler 開放成公開 API 即可，不用現在先蓋。

### 不用 next-auth / auth.js

LINE OAuth 只在**登入那一次**用到：拿 `id_token` 解出身分，然後把 LINE token 丟掉，之後永不再呼叫 LINE API。

session 用**自簽 HMAC cookie**（`crypto.createHmac`，Node 內建），效期 90 天由我們自己定，跟 LINE token 效期無關。

### 不做 sessions 表

cookie 內容是 `{ sub, exp }` + HMAC 簽章。不需要 session 儲存，省掉一張表、每個 request 一次 DB 查詢、以及過期清理排程。

**取捨**：無法伺服器端強制登出某人。但封鎖需求是「不讓某個 `sub` 再發價格」，那在寫入時擋就好，不是靠殺 session。所以這個取捨在本場景是零成本。

### 完全不拿 LINE 的暱稱和頭像

scope 只要 `openid`，不要 `profile`。我們只需要 `sub`，`name` / `picture` 連拿都不用拿。

這對隱私敏感的玩家是最乾淨的立場：資料庫裡沒有他的 LINE 名字，而且 LINE 的同意畫面上也少一項授權。

代價：沒有頭像。列表識別用暱稱 + 辨識碼（見下）。

### 預設暱稱「英雄」+ 辨識碼

首次登入**不跳設定畫面**，直接建 row：

```
nickname = '英雄'
```

顯示時一律是 `英雄#a3f2c` 的形式，辨識碼是 `sub` 末五碼，**不存 DB，顯示時從 `sub` 取**。

- 隱私要求當場滿足（`英雄#a3f2c` 不含任何 LINE 身分）
- 撞名由辨識碼解決，不必擋暱稱重複
- 玩家想改名去 `/me`，不改也能正常用市價功能

辨識碼取自 `sub`（`U` + 32 碼 hex）末五碼，16^5 ≈ 100 萬組，反推不出完整 `sub`。

### 暱稱規則

1–20 字，去頭尾空白。**不擋重複、不擋敏感字**。撞名有辨識碼分辨，敏感詞庫是永遠維護不完的東西，真的出事再說。

---

## 資料模型

第二個 sqlite 檔，建議 `/home/hanshino/data/genbu-user.sqlite`，掛成**可寫**。

```sql
CREATE TABLE users (
  sub        TEXT PRIMARY KEY,   -- LINE id_token 的 sub
  nickname   TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE price_reports (
  id         INTEGER PRIMARY KEY,
  item_id    INTEGER NOT NULL,   -- 對應 tthol.sqlite 的 items.id
  server     TEXT NOT NULL,      -- 'fish' | 'flower'
  currency   TEXT NOT NULL,      -- 'silver' | 'official' | 'twd'
  amount     INTEGER NOT NULL,
  author_sub TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE votes (
  report_id INTEGER NOT NULL,
  voter_sub TEXT NOT NULL,
  value     INTEGER NOT NULL,    -- +1 | -1
  PRIMARY KEY (report_id, voter_sub)
);
```

`price_reports` **不存 `author_name` 快照**，顯示時 join `users`。這樣玩家改暱稱，歷史回報一起變，不會有舊名殘留。

### 部署要處理的事

1. `docker-compose.yml` 新增一個可寫 bind mount — **掛目錄，不是單一檔案**

   ```yaml
   volumes:
     - /home/hanshino/data/tthol.sqlite:/app/tthol.sqlite:ro   # 現有
     - /home/hanshino/data/genbu:/app/data                     # 新增，可寫目錄
   ```

   現有的 tthol.sqlite 是唯讀所以可以 bind-mount 單檔，但可寫的 SQLite 開 WAL 後會在**同目錄**產生 `-wal` / `-shm` 兩個檔。bind-mount 單檔時 container 建不出那兩個檔，會直接寫入失敗。

2. container 內是非 root user `nextjs`（uid 1001，`Dockerfile:24-25, 34`），host 端要先 `chown 1001:1001 /home/hanshino/data/genbu`
3. 新增 env 慣例（見下）
4. 建表：第一次連線時 `CREATE TABLE IF NOT EXISTS`，不需要 migration 框架

### 需要的環境變數

```
LINE_CHANNEL_ID
LINE_CHANNEL_SECRET
SESSION_SECRET          # HMAC 簽章用
GENBU_USER_DB_PATH      # 預設 /app/data/genbu-user.sqlite
```

`SESSION_SECRET` 缺少時要在**模組載入時 throw**，不要等到有人登入才炸。`createHmac(alg, undefined)` 的錯誤會出現在第一個玩家臉上，而不是在容器啟動時。

---

## 伺服器與幣別

### 伺服器（固定兩個）

| 內部值 | 正式名 | 舊名 / 玩家借代 |
|---|---|---|
| `fish` | 莫愁谷 | 小魚兒 |
| `flower` | 飛雁山莊 | 花無缺 |

UI 上兩伺服器的價格**完全分開**，不混在一起算。

### 幣別（三種）

| 內部值 | 顯示 | 換算 |
|---|---|---|
| `silver` | 銀兩 | ×1（基準） |
| `official` | 官幣 | ×1,000,000，**遊戲內固定匯率** |
| `twd` | 台幣 | 玩家自設，存 localStorage |

關鍵洞察：**官幣和銀兩是同一條軸**，1 官幣 = 100 萬銀兩是遊戲內固定匯率，只是顯示單位不同。真正浮動的只有台幣（現金交易）。

因此 **DB 只存原始數字 + 幣別，不存換算後的值**。台幣匯率是每個玩家自己的認知而且會變，存進 DB 馬上過期。換算全部在 client 做。

---

## 參考價計算

```
近 30 天 + net_votes >= 0 的回報 → 正規化成銀兩 → 取中位數
```

用**中位數不是平均**，一筆離譜價不會把結果歪掉。

個別回報列表依 `net_votes DESC, created_at DESC` 排序。

**不做**時間衰減、Wilson score、使用者信譽分數。等真的有人刷票再加。

### 台幣報價的處理（已定案）

玩家**還沒設台幣匯率**時：

- 台幣報價**排除在中位數之外**
- 顯示一行克制的提示：「另有 N 筆現金報價未納入計算」＋「設定台幣匯率」行動點
- 主數字切到台幣但未設匯率時顯示 `—`，**不要推估數字**

這是刻意的：寧可空著也不要給假的參考價。同時這是引導玩家設定匯率的自然時機。

---

## LINE Login 事實（已查證官方文件）

### 效期 — 「一天過期」不存在

| 項目 | 官方效期 |
|---|---|
| authorization code | 10 分鐘，僅能用一次 |
| access token | 30 天 |
| refresh token | 90 天 |

官方文件**查無**任何「一天」的設定。既然登入後不再呼叫 LINE API，這些效期跟我們的 90 天 cookie 完全無關。

### 端點

| 用途 | Method | URL |
|---|---|---|
| 授權 | GET redirect | `https://access.line.me/oauth2/v2.1/authorize` |
| 換 token | POST | `https://api.line.me/oauth2/v2.1/token` |
| 驗 id_token | POST | `https://api.line.me/oauth2/v2.1/verify` |

token 與 verify 兩個 endpoint 都要求 `Content-Type: application/x-www-form-urlencoded`，**不是 JSON**。

### scope 只用 `openid`

`openid` 就有 `sub`，而 `sub` 是我們唯一需要的東西。**完全不用打 profile API 或 userinfo API**。

- 只給 `openid` → 有 `sub`，沒有 `name` / `picture`（正是我們要的）
- 加 `profile` → 會多拿到 `name` / `picture`，但我們用預設暱稱「英雄」，拿了也沒地方放，還讓同意畫面多一項授權
- 只給 `profile` 不給 `openid` → 拿不到 `id_token`，不可行

### 驗簽用官方 verify endpoint

web login 的 `id_token` 是 **HS256**（用 channel secret 簽），**不是 ES256，所以沒有 JWKS 這回事**。

官方有現成的 `POST /oauth2/v2.1/verify`，丟 `id_token` + `client_id` 進去，它回驗證過的 payload。連 HMAC 驗證都不用自己寫。

（JWKS endpoint `https://api.line.me/oauth2/v2.1/certs` 是給 native app / LIFF 的 ES256 用的，不適用。）

### `sub` 的穩定性

- **同一個 provider 下**跨 channel 一致（所以未來 tthol-line-bot 用同一個 provider 的話，user ID 可以對得起來）
- **不同 provider 下**是不同值，無法對應同一人
- channel 建立後**不能搬到另一個 provider**

→ 建 channel 的對話框裡 provider 那欄可以當場新建一個 provider，選既有的那個就好，不要手滑建新的。

### 安全參數

- `state` — **必要**，防 CSRF。每次登入產生不同的隨機值，callback 要比對。官方註明**不可**是 URL-encoded string
- `nonce` — 官方標為選用，但既然我們用 id_token 建立身分，**應該帶**。帶了之後 verify 時一併送去比對
- PKCE — LINE 支援（只支援 `S256`），但**不做**。PKCE 防的是 public client 的 authorization code 被攔截，我們是 confidential client（channel secret 在 server 端），這個攻擊面不存在。省掉 code_verifier 的產生、存放與傳遞

`state` / `nonce` 存在一個短效 httpOnly cookie（10 分鐘，跟 authorization code 同壽命），不需要 server 端儲存。

**順便把 `returnTo` 放進同一個 cookie** — 玩家是在物品頁按的登入，回來就該在物品頁。三個值一個 JSON cookie，不用多開。

### 踩雷點

- **callback URL 比對很嚴格** — 必須跟 Console 登記的完全一致（或僅多 query string），且 token 交換時要**再送一次同樣的值**
- localhost 能否當 callback，官方文件**查無**明確允許或禁止。建議開發時用 Tailscale 或 tunnel 給個 https domain，免得本機能動線上不能動
- channel 新建時是 **Developing** 狀態，只有 Admin / Tester 能登入，要切成 **Published** 一般玩家才能用

---

## 階段 1（登入）的交付範圍

這是新 session 要做的事。

### 必做

1. **writable sqlite 連線層** — 新檔案，不要動 `src/lib/db.ts` 的 readonly 連線。同樣用 singleton 避開 HMR。三個跟 readonly 連線不同的參數：

   ```ts
   new Database(process.env.GENBU_USER_DB_PATH!, { fileMustExist: false })
   db.pragma("journal_mode = WAL");
   ```

   `fileMustExist: false` 讓第一次啟動能自己建檔。`src/lib/db.ts:13-15` 的註解說明 readonly 連線不能設 journal_mode，那條限制不適用於這個連線，WAL 要開。
2. **建表** — `users` 表（`price_reports` / `votes` 留給階段 2）
3. **LINE OAuth route handlers**
   - 發起授權（產 `state` / `nonce`，寫短效 cookie，redirect 到 LINE）
   - callback（比對 `state`、換 token、verify `id_token`、取 `sub`）
4. **session cookie** — `crypto.createHmac` 簽 `{ sub, exp }`，httpOnly / secure / sameSite=lax，90 天
5. **首次登入自動建 user** — callback 後若 `users` 沒有這個 `sub`，直接 insert `nickname = '英雄'`，**不跳設定畫面**，依 `returnTo` 導回原頁
6. **`/me` 頁** — 只放暱稱編輯（1–20 字，去頭尾空白）。header 使用者選單放一個連到 `/me` 的入口
7. **顯示用的 `英雄#末五碼`** — 一個從 `sub` 取末五碼的小工具，供 header 與之後的回報列表共用
8. **登出**
9. **env 慣例** — `.env.example` + `docker-compose.yml` 的 env 設定
10. **部署調整** — 可寫 volume + `nextjs` user 權限

### 不做

- `/me` 的其他區塊（我的回報、我投過的票）— 留給階段 3
- `price_reports` / `votes` 表與任何市價相關 UI
- 頭像（scope 根本不拿 picture）
- 首次登入的暱稱設定畫面（用預設值，想改自己去 `/me`）
- 暱稱重複檢查、敏感字過濾
- 帳號刪除（留給階段 3）
- 任何 auth 套件
- PKCE（見上，confidential client 用不到）
- rate limit（階段 1 只有登入和改暱稱，等階段 2 的寫入端再說）

### 驗證方式

至少要能手動跑通：登入 → 直接回到原頁且顯示「英雄#末五碼」→ 關瀏覽器重開仍是登入狀態 → 去 `/me` 改暱稱 → 登出。

簽章驗證的邏輯（cookie 被竄改要拒絕、過期要拒絕）留一個最小的 assert 測試。

---

## Mockup 現況

OD 專案 `genbu-market-price-e3ac` 有一版市價區塊的 mockup，**但配色整個做錯了** — 做成深色 neutral + 玉青色重點，與實際的武俠古風亮色主題不符（見上面「主題與配色」）。

互動邏輯和資訊架構可以參考，視覺部分要整個重做。重做時要注意：

- 亮色宣紙底，重點色用朱砂 `--primary`
- **不要**做 light/dark 切換，站上沒有這個功能
- 圖示一律 lucide，不要 Unicode 符號或 emoji（見 `CLAUDE.md` 的 shadcn-first 規範）
- 列表、下拉、chip 這些都有 shadcn / base-ui 對應元件，不要手刻

市價 mockup 重做建議排在階段 1 完成後、階段 2 開始前。

---

## 未決事項

階段 1 沒有未決事項，可以直接開工。以下都是**階段 2 / mockup 重做時**才需要在實際排版裡判斷的：

1. **回報列表的識別視覺** — 已定案用 `英雄#a3f2c` 文字，但要不要再加首字色塊（類似 Gmail / Notion）交給設計端看排版決定
2. **「最近的回報」要不要限制筆數 + 展開**
3. **參考價的視覺份量** — mockup 用 40px，實際主題下要重新判斷

---

## 給新 session 的起手式

```
讀 docs/plans/2026-09-17-auth-and-market-price.md，
實作其中「階段 1（登入）的交付範圍」。

注意：
- 站上只有亮色武俠古風主題，沒有 dark mode 切換
- 不要裝任何 auth 套件
- 不要動 src/lib/db.ts 的 readonly 連線
- LINE scope 只要 openid，不拿 name / picture
- 首次登入不跳設定畫面，預設暱稱「英雄」+ sub 末五碼辨識碼
```
