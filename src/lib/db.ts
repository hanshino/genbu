import Database from "better-sqlite3";
import path from "path";

// 使用 globalThis 避免 Next.js HMR (Hot Module Reload) 時重複建立連線
const globalDb = globalThis as typeof globalThis & { _db?: Database.Database };

export function getDb(): Database.Database {
  if (!globalDb._db) {
    globalDb._db = new Database(
      path.join(process.cwd(), "tthol.sqlite"),
      { readonly: true, fileMustExist: true }
    );
    globalDb._db.pragma("journal_mode = WAL");
  }
  return globalDb._db;
}
