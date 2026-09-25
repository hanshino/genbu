# 迷宮攻略撰寫指南

範本：`content/guides/dungeon-mistforest.mdx`（任務 18926 謎霧之森）。新攻略照這篇的結構寫，元件都已經做好，多數時候只需要寫 MDX。

## 流程

每篇依序完成，不要批次趕完：

1. **查資料**（唯讀）：任務、NPC、刷怪座標、地圖圖片、獎勵、寶箱、兌換店。遇到 SQLite 一律唯讀，不修改 `tthol.sqlite`。
2. **釐清玩家實際流程**：地圖通常會拆成好幾座互不相連的島，玩家找 NPC 傳送到下一區。**每次換區就是一個步驟**。使用者的實機體感優先於資料推測，例如謎霧之森的水源區在資料上是一張圖，實際卻分成三步。
3. **先做 mockup 給使用者看**（OpenDesign），核可後才進程式。
4. **寫 MDX**，跑驗證，截圖檢查 1440 和 390 兩種寬度。
5. 使用者確認後再 commit 和開 PR。

## 文章結構

```
frontmatter（category: dungeon, stage: topic）
## 通關可以拿到什麼   ← 先破題：獎勵、寶箱重點、兌換用途
## 進本前先確認       ← 入口、人數、次數、時限、Checklist
<DungeonStep n={1}> … </DungeonStep>   ← 每次換區一步
…
## 資料來源與待核對   ← 待核對清單、社群原文出處（放 <details>）
```

- `category: dungeon` 會讓文章出現在 `/guides` 的「迷宮攻略」區塊，麵包屑也會顯示迷宮攻略。`stage: topic` 讓它不會被串進修行路線的上一篇、下一篇。
- 開頭要先講通關能拿到什麼。寶箱只挑重點，完整機率連到道具頁的「開啟可能獲得」。兌換店用連結 `[名稱](/shops/{id})`，目前沒有 `<Shop>` 元件。

## 步驟元件

```mdx
<DungeonStep n={2} title="污染機關" subtitle="上方區域" stage={1932}
  crop={[150,380,1400,1380]}
  groups={[{ ids:[11034], tag:"高防禦" }, { ids:[11035], tag:"高護勁" }]}
  marks={[{ id:11036, as:"ok" }, { id:7712, as:"npc", label:"葵" }]}>

說明文字……傳送後會在葵附近出現。

<StepMap />
<StepTargets />
<Warning>打法提示</Warning>
<StepDone>完成條件 → 找葵前往下一區。</StepDone>
</DungeonStep>
```

- `stage`：sestage id。`crop` 是原圖的像素範圍 `[x0,y0,x1,y1]`，左上角為原點、Y 往下。整張圖都要看的步驟就不給 `crop`。
- `groups`：步驟要打的怪，會出現在表格並標在地圖上。
  - 數值完全相同的 id 會自動合成一列，不同的會拆成子列，例如 ▲ 菁英版和一般版。
  - `tag` 是給玩家看的短標籤，例如「高防禦」「西北」，用來取代 ID。
  - `as`：
    - `"pin"`：編號圓點，預設值
    - `"dot"`：小點，給大量小怪用
    - `"area"`：在整群的中心畫一個圈
  - `map:false`：只出現在表格，不標在地圖上。例如九房的水晶，地圖上改用房名標記。
- `marks`：地圖上的非怪物標記。
  - `as`：
    - `"npc"`：菱形，給傳送 NPC 用
    - `"device"`：方形，給機關、放碎片處用
    - `"ok"`：勾號，不能點，表示完成指示
    - `"room"`：房名標籤
  - `tbd:true`：角色還沒確認，會畫成虛線，而且不算進缺漏。
