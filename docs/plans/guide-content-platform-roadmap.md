# Guide Content Platform Roadmap

> 狀態：durable roadmap；本文件只記錄內容平台的產品方向、證據與分期，不是 CMS 設計文件。
>
> Validation owner：orchestrator。下方 validation log 僅記錄已提供的驗證結果；未標示通過的項目不可視為已驗證。

## 1. 產品原則

1. **先證據、後敘事。** 每個可查數值、路線、條件、掉落、技能效果與攻略步驟都要能回指資料來源；無法回指時寫成未知、推測或待測，不補猜測。
2. **資料與編輯分離。** database 是可查資料的基礎；official、field-test、community 是補充或交叉驗證，不把社群說法偽裝成官方事實。
3. **以玩家任務為單位。** 優先完成「查到一筆資料 → 理解條件 → 可採取下一步」的垂直切片，而不是先建全站分類或大量頁面。
4. **保留不確定性。** 同一內容可同時保留多個版本、來源與信心狀態；衝突時列出差異，不以單一答案掩蓋證據缺口。
5. **可讀、可引用、可更新。** 內容要有穩定 URL、明確標題、更新日期、來源標記與適當的 entity link；資料更新後能定位受影響內容。
6. **繁體中文優先。** 使用者可見文字使用繁體中文，技術名詞保留 English；遊戲原文、專有名詞與引用內容不得任意改寫成失真的同義詞。
7. **手機情境優先。** 玩家多半在遊戲中以手機查詢；步驟、表格、地圖與條件必須先在小螢幕可讀，再擴展到桌面。
8. **不把呈現誤稱為驗證。** UI 顯示 database row 不等於實機測試；演算法通過 unit test 不等於遊戲規則已被證實。
9. **最小可行範圍。** 先做能被玩家使用且可維護的內容；不在本 roadmap 內設計 CMS、workflow、權限、editorial backend 或泛用內容管理架構。

## 2. 現有能力與 file:line 證據

以下是 repository 中目前可直接觀察到的能力；這些是程式結構或既有文件的證據，不是對完整 coverage 的宣稱。

| 能力 | 證據 | 邊界／尚未證明 |
|---|---|---|
| SQLite read-only access | `src/lib/db.ts:7-17` 使用 `better-sqlite3`、`readonly: true`、`fileMustExist: true` | Phase 2–5 已執行 targeted read-only probes；不代表完成 whole-DB exhaustive audit |
| 道具查詢與詳情 | `src/app/items/page.tsx`、`src/app/items/[id]/page.tsx`；既有 Phase 1 plan `docs/plans/phase1.md:258-300` | 未在本輪逐頁執行驗證 |
| 怪物與掉落 query | `src/lib/queries/monsters.ts:238-281`、`src/components/monsters/monster-drop-table.tsx:41-117`；以含 `itemId=0` 空槽的 `totalWeight` 作資料權重分母 | 可顯示換算百分比，但必須標示為資料表權重換算，不是官方掉落承諾 |
| 技能 query、分組、level | `src/lib/queries/magic.ts:31-137` | `clan`、技能效果語意與實際遊戲表現仍需來源核對 |
| 任務、步驟、物品、地圖/NPC refs | `src/lib/queries/missions.ts:46-173` | ref 不等於完整攻略路線；條件與觸發語意可能仍需 field-test |
| 地圖圖片與 NPC placement | `src/lib/queries/maps.ts:14-79`，含 `rawX/rawY` 與 `in_bounds=1` 的處理說明 | 現有 query 是展示 placement；不代表 NPC 移動路徑或時間表已知 |
| 地圖與任務頁 | `src/app/maps/page.tsx`、`src/app/maps/[id]/page.tsx`、`src/app/missions/page.tsx`、`src/app/missions/[id]/page.tsx` | 未確認每張地圖、每個任務的資料完整度 |
| 裝備 ranking / compare | `src/app/ranking/page.tsx`、`src/app/compare/page.tsx`、`src/lib/scoring/` | score 是產品計算模型，不等於官方強度或最佳解 |
| 解謎 solver | `src/lib/solvers/forest-matrix.ts`、`seven-star.ts`、`god-quest.ts` 與 `src/lib/solvers/__tests__/` | 未於本輪重跑 tests；solver correctness 與現場規則仍需分開記錄 |
| 成就、商店、合成、覺醒、changelog | `src/app/achievements/page.tsx`、`src/app/shops/page.tsx`、`src/app/compounds/page.tsx`、`src/lib/awakening-cost.ts`、`src/app/changelog/page.tsx` | 功能存在不代表已形成 editorial guide 或完整資料盤點 |
| 既有測試資產 | `src/lib/**/__tests__`，例如 `src/lib/queries/__tests__/schema-smoke.test.ts` | 本輪未執行測試，結果不可宣稱 |

