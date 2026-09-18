import { describe, it, expect, beforeAll, afterAll } from "vitest";
import Database from "better-sqlite3";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { getUserDb } from "@/lib/user-db";

// 這支測的是「已經存在的 price_reports 要補欄位」那條路：CREATE TABLE IF NOT EXISTS
// 對既有的表什麼都不做，正式環境的資料庫早就建好了，補欄失敗只會在線上才發現。

const dir = mkdtempSync(join(tmpdir(), "genbu-user-db-"));
const file = join(dir, "user.sqlite");
const original = process.env.GENBU_USER_DB_PATH;

function columnsOf(db: Database.Database): string[] {
  return (db.pragma("table_info(price_reports)") as { name: string }[]).map((c) => c.name);
}

function forgetCachedConnection(): void {
  delete (globalThis as { _userDb?: Database.Database })._userDb;
}

beforeAll(() => {
  const legacy = new Database(file);
  legacy.exec(`CREATE TABLE price_reports (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    item_id    INTEGER NOT NULL,
    server     TEXT NOT NULL,
    currency   TEXT NOT NULL,
    amount     INTEGER NOT NULL,
    author_sub TEXT NOT NULL,
    created_at INTEGER NOT NULL
  )`);
  legacy
    .prepare(
      `INSERT INTO price_reports (item_id, server, currency, amount, author_sub, created_at)
       VALUES (1, 'fish', 'silver', 100, 'U_a', 1000)`,
    )
    .run();
  legacy.close();

  process.env.GENBU_USER_DB_PATH = file;
  forgetCachedConnection();
});

afterAll(() => {
  forgetCachedConnection();
  if (original == null) delete process.env.GENBU_USER_DB_PATH;
  else process.env.GENBU_USER_DB_PATH = original;
  rmSync(dir, { recursive: true, force: true });
});

describe("getUserDb", () => {
  it("補上舊資料庫缺的補充狀態欄位，既有回報原封不動", () => {
    const db = getUserDb();

    expect(columnsOf(db)).toEqual(
      expect.arrayContaining(["awaken", "bind_left", "bind_expand", "enhance"]),
    );
    // 舊資料不用回填：NULL 就是「沒填」，讀出來會被當成乾淨裝。
    const row = db.prepare("SELECT amount, awaken, enhance FROM price_reports").get();
    expect(row).toEqual({ amount: 100, awaken: null, enhance: null });
  });

  it("再開一次不會重複補欄位而炸掉", () => {
    forgetCachedConnection();
    expect(() => getUserDb()).not.toThrow();
    expect(columnsOf(getUserDb())).toContain("enhance");
  });
});