- `<StepMap />`：預設只顯示裁切的區塊，可以切換成整張地圖，整張圖上會用框標出本區塊。
- `<StepTargets />`：表格欄位有頭像、名稱、等級、血量、防禦、護勁、要求命中。表格上方會自動產生「本步驟要求命中：＞最大閃躲」。
- `<NineRoomGrid tool="/tools/160">規則清單</NineRoomGrid>`：九宮格類的關卡才用。
- 座標、數值、頭像全部由 `getStepData` 從 DB 取得（`src/lib/guide-steps.server.ts`），**不要在 MDX 手打數值**。
- DB 沒有座標的東西就不要畫，改在文字寫「位置待確認」，例如謎霧之森的大爐。

## 資料怎麼查

- **座標**：`getNpcPositionsForStage`（`src/lib/queries/maps.ts`），來源是 `monster_spawns.x/y` 和 `map_placements.raw_x/raw_y`。**不要用 `tile_y`**，它已經翻轉過一次，詳見 commit `0329979`。
- **區塊邊界**：先用 DB 座標框出範圍，再看地圖圖片目視確認島嶼的邊界，加一點邊距。圖太大的話，先縮圖交給 observer 看。
- **傳送落點**：通常在 NPC 附近。有的 stage 有 `arrival` placement 可以參考，沒有的話就以 NPC 位置為準。
- **戰鬥數值**：`npc.base_dodge`（閃躲）、`extra_def`（防禦）、`magic_def`（護勁）。
- **頭像**：`npc_images`，由 `getNpcImageMap` 查詢。沒有圖的會顯示幽靈圖示，這是正常的。
- **任務獎勵**：`mission_rewards`。同一個道具有兩筆時，要看 `msg_id` 和 `mission_events` 是不是不同的結束對話，**不要直接加總**。
- **寶箱**：多半是 mystery box（`v_item_mystery`），不是 `item_box_rewards`，所以 `<BoxContents>` 會是空的，改連到道具頁。
- **兌換店**：`SELECT * FROM shops WHERE style0 = {貨幣道具 id}`。DB 裡沒有商店和 NPC 的對應資料，NPC 名稱和位置要問使用者。

## 用語規則

- **內文不寫數字 ID**，只寫名稱。ID 只放在 `<Monster>`、`<Item>`、`<Map>`、`<Mission>` 元件的 props 裡。外形 ID 這類參考表放在 `<details>`，測試會跳過這段。
- 同名的怪用特性區分，例如「高防禦的機關」「高護勁的機關」，不要用「1 號、2 號」。
- 遊戲裡沒有「內功」這個說法。防禦高的怪用**內力**角色打，護勁高的怪用**外功**角色打。
- 要求命中寫成 `＞閃躲值`，意思是玩家命中要大於怪物閃躲。不要用社群的概略值取代逐隻列出的數字。
- 社群或解碼資料要標明「社群」或「待驗證」，確定的語氣只留給 DB 查得到的事實。
- 還沒確認的寫「待確認」，不要自己捏造數字或 ID。

## 測試守門（`src/lib/__tests__/guides.test.ts`）

新增文章時：

- 更新文章數量的斷言。
- 目前「內文不能有數字 ID、不能有『內功』」和「每個 DungeonStep 都能從 DB 取到資料」這兩條守門只針對謎霧之森。寫新的迷宮攻略時，把新 slug 加進同一組檢查。
- 會驗證的項目：
  - 內文去掉 JSX 和 `<details>` 後，不能有 4 到 5 位數的數字，年份 20xx 例外。
  - 每個 `DungeonStep` 都要能取到地圖圖片。
  - 每個 group 和每個非 `tbd` 的 mark 至少要有 1 個座標點。
  - `missing` 只能包含標了 `tbd` 的 id。

## 驗證清單

`npx vitest run`、`npm run typecheck`、`npm run lint`、`npm run build` 都要通過，而且 `package-lock.json` 不能有變動（lockfile 不同步會讓正式站 build 失敗，整站掛掉）。之後開 dev server，用 headless Chrome 截 1440 和 390 兩種寬度的整頁截圖，交給 observer 檢查地圖、標記和版面。

注意：正式站的 DB 是 runtime mount，上線前要確認裡面有這篇用到的 stage 地圖圖片和座標，缺資料時頁面只會顯示表格。
