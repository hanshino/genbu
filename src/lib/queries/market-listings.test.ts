import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { vi } from "vitest";
import type Database from "better-sqlite3";
import { getUserDb } from "@/lib/user-db";
import {
  getItemListings,
  getLatestScans,
  getScanListings,
  getStallListings,
  getStoneInfo,
} from "./market-listings";

const cache = globalThis as typeof globalThis & { _userDb?: Database.Database };
let db: Database.Database;

function addScan(scanId: number, server: "fish" | "flower", started: number) {
  db.prepare(
    `INSERT INTO market_scans (scan_id, server, stage, started, ended, item_count, received_at)
     VALUES (?, ?, 173, ?, ?, 0, ?)`,
  ).run(scanId, server, started, started + 100, Math.floor(started + 100));
}

function addListing(
  scanId: number,
  owner: string,
  itemId: number,
  price: number,
  data: Record<string, unknown> | null = null,
  count = 1,
) {
  db.prepare(
    `INSERT INTO market_listings (scan_id, owner_hash, item_id, price, count, strengthen, data)
     VALUES (?, ?, ?, ?, ?, 0, ?)`,
  ).run(scanId, owner, itemId, price, count, data === null ? null : JSON.stringify(data));
}

function addStall(scanId: number, owner: string, name: string | null, sign: string) {
  db.prepare(
    "INSERT INTO market_stalls (scan_id, owner_hash, name, sign, x, y) VALUES (?, ?, ?, ?, 1, 1)",
  ).run(scanId, owner, name, sign);
}

beforeEach(() => {
  vi.stubEnv("GENBU_USER_DB_PATH", ":memory:");
  delete cache._userDb;
  db = getUserDb();
});

afterEach(() => {
  db.close();
  delete cache._userDb;
  vi.unstubAllEnvs();
});

describe("getLatestScans", () => {
  it("沒有掃描資料時回空陣列", () => {
    expect(getLatestScans()).toEqual([]);
  });

  it("每個伺服器只取最新一筆，依 SERVERS 順序", () => {
    addScan(1, "flower", 1000);
    addScan(2, "flower", 2000);
    addScan(3, "fish", 1500);
    addListing(2, "a", 100, 500);
    addListing(1, "a", 100, 500);
    expect(getLatestScans()).toEqual([
      { scanId: 3, server: "fish", started: 1500 },
      { scanId: 2, server: "flower", started: 2000 },
    ]);
  });
});

describe("getItemListings", () => {
  it("只讀最新掃描，舊掃描的同一攤不重複出現", () => {
    addScan(1, "flower", 1000);
    addScan(2, "flower", 2000);
    addListing(1, "old", 100, 100);
    addListing(2, "new", 100, 300);
    const [only] = getItemListings(100);
    expect(only.scan.scanId).toBe(2);
    expect(only.listings.map((l) => l.ownerHash)).toEqual(["new"]);
  });

  it("排除 >= 99,990,000 的展示價，99,989,999 照列，由便宜到貴", () => {
    addScan(1, "flower", 1000);
    addListing(1, "a", 100, 99_990_000);
    addListing(1, "b", 100, 99_999_999);
    addListing(1, "c", 100, 99_989_999);
    addListing(1, "d", 100, 20);
    expect(getItemListings(100)[0].listings.map((l) => l.price)).toEqual([20, 99_989_999]);
  });

  it("用 (scan_id, owner_hash) 對到攤位；找不到攤位或沒有名稱時為 null", () => {
    addScan(1, "flower", 1000);
    addScan(2, "flower", 2000);
    addStall(2, "named", "木之精靈", "賣靈木");
    addStall(2, "anon", null, "可密我");
    addStall(1, "orphan", "上一輪的攤主", "舊招牌"); // 同 owner_hash 但不同掃描，不能對上
    addListing(2, "named", 100, 1);
    addListing(2, "anon", 100, 2);
    addListing(2, "orphan", 100, 3);
    const rows = getItemListings(100)[0].listings.map((l) => [l.ownerHash, l.sign, l.name]);
    expect(rows).toEqual([
      ["named", "賣靈木", "木之精靈"],
      ["anon", "可密我", null],
      ["orphan", null, null],
    ]);
  });

  it("有掃描但沒人賣這件的伺服器回空陣列，沒掃描的伺服器不出現", () => {
    addScan(1, "flower", 1000);
    addListing(1, "a", 200, 1);
    expect(getItemListings(100)).toEqual([
      { scan: { scanId: 1, server: "flower", started: 1000 }, listings: [] },
    ]);
  });

  it("解析 data：素質 0 照留、略過空槽、真解只看有無", () => {
    addScan(1, "flower", 1000);
    addListing(1, "a", 100, 5, {
      stats: { 重擊: 0, 外功: 2 },
      stones: [11153, 0, 11153],
      binds_left: 2,
      refine_left: 0,
      zhenjie: { m: 1, lines: 2, minus: 3 },
    });
    const [listing] = getItemListings(100)[0].listings;
    expect(listing).toMatchObject({
      stats: [
        ["重擊", 0],
        ["外功", 2],
      ],
      stones: [11153, 11153],
      bindsLeft: 2,
      refineLeft: 0,
      zhenjie: true,
    });
  });
});

