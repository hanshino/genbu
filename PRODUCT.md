# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

武林同萌傳（TTHOL）現役玩家。邊玩邊查：遊戲在 PC 上跑，玩家在桌機第二視窗或手機上查資料，兩種情境同等重要。查的是道具、怪物、掉落、NPC、技能、地圖，或是在配裝、規劃練功、解秘境時需要算一下。

## Product Purpose

玄武（Genbu）是 TTHOL 的非官方資料站，把遊戲資料、流派排行與計算工具整理在一起。成功的樣子：玩家查一件事不用離開本站、不用自己翻表或心算。

## Positioning

- 資料直接取自遊戲用戶端 DB（`tthol.sqlite`），完整且隨改版更新，每版有 changelog；不是人工抄寫的攻略。
- 不只查表，還幫玩家算：屬性模擬、強化、經脈、秘境（160 / 175 / 180）解謎等工具。
- 依流派權重自動排行裝備，可存個人流派（LINE 登入）。

## Operating Context

- 主要區塊：道具、怪物、NPC、技能、地圖、商店、任務、英雄、合成、練功點、成就、排行、比較（最多五件）、攻略、工具、改版紀錄、搜尋。
- 姊妹專案：LINE bot 版 `tthol-line-bot`，功能相近。
- 帳號：LINE 登入（只取 `openid`），玩家資料存在獨立的 `genbu-user.sqlite`。

## Capabilities and Constraints

- Next.js App Router + better-sqlite3，遊戲 DB 唯讀，不可修改。
- UI 一律繁體中文（zh-TW）。
- UI 元件 shadcn-first，圖示用 lucide-react，不用 Unicode 符號或 emoji（見 `CLAUDE.md`）。
- 少用次要標籤與說明文字，讓版面自己說話。

## Brand Commitments

- 名稱：玄武 · Genbu；識別為「玄」字印章（見 `src/app/about/page.tsx`）。
- 非官方，與遊戲廠商無關；公式為個人整理，僅供參考，以遊戲內顯示為準。

## Evidence on Hand

- 遊戲資料：`tthol.sqlite`（items、magic、npc、monsters 等）。
- 改版紀錄：`src/data/changelog/*.json`。
- 裝備圖：`npm run sync:images` 拉到 `public/equipment`。
- 無使用者見證、流量數據或合作方；不可捏造。

## Product Principles

1. 資料準確優先於好看；不確定的數值要標示來源或「僅供參考」。
2. 查得快：桌機第二視窗與手機都要能一眼找到答案。
3. 能算就幫玩家算，不要只丟原始表格。
4. 玩家的語言：用遊戲內術語與繁中，不解釋玩家都懂的東西。
