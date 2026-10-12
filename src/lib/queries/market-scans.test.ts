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
