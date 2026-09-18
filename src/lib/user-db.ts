import Database from "better-sqlite3";

// 玩家資料獨立於唯讀遊戲資料；避免 HMR 重複建立連線。
const globalDb = globalThis as typeof globalThis & {
  _userDb?: Database.Database;
};

// price_reports 後來才加的欄位。CREATE TABLE IF NOT EXISTS 對既有的表什麼都不做，
// 所以開連線時自己比對一次；全部可為 NULL，舊資料不用回填（NULL 就是「沒填」）。
const PRICE_REPORT_COLUMNS: readonly [string, string][] = [
  ["awaken", "INTEGER"],
  ["bind_left", "INTEGER"],
  ["bind_expand", "INTEGER"],
  ["enhance", "TEXT"],
];

function addMissingColumns(db: Database.Database): void {
  const existing = new Set(
    (db.pragma("table_info(price_reports)") as { name: string }[]).map((column) => column.name),
  );
  for (const [name, type] of PRICE_REPORT_COLUMNS) {
    if (!existing.has(name)) db.exec(`ALTER TABLE price_reports ADD COLUMN ${name} ${type}`);
  }
}

export function getUserDb(): Database.Database {
  if (!globalDb._userDb) {
    const db = new Database(process.env.GENBU_USER_DB_PATH || "/app/data/genbu-user.sqlite", {
      fileMustExist: false,
    });
    try {
      db.pragma("journal_mode = WAL");
      db.exec(`CREATE TABLE IF NOT EXISTS users (
        sub TEXT PRIMARY KEY,
        nickname TEXT NOT NULL,
        created_at INTEGER NOT NULL
      )`);
      db.exec(`CREATE TABLE IF NOT EXISTS price_reports (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        item_id    INTEGER NOT NULL,
        server     TEXT NOT NULL,
        currency   TEXT NOT NULL,
        amount     INTEGER NOT NULL,
        author_sub TEXT NOT NULL,
        created_at INTEGER NOT NULL
      )`);
      db.exec(`CREATE INDEX IF NOT EXISTS idx_price_reports_item ON price_reports(item_id)`);
      addMissingColumns(db);
      db.exec(`CREATE TABLE IF NOT EXISTS votes (
        report_id INTEGER NOT NULL,
        voter_sub TEXT NOT NULL,
        value     INTEGER NOT NULL,
        PRIMARY KEY (report_id, voter_sub)
      )`);
      globalDb._userDb = db;
    } catch (error) {
      db.close();
      throw error;
    }
  }
  return globalDb._userDb;
}