### 不可從現有 repo 推導的事項

巴哈主題索引已完成盤點，代表 URL 見 §6.2；這些 URL 是需求索引／社群線索，不是現行遊戲真值。仍不可僅由 repo 或巴哈索引推導 DB coverage、官方規則、field-test 結果或 community 共識；各項內容仍須依四級來源與版本風險逐項核對。

## 3. 來源四級與著作權邊界

### 3.1 Source ladder

| 等級 | 定義 | 使用規則 | 顯示方式 |
|---|---|---|---|
| **database** | `tthol.sqlite` 與 repository 可追溯 query/schema | 適合 entity、欄位、關聯、原始數值；不得把缺欄位補成不存在 | `資料庫：table/field；查詢日期／版本待補` |
| **official** | 遊戲官方公告、官方說明、官方規則或可核實的官方素材 | 適合版本變更、規則與正式名稱；要保存原始 URL 與擷取日期 | `官方：title / URL / accessed date` |
| **field-test** | 可重現的實機操作、版本、角色條件、觀察結果 | 必須記錄環境、步驟、結果與限制；單次觀察不可泛化 | `實測：版本／條件／日期／結果` |
| **community** | 巴哈、攻略站、玩家回報、討論串 | 作為線索或交叉證據；標作者、URL、日期與是否已交叉驗證 | `社群：作者／平台／URL／日期` |

優先級不是「高級來源永遠正確」：database 可有未解碼欄位，community 可指出 database 漏掉的實機條件；內容應並列來源與衝突，而非只留下結論。

### 3.2 著作權與引用邊界

- 只保存必要的 factual data、短引文、名稱、數值、條件與來源 metadata；不複製整篇攻略、圖片、表格或長段落。
- 對 official/community 內容以自己的繁體中文摘要與步驟重述為主，短引文只在必要時使用並附 attribution、URL、日期。
- 不重新託管未獲授權的圖片、地圖、角色立繪或玩家附件；使用現有授權、官方允許的外部 URL 或明確可用素材，否則只提供連結與文字描述。
- 不移除作者、平台、版權聲明或來源上下文；社群內容不能因改寫而看似 Genbu 原創事實。
- `database` 的欄位值可作為查詢呈現，但衍生文案、排序、計算與攻略整理仍是本專案內容，需標示方法與限制。
- 發現權利不明、要求下架、來源失效或內容可能侵權時，先停止發佈並記錄待處理事項；不以「玩家都知道」作為授權理由。

## 4. Editorial checklist

每一篇 guide 或重要 entity 說明在發布前逐項確認：

