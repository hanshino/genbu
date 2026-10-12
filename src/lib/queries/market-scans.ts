import { createHash } from "node:crypto";
import { REFERENCE_WINDOW_DAYS } from "@/lib/market-price";
import { getUserDb } from "@/lib/user-db";
import type { ServerId } from "./market-prices";

export type ScanItem = {
  owner: string;
  itemId: number;
  count: number;
  price: number;
  strengthen: number;
  data: Record<string, unknown> | null;
};

export type ScanInput = {
  scanId: number;
  server: ServerId;
  started: number;
  ended: number | null;
  items: ScanItem[];
};

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isInt(value: unknown, min: number): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= min;
}

function isTimestamp(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

export function parseScanInput(body: unknown): ScanInput {
  if (!isObject(body)) throw new Error("請提供掃描資料物件。");
  if (!isInt(body.scanId, 1)) throw new Error("掃描編號請填正整數。");
  if (body.server !== "fish" && body.server !== "flower") throw new Error("伺服器無效。");
  if (!isTimestamp(body.started)) throw new Error("掃描開始時間無效。");
  if (body.ended !== null && !isTimestamp(body.ended)) throw new Error("掃描結束時間無效。");
  if (!Array.isArray(body.items) || body.items.length > 50_000) {
    throw new Error("商品須為陣列，且最多 50000 筆。");
  }

  for (const [index, item] of body.items.entries()) {
    const fail = (message: string): never => {
      throw new Error(`第 ${index + 1} 筆商品：${message}`);
    };
    if (!isObject(item)) fail("格式無效。");
    if (typeof item.owner !== "string" || !/^[0-9a-f]+$/i.test(item.owner)) {
      fail("攤主識別碼須為十六進位字串。");
    }
    if (!isInt(item.itemId, 1)) fail("物品編號請填正整數。");
    if (!isInt(item.count, 1)) fail("數量請填正整數。");
    if (!isInt(item.price, 0)) fail("單價請填非負整數。");
    if (!isInt(item.strengthen, 0)) fail("強化等級請填非負整數。");
    if (item.data !== null && !isObject(item.data)) fail("附加資料須為物件或 null。");
  }

  return body as ScanInput;
}

export function ingestScan(input: ScanInput): {
  scanId: number;
  inserted: number;
  duplicate: boolean;
} {
  const db = getUserDb();
  return db
    .transaction(() => {
      if (db.prepare("SELECT 1 FROM market_scans WHERE scan_id = ?").get(input.scanId)) {
        return { scanId: input.scanId, inserted: 0, duplicate: true };
      }

      const now = Date.now() / 1000;
      const items = input.items.filter((item) => item.price > 0 && item.price < 99_999_999);
      db.prepare(
        `INSERT INTO market_scans (scan_id, server, started, ended, item_count, received_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      ).run(input.scanId, input.server, input.started, input.ended, items.length, Math.floor(now));

      const insert = db.prepare(
        `INSERT INTO market_listings (scan_id, owner_hash, item_id, price, count, strengthen, data)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      );
      for (const item of items) {
        insert.run(
          input.scanId,
          createHash("sha256").update(item.owner).digest("hex").slice(0, 16),
          item.itemId,
          item.price,
          item.count,
          item.strengthen,
          item.data === null ? null : JSON.stringify(item.data),
        );
      }

      const since = now - REFERENCE_WINDOW_DAYS * 86_400;
      db.prepare(
        `DELETE FROM market_listings
       WHERE scan_id IN (SELECT scan_id FROM market_scans WHERE started < ?)`,
      ).run(since);
      db.prepare("DELETE FROM market_scans WHERE started < ?").run(since);
      return { scanId: input.scanId, inserted: items.length, duplicate: false };
    })
    .immediate();
}
