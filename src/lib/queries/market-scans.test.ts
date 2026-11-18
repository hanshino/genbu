import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";
import type Database from "better-sqlite3";
import { REFERENCE_WINDOW_DAYS } from "@/lib/market-price";
import { getUserDb } from "@/lib/user-db";
import { ingestScan, type ScanInput } from "./market-scans";

const NOW = 1_800_000_000;
const WINDOW = REFERENCE_WINDOW_DAYS * 86_400;
const cache = globalThis as typeof globalThis & { _userDb?: Database.Database };
let db: Database.Database;

function scan(scanId = 1, started = NOW): ScanInput {
  return {
    scanId,
    server: "fish",
    started,
    ended: started + 1.5,
    items: [
      {
        owner: "0123456789abcdefabcd",
        itemId: 100,
        count: 2,
        price: 500,
        strengthen: 7,
        data: { stats: { 外功: 2 } },
      },
    ],
  };
}

beforeEach(() => {
  vi.stubEnv("GENBU_USER_DB_PATH", ":memory:");
  delete cache._userDb;
  vi.spyOn(Date, "now").mockReturnValue(NOW * 1000);
  db = getUserDb();
});

afterEach(() => {
  db.close();
  delete cache._userDb;
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe("ingestScan", () => {
  it("寫入掃描、過濾零價與上限價，僅儲存攤主雜湊與 JSON", () => {
    const input = scan(1, NOW - 0.25);
    const item = input.items[0];
    input.items.push(
      { ...item, itemId: 101, price: 99_999_998, data: null },
      { ...item, price: 0 },
      { ...item, price: 99_999_999 },
      { ...item, price: 100_000_000 },
    );
    expect(ingestScan(input)).toEqual({ scanId: 1, inserted: 2, duplicate: false });
    expect(db.prepare("SELECT * FROM market_scans").get()).toEqual({
      scan_id: 1,
      server: "fish",
      started: input.started,
      ended: input.ended,
      item_count: 2,
      received_at: NOW,
      stage: null,
    });
    const ownerHash = createHash("sha256").update(item.owner).digest("hex").slice(0, 16);
    const listings = db.prepare("SELECT * FROM market_listings ORDER BY item_id").all();
    expect(listings).toEqual([
      {
        scan_id: 1,
        owner_hash: ownerHash,
        item_id: 100,
        price: 500,
        count: 2,
        strengthen: 7,
        data: JSON.stringify(item.data),
      },
      {
        scan_id: 1,
        owner_hash: ownerHash,
        item_id: 101,
        price: 99_999_998,
        count: 2,
        strengthen: 7,
        data: null,
      },
    ]);
    expect(JSON.stringify(listings)).not.toContain(item.owner);
  });

  it("重複 scanId 不覆寫、不新增，也不執行保留期限刪除", () => {
    ingestScan(scan());
    const changes = db.prepare("SELECT total_changes() AS n").get();
    vi.mocked(Date.now).mockReturnValue((NOW + WINDOW + 1) * 1000);
    expect(ingestScan({ ...scan(), server: "flower", items: [] })).toEqual({
      scanId: 1,
      inserted: 0,
      duplicate: true,
    });
    expect(db.prepare("SELECT total_changes() AS n").get()).toEqual(changes);
    expect(db.prepare("SELECT server, item_count FROM market_scans").get()).toEqual({
      server: "fish",
      item_count: 1,
    });
    expect(db.prepare("SELECT COUNT(*) AS n FROM market_listings").get()).toEqual({ n: 1 });
  });

  it("刪除超過 30 天的掃描及商品，保留期限邊界不刪", () => {
    vi.mocked(Date.now).mockReturnValue((NOW - WINDOW - 1) * 1000);
    ingestScan({ ...scan(1, NOW - WINDOW - 1), server: "flower" });
    vi.mocked(Date.now).mockReturnValue(NOW * 1000);
    ingestScan(scan(2, NOW - WINDOW));
    ingestScan({ ...scan(3), ended: null });
    expect(db.prepare("SELECT scan_id FROM market_scans ORDER BY scan_id").all()).toEqual([
      { scan_id: 2 },
      { scan_id: 3 },
    ]);
    expect(db.prepare("SELECT scan_id FROM market_listings ORDER BY scan_id").all()).toEqual([
      { scan_id: 2 },
      { scan_id: 3 },
    ]);
  });

  it("空掃描或全數過濾仍記錄 item_count = 0", () => {
    expect(ingestScan({ ...scan(), items: [] })).toEqual({
      scanId: 1,
      inserted: 0,
      duplicate: false,
    });
    const input = scan(2);
    input.items[0].price = 0;
    expect(ingestScan(input)).toEqual({ scanId: 2, inserted: 0, duplicate: false });
    expect(db.prepare("SELECT item_count FROM market_scans").all()).toEqual([
      { item_count: 0 },
      { item_count: 0 },
    ]);
  });

  it("舊格式（沒有 stage / stalls）照收，stage 存 NULL、不寫攤位", () => {
    expect(ingestScan(scan())).toEqual({ scanId: 1, inserted: 1, duplicate: false });
    expect(db.prepare("SELECT stage FROM market_scans").get()).toEqual({ stage: null });
    expect(db.prepare("SELECT COUNT(*) AS n FROM market_stalls").get()).toEqual({ n: 0 });
  });

  it("寫入 stage 與攤位：招牌 trim、name / 座標可為 null、重複 owner 不讓整筆失敗", () => {
    const owner = "0123456789abcdefabcd";
    const input: ScanInput = {
      ...scan(),
      stage: 173,
      stalls: [
        { owner, name: "某攤主", sign: "  缺錢 便宜賣\uFFFD \n", x: 30, y: 38 },
        { owner: "ffff", name: null, sign: "", x: null, y: null },
        { owner, name: "重複", sign: "重複", x: 1, y: 1 },
      ],
    };
    expect(ingestScan(input)).toEqual({ scanId: 1, inserted: 1, duplicate: false });
    expect(db.prepare("SELECT stage FROM market_scans").get()).toEqual({ stage: 173 });
    const hash = (value: string) => createHash("sha256").update(value).digest("hex").slice(0, 16);
    const stalls = db.prepare("SELECT * FROM market_stalls ORDER BY name IS NULL").all();
    expect(stalls).toEqual([
      {
        scan_id: 1,
        owner_hash: hash(owner),
        name: "某攤主",
        sign: "缺錢 便宜賣\uFFFD",
        x: 30,
        y: 38,
      },
      { scan_id: 1, owner_hash: hash("ffff"), name: null, sign: "", x: null, y: null },
    ]);
    expect(JSON.stringify(stalls)).not.toContain(owner);
    // 同一次掃描內可以用 (scan_id, owner_hash) 把商品對回攤位。
    expect(
      db
        .prepare(
          `SELECT s.name FROM market_listings l
           JOIN market_stalls s ON s.scan_id = l.scan_id AND s.owner_hash = l.owner_hash`,
        )
        .all(),
    ).toEqual([{ name: "某攤主" }]);
  });

  it("重複 scanId 不寫入攤位", () => {
    ingestScan(scan());
    expect(
      ingestScan({
        ...scan(),
        stage: 173,
        stalls: [{ owner: "abcd", name: "甲", sign: "招牌", x: 1, y: 2 }],
      }),
    ).toEqual({ scanId: 1, inserted: 0, duplicate: true });
    expect(db.prepare("SELECT COUNT(*) AS n FROM market_stalls").get()).toEqual({ n: 0 });
    expect(db.prepare("SELECT stage FROM market_scans").get()).toEqual({ stage: null });
  });

  it("保留期限清理一併刪除過期掃描的攤位", () => {
    const stalls = [{ owner: "abcd", name: "甲", sign: "招牌", x: 1, y: 2 }];
    vi.mocked(Date.now).mockReturnValue((NOW - WINDOW - 1) * 1000);
    ingestScan({ ...scan(1, NOW - WINDOW - 1), stalls });
    vi.mocked(Date.now).mockReturnValue(NOW * 1000);
    ingestScan({ ...scan(2), stalls });
    expect(db.prepare("SELECT scan_id FROM market_stalls").all()).toEqual([{ scan_id: 2 }]);
  });

  it("任一商品寫入失敗時整筆掃描 rollback", () => {
    db.exec(`CREATE TRIGGER fail_listing BEFORE INSERT ON market_listings
      WHEN NEW.item_id = 101 BEGIN SELECT RAISE(ABORT, 'test failure'); END`);
    const input = scan();
    input.items.push({ ...input.items[0], itemId: 101 });
    expect(() => ingestScan(input)).toThrow("test failure");
    expect(db.prepare("SELECT COUNT(*) AS n FROM market_scans").get()).toEqual({ n: 0 });
    expect(db.prepare("SELECT COUNT(*) AS n FROM market_listings").get()).toEqual({ n: 0 });
  });
});
