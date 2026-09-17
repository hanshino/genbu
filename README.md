# 玄武 · Genbu

武林同萌傳（TTHOL）玩家用的非官方資料站，把裝備資料和流派排行整理在一起。

## 查裝備

用名稱搜，或依類型 / 等級翻。點進單件看得到屬性條、各流派下的分位、隨機附加屬性與觸發率、掉落怪物來源。

## 看排行

座騎、背飾各自依流派自動排名。內建幾套常見流派（純力攻、內外兼修、根骨醫毒之類），也可以自己拉權重存成個人流派。通用裝和專精流派裝會分開標示。

## 比裝備

最多五件同時比，格狀矩陣看差異，每個屬性最高的一欄會自動亮起。

## 還沒做

- 技能與怪物查詢
- 秘境解謎工具（160 / 175 / 180）

## 姐妹專案

LINE bot 版本：[tthol-line-bot](https://github.com/hanshino/tthol-line-bot)

## 關於資料

資料抓自遊戲公開資訊加上玩家社群整理，不保證跟得上每次改版。本站跟遊戲廠商沒任何關係。

## 自己跑一份

```bash
npm install
npm run sync:images   # 從 Google Sheet 抓裝備圖到 public/equipment
npm run dev
```

裝備圖沒進 repo，第一次 clone 要先跑 `sync:images` 才看得到圖。之後遊戲出新裝再跑一次就更新。

### LINE 登入後端設定

- 依 `.env.example` 設定 `LINE_CHANNEL_ID`、`LINE_CHANNEL_SECRET`、`SESSION_SECRET`、`GENBU_USER_DB_PATH`。本機 Next.js 可使用 `.env.local`；Compose 可使用主機的環境變數或 `.env`。
- `SESSION_SECRET` 用 `openssl rand -hex 32` 產生；模組載入時必填，`npm run build` 也需要提供。CI build 可使用一次性的測試金鑰，runtime 必須另外注入正式金鑰，不要將正式金鑰烘進 image。更換金鑰會讓既有登入失效。
- LINE Console 登記 `https://你的網域/api/auth/line/callback`，並將 channel 設為 Published 才能開放一般玩家。授權只要求 `openid`，不取得 LINE 暱稱或頭像。
- Cookie 一律 `Secure` / `HttpOnly` / `SameSite=Lax`，使用 `__Host-` 前綴；本機完整登入請使用 HTTPS tunnel。反向代理須保留外部 `Host`、覆寫 `X-Forwarded-Proto`，且不可讓不受信任的流量繞過代理；這兩個值用來還原 callback 與檢查 mutation 的 `Origin`。
- 玩家資料預設在 `/app/data/genbu-user.sqlite`，首次連線只建立 `users`。主機先建立 `/home/hanshino/data/genbu` 並執行 `sudo chown 1001:1001 /home/hanshino/data/genbu`。請備份整個玩家資料庫（含 WAL 狀態），不要覆蓋唯讀的 `tthol.sqlite`。
- 現有 Dockerfile 未注入 build-time env；單設 Compose `environment` 只影響 runtime，不足以供 image build 使用。部署 pipeline 需要另外提供 build-time `SESSION_SECRET`；Dockerfile / CI 調整不在此次後端 lane 的寫入範圍。另勿將含正式金鑰的 `.env*` 放進目前的 Docker build context。

API：`GET /api/auth/line?returnTo=/站內路徑` 發起登入、`GET /api/auth/line/callback` 完成登入，首次暱稱為「英雄」；`POST /api/auth/logout` 登出；`PATCH /api/me` 接受 `{ "nickname": "新暱稱" }`，成功回 200，失敗回 400 與繁中 `{ "error": "…" }`。兩個 mutation 需同源 `Origin` header，瀏覽器同源 POST/PATCH 會自動提供。暱稱 trim 後以 JavaScript UTF-16 `.length` 檢查 1–20 字。

最小 assert 檢查（不呼叫 LINE、不寫入資料庫）：

```bash
SESSION_SECRET=local-assert-only node --import tsx src/lib/auth/session-token.check.ts
```

涵蓋正常簽章、payload / 簽章竄改、到期邊界與過期拒絕，以及站外 `returnTo` 拒絕。實際 LINE 登入仍需有效 channel 設定，以 HTTPS 手動驗證登入 → 回原頁 → 重開瀏覽器 → 改暱稱 → 登出。