describe("getScanListings", () => {
  it("整次掃描的掛單，排除展示價", () => {
    addScan(1, "flower", 1000);
    addListing(1, "a", 100, 5);
    addListing(1, "a", 101, 99_990_000);
    addListing(1, "b", 102, 3);
    expect(getScanListings(1).map((l) => l.itemId)).toEqual([102, 100]);
  });
});

describe("getStallListings", () => {
  it("只取這次掃描、這一攤的掛單，帶招牌與攤主，由便宜到貴", () => {
    addScan(1, "flower", 1000);
    addScan(2, "flower", 2000);
    addStall(2, "aaaaaaaaaaaaaaaa", "木之精靈", "賣靈木");
    addListing(2, "aaaaaaaaaaaaaaaa", 100, 30);
    addListing(2, "aaaaaaaaaaaaaaaa", 101, 10);
    addListing(2, "bbbbbbbbbbbbbbbb", 100, 5);
    addListing(1, "aaaaaaaaaaaaaaaa", 102, 1); // 上一輪掃描的同一 hash 不能混進來
    expect(
      getStallListings(2, "aaaaaaaaaaaaaaaa").map((l) => [l.itemId, l.price, l.sign, l.name]),
    ).toEqual([
      [101, 10, "賣靈木", "木之精靈"],
      [100, 30, "賣靈木", "木之精靈"],
    ]);
  });

  it("這次掃描找不到這一攤時回空陣列", () => {
    addScan(1, "flower", 1000);
    addScan(2, "flower", 2000);
    addListing(1, "aaaaaaaaaaaaaaaa", 100, 5);
    expect(getStallListings(2, "aaaaaaaaaaaaaaaa")).toEqual([]);
  });

  it("排除 >= 99,990,000 的展示價，99,989,999 照列", () => {
    addScan(1, "flower", 1000);
    addListing(1, "aaaaaaaaaaaaaaaa", 100, 99_990_000);
    addListing(1, "aaaaaaaaaaaaaaaa", 101, 99_999_999);
    addListing(1, "aaaaaaaaaaaaaaaa", 102, 99_989_999);
    expect(getStallListings(1, "aaaaaaaaaaaaaaaa").map((l) => l.itemId)).toEqual([102]);
  });
});

describe("getStoneInfo", () => {
  it("compounds.id → 名稱、合併各段機率的效果範圍、主材料圖示", () => {
    const stones = getStoneInfo([11153, 10803, 11153]);
    expect(stones.get(11153)).toMatchObject({ name: "極玄學赤魂石", effect: "玄學 +10 至 15" });
    expect(stones.get(11153)?.icon?.url).toBeTruthy();
    // 愛宇魂珠分五段機率，合成一整段範圍
    expect(stones.get(10803)?.effect).toBe("體力 +110 至 2500");
  });

  it("沒有屬性加成的配方效果為 null，查無的 id 不出現", () => {
    const stones = getStoneInfo([5203, 999_999_999]);
    expect(stones.get(5203)?.effect).toBeNull();
    expect(stones.has(999_999_999)).toBe(false);
  });
});
