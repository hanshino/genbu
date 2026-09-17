import Database from "better-sqlite3";

// 玩家資料獨立於唯讀遊戲資料；避免 HMR 重複建立連線。
const globalDb = globalThis as typeof globalThis & {
  _userDb?: Database.Database;
};

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
      globalDb._userDb = db;
    } catch (error) {
      db.close();
      throw error;
    }
  }
  return globalDb._userDb;
}
