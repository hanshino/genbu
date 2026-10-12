# market.db（市集擺攤掃描）讀取說明

來源是兄弟專案 `tthol-headless`：探子角色定時走進市集，逐一打開每個攤位，記下攤位上賣的東西和單價，存進本機的 `local/market.db`。這份文件說明那個檔案的結構，以及 genbu 要怎麼讀。

權威定義在 tthol-headless 的這幾個地方，欄位有變動時以那邊為準：

- schema：`backend/src/tthol/store/models.py`（`MarketScan` / `MarketStall` / `MarketItem`）
- migration：`backend/src/tthol/store/migrations_market/`（Alembic，表上有 `alembic_version`）
- 寫入與查詢：`backend/src/tthol/store/db.py` 的 `save_market_scan`、`market_listings`、`market_item_prices`
- 單一商品欄位怎麼解出來：`backend/src/tthol/actions/market.py` 的 `describe()`
- 設計決策：`docs/adr/0007-store-wal-and-market-db.md`

## 資料模型

一次**掃描**（scan）是某個時間點整個市集的快照。每次掃描底下有多個**攤位**（stall），攤位底下有多筆**商品**（item）。

### `market_scans`：一次掃描

| 欄位 | 型別 | 說明 |
|---|---|---|
| `id` | int PK | 遞增 |
| `character` | text | 執行掃描的角色名。**是機密，genbu 絕不能讀或顯示** |
| `stage` | int | 地圖 id，目前都是 `173`（市集） |
| `started` / `ended` | real | Unix 秒（UTC，有小數）。一次掃描大約 3 分鐘 |
| `status` | text | `done` / `stopped` / `error`。只用 `done` 和 `stopped` |
| `stalls` / `items` | int | 這次掃描開了幾個攤位、總共幾筆商品 |
| `note` | text | 備註，通常是 null |

### `market_stalls`：攤位

PK 是 `(scan_id, owner)`。

| 欄位 | 說明 |
|---|---|
| `owner` | 攤主的 10 bytes key，以 hex 表示。同一個攤主在不同掃描之間會一樣，可以用來追同一攤 |
| `sign` | 招牌文字，玩家自己寫的，例如「缺錢 便宜賣」 |
| `result` | `ok`（有讀到）、`empty`、`no_reply`（沒回應，沒有商品）、`partial` |
| `count` | 攤位上的商品數 |

### `market_items`：商品

索引是 `item_id` 和 `scan_id`。

| 欄位 | 說明 |
|---|---|
| `scan_id`、`owner` | 對回 scan 和 stall |
| `item_id` | **就是 `tthol.sqlite` 的物品 id**，可以直接 join `items` |
| `count` | 數量 |
| `price` | **單價**，單位是銀兩（總價 = `price * count`） |
| `strengthen` | 強化等級（+N），0 表示沒強化 |
| `data` | JSON，`describe()` 的完整結果，見下一節 |
| `raw` | 原始封包的 hex，只拿來除錯，genbu 不用讀 |

### `data` JSON

```json
{"item_id": 20095, "name": "幻羽刀", "count": 1, "price": 3000000, "strengthen": 7,
 "binds_left": 2, "expansions": 0, "refine_left": 2, "bead": 0, "bead_name": null,
 "stones": [], "stats": {"外功": 2}, "zhenjie": null, "custom_name": "幻羽刀",
 "other_records": [], "mask": "7f7f3f"}
```

| key | 說明 | 對應 genbu 價格回報的欄位 |
|---|---|---|
| `binds_left` | 剩幾次綁定；null 表示不是有綁定次數的物品（例如可堆疊的物品） | `bindLeft` |
| `expansions` | 已擴充次數 | `bindExpand`（語意要再確認） |
| `refine_left` | 剩幾次精煉 | 無 |
| `bead` / `bead_name` | 鑲的珠子物品 id、名稱 | 無 |
| `stones` | 鑲的石頭物品 id 陣列 | 可能對應 `enhance`，未確認 |
| `stats` | 附加屬性，key 是中文屬性名 | 無 |
| `zhenjie` | 真節資料（`m` / `lines` / `minus`），沒有就是 null | 可能對應 `awaken`，未確認 |
| `custom_name` | 物品自訂名稱 | 無 |
| `other_records` | 還沒解出來的屬性紀錄 `[flag, type, value]` | 無 |