- [ ] 標題、slug、摘要與目標玩家問題清楚，繁體中文與遊戲專有名詞一致。
- [ ] 每個 factual claim 都標記 source level；有 URL、table/field、版本、作者或實測條件者已保存。
- [ ] database 數值已確認欄位語意；未知欄位、缺失值與 placeholder 沒有被補猜。
- [ ] official、field-test、community 之間的衝突已列出；結論強度與證據一致。
- [ ] 步驟可重現：前置、觸發 NPC／地圖、條件、順序、失敗分支、獎勵與例外均分開寫。
- [ ] 掉落率、機率、傷害、分數未在沒有權威分母或公式時誤寫成百分比／保證值。
- [ ] entity link、ID、地圖、任務、道具、怪物與技能的引用已逐一核對；不存在的 entity 明確標示。
- [ ] 內容沒有複製受版權保護的長文、圖片或玩家附件；引用長度與 attribution 合理。
- [ ] 手機閱讀、表格溢出、空資料、404、圖片缺失與 loading/error 狀態已設計或明確 deferred。
- [ ] `last verified`、適用版本、owner、下一次 review trigger 已填寫。
- [ ] reviewer 以原始來源抽查至少一個正例與一個邊界例；沒有執行就標「尚未執行」。

## 5. Phase roadmap

共同 gate：每個 Phase 都必須有 source ledger、內容範例、negative/unknown case、可重跑的 validation note；designer gate 不是「看起來漂亮」，而是確認資訊階層、來源可見性、手機可用性與不確定性呈現。

### Phase 0 — 資料契約＋首篇垂直切片（Completed / merged PR #24）

