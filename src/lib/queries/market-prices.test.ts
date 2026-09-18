import { describe, it, expect, vi, beforeEach } from "vitest";
import Database from "better-sqlite3";
import * as userDbModule from "@/lib/user-db";
import {
  ReportNotFoundError,
  SelfVoteError,
  createReport,
  deleteReport,
  getItemReports,
  getRecentReports,
  getNetVotes,
  hasReportedRecently,
  setVote,
  type PriceReport,
} from "./market-prices";

// in-memory sqlite，schema 與 src/lib/user-db.ts 的 CREATE TABLE 一致。
function makeMemDb(): Database.Database {
  const db = new Database(":memory:");
  db.exec(`
    CREATE TABLE users (
      sub TEXT PRIMARY KEY,
      nickname TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );
    CREATE TABLE price_reports (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      item_id    INTEGER NOT NULL,
      server     TEXT NOT NULL,
      currency   TEXT NOT NULL,
      amount     INTEGER NOT NULL,
      author_sub TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );
    CREATE INDEX idx_price_reports_item ON price_reports(item_id);
    CREATE TABLE votes (
      report_id INTEGER NOT NULL,
      voter_sub TEXT NOT NULL,
      value     INTEGER NOT NULL,
      PRIMARY KEY (report_id, voter_sub)
    );
  `);
  return db;
}

let mem: Database.Database;

beforeEach(() => {
  mem = makeMemDb();
  vi.spyOn(userDbModule, "getUserDb").mockReturnValue(mem);
});

describe("getItemReports", () => {
  it("回傳 netVotes / myVote / 排序正確", () => {
    mem
      .prepare("INSERT INTO users (sub, nickname, created_at) VALUES (?, ?, ?)")
      .run("U_author", "英雄", 1000);
    mem
      .prepare("INSERT INTO users (sub, nickname, created_at) VALUES (?, ?, ?)")
      .run("U_voter", "英雄", 1000);

    // report A: 較晚建立，但票數較高 → 應排第一
    mem
      .prepare(
        `INSERT INTO price_reports (id, item_id, server, currency, amount, author_sub, created_at)
         VALUES (1, 100, 'fish', 'silver', 5000, 'U_author', 2000)`,
      )
      .run();
    // report B: 較早建立，票數較低 → 應排第二
    mem
      .prepare(
        `INSERT INTO price_reports (id, item_id, server, currency, amount, author_sub, created_at)
         VALUES (2, 100, 'fish', 'silver', 3000, 'U_author', 1000)`,
      )
      .run();

    mem.prepare("INSERT INTO votes (report_id, voter_sub, value) VALUES (1, 'U_voter', 1)").run();
    mem.prepare("INSERT INTO votes (report_id, voter_sub, value) VALUES (2, 'U_voter', -1)").run();

    const reports = getItemReports(100, "U_voter");
    expect(reports.map((r: PriceReport) => r.id)).toEqual([1, 2]);
    expect(reports[0].netVotes).toBe(1);
    expect(reports[0].myVote).toBe(1);
    expect(reports[1].netVotes).toBe(-1);
    expect(reports[1].myVote).toBe(-1);
    expect(reports[0].nickname).toBe("英雄");
    expect(reports[0].tag).toBe("author".slice(-5)); // U_author 末五碼 = "uthor"
  });

  it("未登入（viewerSub 為 null）myVote 一律 0", () => {
    mem
      .prepare("INSERT INTO users (sub, nickname, created_at) VALUES ('U_author', '英雄', 1000)")
      .run();
    mem
      .prepare(
        `INSERT INTO price_reports (id, item_id, server, currency, amount, author_sub, created_at)
         VALUES (1, 100, 'fish', 'silver', 5000, 'U_author', 2000)`,
      )
      .run();

    const reports = getItemReports(100, null);
    expect(reports[0].myVote).toBe(0);
  });

  it("暱稱改變時歷史回報一起變（不存 author_name 快照）", () => {
    mem
      .prepare("INSERT INTO users (sub, nickname, created_at) VALUES ('U_author', '英雄', 1000)")
      .run();
    mem
      .prepare(
        `INSERT INTO price_reports (id, item_id, server, currency, amount, author_sub, created_at)
         VALUES (1, 100, 'fish', 'silver', 5000, 'U_author', 2000)`,
      )
      .run();
    mem.prepare("UPDATE users SET nickname = ? WHERE sub = ?").run("改名後", "U_author");

    const reports = getItemReports(100, null);
    expect(reports[0].nickname).toBe("改名後");
  });
});