標「未確認」的對應，接之前先問 tthol-headless。

## 讀之前要注意

1. **`price = 99999999` 是上限值**。實測約 23% 的商品是這個價（2026-10 的資料：23,203 筆裡有 5,264 筆）。推測是只放著展示或亂喊的價格，算參考價時要排除（推論，未經遊戲端驗證）。
2. **沒有伺服器欄位**。genbu 的價格回報有分 `fish` / `flower`，但 market.db 沒記是哪個伺服器掃的。目前所有掃描來自同一台伺服器；要分伺服器的話，得先在 tthol-headless 加欄位。
3. **同一攤會在每次掃描重複出現**。要算「一個東西賣多少」，只看最近一次掃描，或在一段時間內依 `(owner, item_id, price)` 去重。不要把所有掃描的資料全部加總。
4. **隱私**：`character` 不能讀也不能顯示。`owner` 只拿來去重，不要公開。`sign` 在遊戲裡大家都看得到，要不要顯示由 genbu 自己決定。
5. **WAL 模式**：這個檔案開著 WAL，旁邊會有 `-wal` 和 `-shm`。只複製主檔會漏掉還沒 checkpoint 的資料。要給 genbu 用，請用 SQLite 的 online backup 產生一份一致的快照，例如 `sqlite3 market.db ".backup market-snapshot.db"`，或 Python 的 `sqlite3.Connection.backup`。genbu 用 `better-sqlite3` 以 `{ readonly: true }` 開那份快照。
6. **資料量**：一天大約 20 次掃描，約 5 MB。tthol-headless 目前還沒有保留期限，給 genbu 的快照建議只匯出需要的時間範圍，並拿掉 `raw` 和 `character`。

## 常用查詢

最新一次完成的掃描：

```sql
SELECT id, started FROM market_scans
WHERE status IN ('done', 'stopped')
ORDER BY id DESC LIMIT 1;
```

某個物品在最新一次掃描的所有攤位，由便宜排到貴：

```sql
SELECT i.price, i.count, i.strengthen, s.sign, i.data
FROM market_items i
JOIN market_stalls s ON s.scan_id = i.scan_id AND s.owner = i.owner
WHERE i.scan_id = :latestScanId AND i.item_id = :itemId AND i.price < 99999999
ORDER BY i.price;
```

近 N 天的參考價（每次掃描取最低價，再依天彙總）。`:since` 是 Unix 秒；分日用台灣時間，所以加 8 小時：

```sql
WITH per_scan AS (
  SELECT sc.id, sc.started, MIN(i.price) AS low
  FROM market_items i JOIN market_scans sc ON sc.id = i.scan_id
  WHERE i.item_id = :itemId AND sc.status IN ('done', 'stopped')
    AND sc.started >= :since AND i.price < 99999999 AND i.strengthen = 0
  GROUP BY sc.id
)
SELECT date(started + 8 * 3600, 'unixepoch') AS day, MIN(low) AS low, AVG(low) AS avg_low
FROM per_scan GROUP BY day ORDER BY day;
```

join 遊戲資料（ATTACH `tthol.sqlite`，或兩個檔各開一條連線，在程式裡合併）：

```sql
ATTACH 'tthol.sqlite' AS game;
SELECT i.item_id, g.name, MIN(i.price) AS low, COUNT(*) AS listings
FROM market_items i JOIN game.items g ON g.id = i.item_id
WHERE i.scan_id = :latestScanId AND i.price < 99999999
GROUP BY i.item_id ORDER BY listings DESC;
```

## 還沒決定的事

- market.db 在 Windows 本機，genbu 跑在 EC2。快照要怎麼送過去（手動上傳、GitHub Release 比照 `tthol.sqlite`，或定時推送）還沒定。
- 伺服器欄位（見「讀之前要注意」第 2 點）。
- 掃描得到的價格要和玩家回報的價格放在一起，還是分開顯示。