- **目標／項目：** 定義 entity、claim、source、版本、confidence、last verified 與 conflict 的最小資料契約；選一篇代表性 guide，以 database 單一來源級走完 research → editorial → page → validation，並保留後續接入其他來源級的欄位。
- **交付狀態：** 已完成並 merged：guide contract、guide hub、guide detail、navigation、首篇 guide。PR：[ #24 ](https://github.com/hanshino/genbu/pull/24)。
- **優先級：** P0。
- **依賴：** 現有 read-only DB/query、既有 route/component；不依賴 CMS。
- **退出條件：** 契約能描述「已知、未知、衝突、待驗證」；首篇內容完成 checklist；可由 URL 找回所有引用；reviewer 能重現一個步驟。
- **驗證方式：** schema/type review、source ledger audit、首篇手動 walkthrough；mobile/browser manual smoke 不在已宣稱的驗證內。
- **designer gate：** 本 Phase 不設內容 designer gate；待進入 UI lane 時，首篇的來源 badge、步驟層級、警告與 unknown state 須經 designer review，且不可把 raw DB table 直接當成 guide。

### Phase 1 — 資料驅動怪物／裝備／任務迷宮（Completed / merged PR #25）

- **目標／項目：** 以既有 entities 組成可交叉連結的內容：怪物 stats/drop、裝備屬性/比較、任務步驟/物品/地圖/NPC refs、迷宮與解謎提示；先做資料驅動頁，再補 editorial explanation。
- **交付狀態：** 已完成並 merged：三篇 database guide（monster、equipment、mission）。PR：[ #25 ](https://github.com/hanshino/genbu/pull/25)。
- **優先級：** P0（核心查詢）／P1（長文攻略）。
- **依賴：** Phase 0 contract；`src/lib/queries/monsters.ts`、`missions.ts`、`magic.ts`、items/maps routes；既有 solver 可作工具但不得代替實測。
- **退出條件：** 一個怪物→掉落道具→相關任務、一個任務→NPC/地圖→道具的完整 link path 可用；空值、未知 rate、缺圖均有明確呈現；首批 guide 通過 checklist。
- **驗證方式：** DB query fixture/schema smoke、雙向 link spot check、source-to-claim audit；browser/mobile manual smoke 不在已宣稱的驗證內。
- **designer gate：** 玩家能區分「資料庫欄位」「攻略步驟」「玩家推測」；長表格與迷宮步驟在手機不阻塞主要任務。

### Phase 2 — 地圖與 NPC 資料導覽（Completed）；移動路線 Deferred

- **目標／項目：** 在地圖上呈現 NPC placement，逐步補充移動路徑、定時／條件出現、任務相關位置與「常駐／移動／未知」狀態；每個移動 claim 必須有 field-test 或可核實來源。
- **交付狀態：** 已完成並 merged：maps-npc-navigation。地圖與 NPC 資料導覽已交付；完整 NPC 移動路線 deferred。PR：[ #26 ](https://github.com/hanshino/genbu/pull/26)。
- **優先級：** P1。
- **依賴：** Phase 0 source contract、Phase 1 map/NPC links；`src/lib/queries/maps.ts:32-79` 的 placement 只足以支援位置展示，不足以推出移動。
- **退出條件：** 至少一個可重現 NPC route 具版本、起點、終點、觸發條件與觀察時間；無 route evidence 的 NPC 不顯示假路徑。
- **驗證方式：** map overlay/navigation implementation validation、來源抽查；完整路線與 browser/mobile manual smoke deferred。
- **designer gate：** route、point、時間與條件有不同視覺語意；地圖不可遮住 NPC 名稱與主要任務線索。

### Phase 3 — 職業技能／經脈／星曜（Completed / merged PR #27）

- **目標／項目：** 技能按職業／派系／level／target／效果查詢；整理經脈與星曜的解鎖、前置、消耗、加成與 build guide。只有 database 有欄位或其他來源已核實才發佈數值。
- **交付狀態：** 已完成並 merged：skills-data-guide。經脈、星曜、真解與 build deferred。PR：[ #27 ](https://github.com/hanshino/genbu/pull/27)。
- **優先級：** P1。
- **依賴：** Phase 0 contract；`src/lib/queries/magic.ts:31-137` 的技能分組與 level；經脈／星曜、真解與 build 的證據仍不足。
- **退出條件：** 技能 level、職業與來源可追溯；經脈／星曜若資料不足則以 evidence gap 發佈，不製造完整樹狀圖；至少一篇 build guide 有實測或明確 disclaimer。
- **驗證方式：** `(id,name,level)` uniqueness/spot check、技能效果來源核對；field-test build replay deferred。
- **designer gate：** 複雜效果以可掃讀欄位呈現；資料值、推導值、玩家建議分層，避免把 ranking 當唯一正解。

### Phase 4 — 英雄／寵物（英雄 Completed / merged PR #28；pet Deferred）

- **目標／項目：** 交付英雄 entity、組合資料、detail 與 guide；寵物完成 live audit 後 deferred，不在本 Phase 宣稱完成寵物取得／成長、技能、裝備／飾品或比較內容。
- **交付狀態：** 已完成並 merged：live audit、`/heroes`、hero detail、heroes guide。PR：[ #28 ](https://github.com/hanshino/genbu/pull/28)。Pet deferred。
- **live read-only audit：** hero 84、hero_connect 75、192 refs；無 orphan／duplicate。`ITEM_PET` 940、`PET_ORNAMENT` 68、`magic.pet_id` 34 rows／26 ids 尚未解碼。
- **優先級：** P1。
- **依賴：** Phase 0 contract；現有 item/skill query；英雄 live audit 已完成，寵物資料語意仍待解碼。
- **退出條件：** 至少一條英雄／寵物資料的來源鏈完整；缺少正式欄位的推論有 label；比較公式不宣稱官方 tier。
- **驗證方式：** live read-only DB audit、代表 entity cross-link；pet field-test 與完整寵物語意 deferred。
- **designer gate：** 角色身份、寵物裝備、技能效果與建議玩法不混在同一張未分級表格；手機可比較。

### Phase 5 — Deferred — evidence blocked

- **目標／項目：** 整理家族建立、成員／權限、家族內容、結婚前置、流程、獎勵、限制與解除／例外；將版本差異與玩家實測分開。
- **狀態：** Deferred — evidence blocked。
- **live read-only audit：** `sqlite_master` 無 family/guild/marriage/love table；只有 `magic.clan`／`magic.clan2` columns。`CLASS_GUILD` primary 15 rows／11 skills、`CLASS_LOVE` 60／8、`TARGET_LOVE` 30／6、`CASTLE_ITEM` 15。另有任務／NPC／地圖／成就關鍵字線索，但不足以證明建立、結婚或解除流程。
- **restart gate：** 必須具備 official source、current-version family/marriage/divorce field-test，以及 costs、cooldowns、irreversible outcomes 的可核對證據，才可重新啟動。
- **優先級：** P2。
- **依賴：** Phase 0 contract；official source、current-version field-test 與可追溯 costs/cooldowns/outcomes 證據。
- **退出條件：** 流程每一步有來源或明確 unknown；涉及帳號、付費、社交或不可逆操作的警告已 review；無證據的獎勵與限制不發佈。
- **驗證方式：** restart gate 通過後，才做兩人以上流程重現（若可行）、版本記錄、官方／社群衝突表與 link audit。
- **designer gate：** 前置與不可逆結果突出；敏感社交資訊、玩家名稱與截圖不在未授權範圍內。

### Phase 6 — 條件式平台強化（Conditional / not started）

- **目標／項目：** 只在前述 evidence、流量、維護成本與使用者需求達門檻後，評估搜尋／filter 強化、related guides、版本 diff、個人化比較、離線／PWA 或其他平台能力。此 Phase 是條件式，不是預先承諾的 feature list。
- **狀態：** Conditional / not started。現在 published guides = 6。
- **門檻狀態：** search/filter、CMS、related guides、broken-link automation、freshness automation 均未達門檻。
- **優先級：** P2／conditional。
- **依賴：** Phase 0–5 的內容品質與 telemetry；不得以平台功能掩蓋資料缺口。
- **退出條件：** 有明確需求證據、成功指標、維護 owner、退場方案與 performance/accessibility budget；若沒有，維持現狀。
- **驗證方式：** baseline metrics、small-scope experiment、accessibility/performance smoke、rollback review；尚未開始。
- **designer gate：** 互動增加後仍能看見來源、版本與 unknown；不為了 dashboard 或動畫犧牲查詢路徑。

## 6. 完整內容 inventory

### 6.1 Repository 已可見主題

| 主題群 | 可做內容 | 現有證據／限制 |
|---|---|---|
| 道具與裝備 | item index/detail、屬性、random attributes、掉落來源、ranking、compare、覺醒、合成、商店 | routes `src/app/items/`、`ranking/`、`compare/`、`compounds/`；完整 coverage 未執行 |
| 怪物 | 搜尋、stats、抗性、掉落、道具反查、狩獵 guide | `src/app/monsters/`、`src/lib/queries/monsters.ts`；百分比是含空槽的資料表權重換算，需與官方承諾區分 |
| 技能與職業 | skill list/detail、level、clan/target/type、技能書 | `src/app/skills/`、`src/lib/queries/magic.ts`；經脈／星曜未證明 |
| 任務與迷宮 | 任務群、步驟、NPC/地圖/物品 refs、160/175/180 tools | `src/app/missions/`、`src/app/tools/`、`src/lib/solvers/`；solver 不等於 field-test |
| 地圖與 NPC | 地圖 index/detail、背景圖、placement、任務位置、後續移動 | `src/app/maps/`、`src/lib/queries/maps.ts`；移動證據缺口 |
| 成就與商店 | 成就分類／獎勵、NPC shop sells/buys、道具購買來源 | `src/app/achievements/`、`src/app/shops/`；商店 NPC/地圖關聯未必存在 |
| 英雄／寵物 | entity、成長、技能、飾品、比較、取得 guide | hero audit/entity/detail/guide 已完成：hero 84、hero_connect 75、192 refs，無 orphan／duplicate；pet relation deferred：`ITEM_PET` 940、`PET_ORNAMENT` 68、`magic.pet_id` 34 rows／26 ids 未解碼 |
| 家族／結婚 | 流程、前置、效果、限制、版本差異 | live audit 已完成但 evidence blocked；只有 raw codes／keyword clues，workflow deferred |
| 更新與版本 | DB changelog、內容更新摘要、受影響 guides | `src/app/changelog/`、`src/lib/changelog/`；AI 摘要仍需 editorial review |

### 6.2 巴哈主題群盤點（已完成）

以下為已完成的巴哈（Bahamut）需求索引／社群線索盤點。URL 與主題歸屬已核對；它們不是現行遊戲真值。來源年代、文章內容是否仍適用、thread 可驗證性、版本差異與轉載關係都保留風險，實際 claim 仍須補 source metadata 與交叉驗證。

| 巴哈主題群 | 應盤點的代表內容 | 代表 URL | 狀態 |
|---|---|---|---|
| 根目錄／新手／回鍋／伺服器資訊 | 入口索引、入門、版本、伺服器與回鍋注意事項 | https://forum.gamer.com.tw/G1.php?bsn=6960 | 已完成；需求索引／社群線索 |
| 任務／劇情 | 主線、支線與任務討論 | https://forum.gamer.com.tw/G1.php?bsn=6960&parent=10 | 已完成；需求索引／社群線索 |
| 迷宮／副本 | 160/175/180 與其他迷宮解法 | https://forum.gamer.com.tw/G1.php?bsn=6960&parent=1270 | 已完成；需求索引／社群線索 |
| 迷宮限制 | 迷宮限制與規則補充 | https://forum.gamer.com.tw/G2.php?bsn=6960&parent=1270&sn=4230&lorder=1 | 已完成；需求索引／社群線索 |
| 怪物 | 怪物位置、資料與狩獵討論 | https://forum.gamer.com.tw/G1.php?bsn=6960&parent=1778 | 已完成；需求索引／社群線索 |
| 所有怪物掉落 | 怪物掉落、刷寶與掉率回報 | https://forum.gamer.com.tw/G1.php?bsn=6960&parent=75 | 已完成；需求索引／社群線索 |
| 練功地圖 | 練功區域、等級與路線 | https://forum.gamer.com.tw/G1.php?bsn=6960&parent=1783 | 已完成；需求索引／社群線索 |
| 地圖移動 | 地圖、NPC 位置、移動與出現條件 | https://forum.gamer.com.tw/G1.php?bsn=6960&parent=30 | 已完成；需求索引／社群線索 |
| 職業技能 | 職業選擇、技能與配點 | https://forum.gamer.com.tw/G1.php?bsn=6960&parent=21 | 已完成；需求索引／社群線索 |
| 流派 | 職業流派與 build 討論 | https://forum.gamer.com.tw/G2.php?bsn=6960&parent=21&sn=5413&lorder=3 | 已完成；需求索引／社群線索 |
| 屬性 | 角色與戰鬥屬性 | https://forum.gamer.com.tw/G1.php?bsn=6960&parent=3145 | 已完成；需求索引／社群線索 |
| 物攻公式 | 物攻計算公式與推導 | https://forum.gamer.com.tw/G2.php?bsn=6960&parent=3145&sn=4223&lorder=8 | 已完成；需求索引／社群線索 |
| 英雄／寵物 | 取得、培養、技能、寵物飾品與比較 | https://forum.gamer.com.tw/G1.php?bsn=6960&parent=289 | 已完成；需求索引／社群線索 |
| 裝備 | 裝備推薦、強化、覺醒與合成 | https://forum.gamer.com.tw/G1.php?bsn=6960&parent=2779 | 已完成；需求索引／社群線索 |
| 武防 | 武器、防具與附加屬性 | https://forum.gamer.com.tw/G1.php?bsn=6960&parent=292 | 已完成；需求索引／社群線索 |
| 真元魂石 | 真元、魂石與相關玩法 | https://forum.gamer.com.tw/G1.php?bsn=6960&parent=1768 | 已完成；需求索引／社群線索 |
| 經脈 | 經脈系統、解鎖與配點 | https://forum.gamer.com.tw/G1.php?bsn=6960&parent=5476 | 已完成；需求索引／社群線索 |
| 經脈效果 | 經脈效果與數值討論 | https://forum.gamer.com.tw/G2.php?bsn=6960&parent=5476&sn=5478&lorder=2 | 已完成；需求索引／社群線索 |
| 星曜 | 星曜系統、解鎖與配點 | https://forum.gamer.com.tw/G1.php?bsn=6960&parent=4897 | 已完成；需求索引／社群線索 |
| 星曜機率 | 星曜機率與相關測試 | https://forum.gamer.com.tw/G2.php?bsn=6960&parent=4897&sn=5516&lorder=1 | 已完成；需求索引／社群線索 |

盤點原則：上述盤點已完成；搜尋結果與 parent/G2 索引只作需求索引／社群線索，不作現行遊戲事實。後續仍需讀取 thread 上下文、去重轉載、保存 accessed date，並把可用線索映射到四級來源與 evidence gap。

## 7. Deferred / not-now

- **不做 CMS 設計細節：** 不定義 editor UI、workflow、RBAC、draft schema、發布 pipeline 或內容後台。
- **不宣稱全資料庫覆蓋：** 未完成 schema/row/field audit 前，不寫「完整圖鑑」「全地圖」「全部掉落」。
- **不把 community ranking 當官方 tier：** 可整理不同玩家觀點，但不產生無來源的唯一 tier list。
- **不先做自動生成大量攻略：** 沒有 source ledger、review owner 與反幻覺檢查前，維持人工 editorial vertical slice。
- **不做未證實 NPC 移動、經脈／星曜完整樹、英雄／寵物完整數值、家族／結婚完整規則。** 先補 evidence，再排 Phase。
- **不做未授權素材鏡像、整篇轉載、玩家截圖資料庫。** 權利與授權明確後才評估。
- **不把 SEO、PWA、推薦、通知、個人化帳號、社交功能列為核心完成條件。** 只有 Phase 6 的條件門檻通過才評估。

## 8. 風險與證據缺口

| 風險／缺口 | 影響 | 最小處置 | 狀態 |
|---|---|---|---|
| SQLite schema 與 coverage 仍非全庫盤點 | 可能把 targeted audit 誤解為全 DB 完整覆蓋 | coverage 已依各 Phase 做 targeted audit；仍非 whole-DB exhaustive audit，保留 remaining unknowns | Phase2–5 targeted audits completed／remaining unknowns recorded |
| 欄位語意未解碼 | 數值解讀錯誤，攻略誤導 | 對照 official、LINE bot、field-test；保留 raw value 與 interpretation | known unresolved：`pet_id`、family/marriage workflow、NPC movement、經脈／星曜／真解等 |
| DB、官方、實測、社群版本衝突 | 內容過期或互相矛盾 | 每 claim 保存 version/date/conflict，顯示適用版本 | 未執行 |
| 巴哈資料年代與可驗證性風險 | 舊文、失效 thread、轉載或版本差異可能造成錯誤內容 | 保存 URL/title/author/date/accessed date，將其視為需求索引／社群線索，逐 claim 交叉驗證 | 已完成盤點；內容驗證仍待執行 |
| 資料權重百分比被誤解為官方掉率 | 可能把資料表的權重換算誤寫成遊戲承諾 | 以含 `itemId=0` 空槽的 `totalWeight` 作分母，並明確標示為資料表權重換算 | 已由現行 query/UI 核對 |
| NPC movement 不在 placement data | 假造路線或時間表 | 只顯示已證實 placement；movement 需 field-test | known unresolved；完整路線 deferred |
| 著作權／下架要求 | 法律、信任與維護風險 | 短摘、署名、連結、權利紀錄與移除流程 | 未執行 |
| AI／editorial 摘要幻覺 | 錯誤大規模擴散 | source-grounded draft、checklist、抽樣 review、unknown label | 未執行 |
| 手機可用性與地圖效能 | 玩家無法在遊戲中使用 | 小範圍 mobile/performance smoke；控制圖片與表格成本 | 未執行 |

## 9. Validation log

本節是本次 roadmap 建立的真實紀錄；未執行的項目不能改寫成通過。

| 日期 | 驗證 | 結果 | Owner |
|---|---|---|---|
| 2026-08-13 | roadmap writer 讀取既有 plans、routes、queries、solvers 與 tests，整理 file:line evidence | 已執行；僅作文件 evidence，不代表功能驗證；orchestrator 待核對 | roadmap writer |
| 2026-08-13 | Phase 0 local tests | **415 passed；CI success** | orchestrator |
| 2026-08-13 | Phase 1 tests | **417 passed；CI success** | orchestrator |
| 2026-08-13 | Phase 2 tests | **418 passed；CI success** | orchestrator |
| 2026-08-13 | Phase 3 tests | **419 passed；CI success** | orchestrator |
| 2026-08-13 | Phase 4 tests | **441 passed；CI success** | orchestrator |
| 2026-08-13 | typecheck／build（各批） | **各批通過** | orchestrator |
| 2026-08-13 | lint（各批） | **各批 blocked：既有 ESLint 10.2.1／`react-display-name` compatibility crash；非 code failure** | orchestrator |
| 2026-08-13 | SQLite | **unchanged** | orchestrator |
| 2026-08-13 | 巴哈主題群與代表 URL 盤點 | **已完成；URL 為需求索引／社群線索，不代表現行遊戲真值；內容與版本交叉驗證尚未執行** | roadmap writer；orchestrator 待核對 |
| 2026-08-13 | official／field-test／community 來源交叉驗證 | **尚未執行** | orchestrator |
| 2026-08-13 | browser/mobile/accessibility/performance smoke | **browser/mobile manual smoke 尚未執行** | orchestrator |
| 2026-08-13 | roadmap diff | **已由 orchestrator 核對** | orchestrator |

## 10. Decision log

| 決策 | 理由 | 日期／狀態 |
|---|---|---|
| 以 Phase 0「資料契約＋首篇垂直切片」作為所有後續內容的 gate | 先驗證 evidence-to-page 流程，避免先做大量不可維護內容 | 2026-08-13；已記錄 |
| 採用 database / official / field-test / community 四級來源 | 區分 raw data、正式規則、實機觀察與社群線索，避免來源混淆 | 2026-08-13；已記錄 |
| 不把 placement 推論成 NPC movement | `src/lib/queries/maps.ts:39-41` 只說明座標對齊；移動需要額外證據 | 2026-08-13；已記錄 |
| 掉落率可顯示資料權重換算百分比 | `src/lib/queries/monsters.ts:238-281` 與 `src/components/monsters/monster-drop-table.tsx:41-117` 使用含 `itemId=0` 空槽的 `totalWeight`；仍不得宣稱官方掉落承諾 | 2026-08-13；已記錄 |
| 巴哈盤點採需求索引／社群線索定位 | 已核對代表 URL，但來源年代與可驗證性有風險，不把索引當現行遊戲真值 | 2026-08-13；已記錄 |
| 不在 roadmap 內設計 CMS | 使用者要求只記錄內容平台 roadmap，不擴張成後台架構 | 2026-08-13；已記錄 |
| Phase 6 採條件式 platform enhancement | 先以內容品質、需求與維護證據決定平台投資，避免 speculative work | 2026-08-13；已記錄 |
| Phase 5 deferred | live read-only audit 無 family/guild/marriage/love table，現有 keyword/class constants 不足以證明流程；需 official source + current-version field-test + costs/cooldowns/irreversible outcomes 才 restart | 2026-08-13；已記錄 |
| Phase 6 no-op | published guides = 6；search/filter、CMS、related guides、broken-link/freshness automation 均未達門檻，因此維持 conditional / not started | 2026-08-13；已記錄 |
