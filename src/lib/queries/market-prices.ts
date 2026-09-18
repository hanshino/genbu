import { getUserDb } from "@/lib/user-db";

export type ServerId = "fish" | "flower";
export type CurrencyId = "silver" | "official" | "twd";

export type PriceReport = {
  id: number;
  itemId: number;
  server: ServerId;
  currency: CurrencyId;
  amount: number;
  nickname: string;
  tag: string; // author_sub 末五碼，跟 session.ts 的 tag 算法一致
  netVotes: number;
  myVote: 0 | 1 | -1; // 目前使用者的投票，未登入一律 0
  mine: boolean; // 目前使用者是不是作者；只有作者刪得掉自己的回報
  createdAt: number;
};

type ReportRow = {
  id: number;
  item_id: number;
  server: ServerId;
  currency: CurrencyId;
  amount: number;
  author_sub: string;
  created_at: number;
  nickname: string;
  net_votes: number;
  my_vote: number | null;
};

function toReport(row: ReportRow, viewerSub: string | null): PriceReport {
  return {
    id: row.id,
    itemId: row.item_id,
    server: row.server,
    currency: row.currency,
    amount: row.amount,
    nickname: row.nickname,
    tag: row.author_sub.slice(-5),
    netVotes: row.net_votes,
    myVote: (row.my_vote ?? 0) as 0 | 1 | -1,
    mine: viewerSub != null && row.author_sub === viewerSub,
    createdAt: row.created_at,
  };
}

// 回傳某物品的所有回報（兩個伺服器都含），依 netVotes DESC, createdAt DESC 排序。
// client 依 server 自行篩選並算中位數（台幣要用玩家自訂匯率，不能在這裡算）。
export function getItemReports(itemId: number, viewerSub: string | null): PriceReport[] {
  const db = getUserDb();
  const rows = db
    .prepare(
      `SELECT
         pr.id, pr.item_id, pr.server, pr.currency, pr.amount, pr.author_sub, pr.created_at,
         u.nickname,
         COALESCE(SUM(v.value), 0) AS net_votes,
         (SELECT value FROM votes WHERE report_id = pr.id AND voter_sub = ?) AS my_vote
       FROM price_reports pr
       JOIN users u ON u.sub = pr.author_sub
       LEFT JOIN votes v ON v.report_id = pr.id
       WHERE pr.item_id = ?
       GROUP BY pr.id
       ORDER BY net_votes DESC, pr.created_at DESC`,
    )
    .all(viewerSub, itemId) as ReportRow[];
  return rows.map((row) => toReport(row, viewerSub));
}

export type CreateReportInput = {
  itemId: number;
  server: ServerId;
  currency: CurrencyId;
  amount: number;
  authorSub: string;
};

export function createReport(input: CreateReportInput): number {
  const db = getUserDb();
  const now = Math.floor(Date.now() / 1000);
  const result = db
    .prepare(
      `INSERT INTO price_reports (item_id, server, currency, amount, author_sub, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .run(input.itemId, input.server, input.currency, input.amount, input.authorSub, now);
  return Number(result.lastInsertRowid);
}

// 防洗版：同一使用者對同一物品+伺服器，N 秒內是否已回報過。
export function hasReportedRecently(
  itemId: number,
  server: ServerId,
  authorSub: string,
  withinSeconds: number,
): boolean {
  const db = getUserDb();
  const since = Math.floor(Date.now() / 1000) - withinSeconds;
  const row = db
    .prepare(
      `SELECT 1 FROM price_reports
       WHERE item_id = ? AND server = ? AND author_sub = ? AND created_at >= ?
       LIMIT 1`,
    )
    .get(itemId, server, authorSub, since);
  return row !== undefined;
}

// 只有作者本人刪得掉；沒刪到（不存在或不是你的）回 false，呼叫端不用另外查歸屬。
// votes 沒有 FK cascade，同一個 transaction 裡一起清掉免得留下孤兒票。
export function deleteReport(reportId: number, authorSub: string): boolean {
  const db = getUserDb();
  return db.transaction(() => {
    const result = db
      .prepare("DELETE FROM price_reports WHERE id = ? AND author_sub = ?")
      .run(reportId, authorSub);
    if (result.changes === 0) return false;
    db.prepare("DELETE FROM votes WHERE report_id = ?").run(reportId);
    return true;
  })();
}

export class ReportNotFoundError extends Error {}
export class SelfVoteError extends Error {}

// value 為 0 代表取消投票（刪除該筆 vote），否則 upsert。
// 禁止對自己的回報投票：作者與投票者相同時丟 SelfVoteError，由 handler 轉成 400。
export function setVote(reportId: number, voterSub: string, value: 1 | -1 | 0): void {
  const db = getUserDb();
  const report = db.prepare("SELECT author_sub FROM price_reports WHERE id = ?").get(reportId) as
    { author_sub: string } | undefined;
  if (!report) throw new ReportNotFoundError();
  if (report.author_sub === voterSub) throw new SelfVoteError();

  if (value === 0) {
    db.prepare("DELETE FROM votes WHERE report_id = ? AND voter_sub = ?").run(reportId, voterSub);
    return;
  }
  db.prepare(
    `INSERT INTO votes (report_id, voter_sub, value) VALUES (?, ?, ?)
     ON CONFLICT(report_id, voter_sub) DO UPDATE SET value = excluded.value`,
  ).run(reportId, voterSub, value);
}

export function getNetVotes(reportId: number): number {
  const db = getUserDb();
  const row = db
    .prepare("SELECT COALESCE(SUM(value), 0) AS net_votes FROM votes WHERE report_id = ?")
    .get(reportId) as { net_votes: number };
  return row.net_votes;
}