describe("createReport / hasReportedRecently", () => {
  it("建立回報後可查到，且冷卻期內視為已回報", () => {
    mem
      .prepare("INSERT INTO users (sub, nickname, created_at) VALUES ('U_author', '英雄', 1000)")
      .run();
    const id = createReport({
      itemId: 200,
      server: "flower",
      currency: "official",
      amount: 10,
      authorSub: "U_author",
    });
    expect(id).toBeGreaterThan(0);
    expect(hasReportedRecently(200, "flower", "U_author", 300)).toBe(true);
    expect(hasReportedRecently(200, "fish", "U_author", 300)).toBe(false); // 不同伺服器不算
    expect(hasReportedRecently(999, "flower", "U_author", 300)).toBe(false); // 不同物品不算
  });
});

describe("setVote", () => {
  beforeEach(() => {
    mem
      .prepare("INSERT INTO users (sub, nickname, created_at) VALUES ('U_author', '英雄', 1000)")
      .run();
    mem
      .prepare("INSERT INTO users (sub, nickname, created_at) VALUES ('U_voter', '英雄', 1000)")
      .run();
    mem
      .prepare(
        `INSERT INTO price_reports (id, item_id, server, currency, amount, author_sub, created_at)
         VALUES (1, 100, 'fish', 'silver', 5000, 'U_author', 1000)`,
      )
      .run();
  });

  it("upsert：重複投票會覆蓋成新值，不會疊加", () => {
    setVote(1, "U_voter", 1);
    expect(getNetVotes(1)).toBe(1);
    setVote(1, "U_voter", -1);
    expect(getNetVotes(1)).toBe(-1);
  });

  it("value 為 0 時刪除該筆 vote", () => {
    setVote(1, "U_voter", 1);
    expect(getNetVotes(1)).toBe(1);
    setVote(1, "U_voter", 0);
    expect(getNetVotes(1)).toBe(0);
    const row = mem
      .prepare("SELECT 1 FROM votes WHERE report_id = 1 AND voter_sub = 'U_voter'")
      .get();
    expect(row).toBeUndefined();
  });

  it("對自己的回報投票丟 SelfVoteError", () => {
    expect(() => setVote(1, "U_author", 1)).toThrow(SelfVoteError);
  });

  it("report 不存在丟 ReportNotFoundError", () => {
    expect(() => setVote(999, "U_voter", 1)).toThrow(ReportNotFoundError);
  });
});

describe("deleteReport", () => {
  function seed() {
    mem
      .prepare("INSERT INTO users (sub, nickname, created_at) VALUES (?, ?, ?)")
      .run("U_author", "英雄", 1000);
    mem
      .prepare(
        `INSERT INTO price_reports (id, item_id, server, currency, amount, author_sub, created_at)
         VALUES (1, 24086, 'fish', 'silver', 1000000, 'U_author', 1000)`,
      )
      .run();
    mem.prepare("INSERT INTO votes (report_id, voter_sub, value) VALUES (1, 'U_voter', -1)").run();
  }

  it("作者刪得掉，連同票一起清掉", () => {
    seed();
    expect(deleteReport(1, "U_author")).toBe(true);
    expect(mem.prepare("SELECT COUNT(*) AS n FROM price_reports").get()).toEqual({ n: 0 });
    expect(mem.prepare("SELECT COUNT(*) AS n FROM votes").get()).toEqual({ n: 0 });
  });

  it("不是作者就刪不掉，資料原封不動", () => {
    seed();
    expect(deleteReport(1, "U_someone_else")).toBe(false);
    expect(mem.prepare("SELECT COUNT(*) AS n FROM price_reports").get()).toEqual({ n: 1 });
    expect(mem.prepare("SELECT COUNT(*) AS n FROM votes").get()).toEqual({ n: 1 });
  });

  it("回報不存在回 false", () => {
    expect(deleteReport(999, "U_author")).toBe(false);
  });
});

describe("getRecentReports", () => {
  it("跨伺服器、依時間新到舊，帶上暱稱並吃 limit", () => {
    mem
      .prepare("INSERT INTO users (sub, nickname, created_at) VALUES (?, ?, ?)")
      .run("U_a", "英雄", 1000);
    mem
      .prepare("INSERT INTO users (sub, nickname, created_at) VALUES (?, ?, ?)")
      .run("U_b", "柳三刀", 1000);
    const insert = mem.prepare(
      `INSERT INTO price_reports (item_id, server, currency, amount, author_sub, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    );
    insert.run(1, "fish", "silver", 100, "U_a", 1000);
    insert.run(2, "flower", "official", 18, "U_b", 3000);
    insert.run(3, "fish", "silver", 300, "U_a", 2000);

    const recent = getRecentReports(2);
    expect(recent.map((r) => [r.itemId, r.nickname, r.server])).toEqual([
      [2, "柳三刀", "flower"],
      [3, "英雄", "fish"],
    ]);
  });

  it("沒有回報時回空陣列", () => {
    expect(getRecentReports(5)).toEqual([]);
  });
});
