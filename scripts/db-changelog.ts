// 本地版本差異 → 更新日誌 JSON。
//
// 用法（務必「先跑腳本、再 commit 新 DB」）：
//   1. 用新的 tthol.sqlite 覆蓋工作區檔（尚未 git add）
//   2. npm run changelog -- --version 1.23 [--note "說明"]
//   3. review src/data/changelog/<date>-v1.23.json（可手改 note）
//   4. git add tthol.sqlite src/data/changelog/*.json && git commit
//
// 舊 DB 預設取自 git（HEAD:tthol.sqlite 的 blob）；用 spawn 直接把二進位
// pipe 進暫存檔，不經 shell 重導向（Windows 下 > 會破壞二進位）。

import { spawn } from "node:child_process";
import fs from "node:fs";
import fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Database from "better-sqlite3";
import { diffDatabases, buildChangelogEntry } from "../src/lib/changelog/diff";
import { PROFILES } from "../src/lib/changelog/config";
import type { ChangelogEntry } from "../src/lib/changelog/types";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, "..");
const DB_FILE = "tthol.sqlite";
const OUT_DIR = path.join(PROJECT_ROOT, "src", "data", "changelog");

interface Args {
  version?: string;
  date: string;
  note?: string;
  from: string; // git ref 或檔案路徑
  to: string; // 檔案路徑
  force: boolean;
}

function parseArgs(argv: string[]): Args {
  const args: Args = {
    date: new Date().toISOString().slice(0, 10),
    from: "HEAD",
    to: path.join(PROJECT_ROOT, DB_FILE),
    force: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--force") args.force = true;
    else if (a === "--version") args.version = argv[++i];
    else if (a === "--date") args.date = argv[++i];
    else if (a === "--note") args.note = argv[++i];
    else if (a === "--from") args.from = argv[++i];
    else if (a === "--to") args.to = argv[++i];
  }
  return args;
}

function gitBlobToTemp(ref: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const tmp = path.join(os.tmpdir(), `tthol-old-${process.pid}.sqlite`);
    const out = fs.createWriteStream(tmp);
    const child = spawn("git", ["show", `${ref}:${DB_FILE}`], {
      cwd: PROJECT_ROOT,
      windowsHide: true,
    });
    let err = "";
    let closed = false;
    let finished = false;
    let code: number | null = null;
    const fail = (err: Error) => {
      try {
        fs.rmSync(tmp, { force: true });
      } catch {
        /* best effort */
      }
      reject(err);
    };
    const settle = () => {
      if (!(closed && finished)) return;
      if (code === 0) resolve(tmp);
      else fail(new Error(`git show ${ref}:${DB_FILE} 失敗：${err.trim()}`));
    };
    child.stderr.on("data", (d) => (err += d.toString()));
    child.on("error", fail);
    child.stdout.pipe(out);
    child.on("close", (c) => {
      code = c;
      closed = true;
      settle();
    });
    out.on("error", fail);
    out.on("finish", () => {
      finished = true;
      settle();
    });
  });
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.version) {
    console.error(
      "用法：npm run changelog -- --version <版本號> [--date YYYY-MM-DD] [--note 說明] [--from HEAD|路徑] [--to 路徑] [--force]",
    );
    process.exit(1);
  }

  let oldPath: string;
  let cleanup: string | null = null;
  if (fs.existsSync(args.from)) {
    oldPath = args.from;
  } else {
    try {
      oldPath = await gitBlobToTemp(args.from);
      cleanup = oldPath;
    } catch (e) {
      console.error(String(e));
      console.error(`取不到舊 DB。若 HEAD 尚無 ${DB_FILE}，請用 --from <舊檔路徑>。`);
      process.exit(1);
    }
  }

  let oldDb: Database.Database | undefined;
  let newDb: Database.Database | undefined;
  let entry: ChangelogEntry | null;
  try {
    oldDb = new Database(oldPath, { readonly: true });
    newDb = new Database(args.to, { readonly: true, fileMustExist: true });
    const diff = diffDatabases(oldDb, newDb, PROFILES);
    entry = buildChangelogEntry(diff, { version: args.version, date: args.date, note: args.note });
  } finally {
    oldDb?.close();
    newDb?.close();
    if (cleanup) fs.rmSync(cleanup, { force: true });
  }
  if (!entry) {
    console.error("新舊 DB 無語意差異（或 HEAD 已是新檔）。未寫檔。");
    process.exit(1);
  }

  await fsp.mkdir(OUT_DIR, { recursive: true });
  const outFile = path.join(OUT_DIR, `${args.date}-v${args.version}.json`);
  if (fs.existsSync(outFile) && !args.force) {
    console.error(`檔案已存在：${path.relative(PROJECT_ROOT, outFile)}（加 --force 覆寫）`);
    process.exit(1);
  }
  await fsp.writeFile(outFile, JSON.stringify(entry, null, 2) + "\n", "utf8");

  console.log(`\n更新日誌 v${args.version}（${args.date}）`);
  console.log(`  總計：+${entry.summary.added} ~${entry.summary.changed} −${entry.summary.removed}`);
  if (entry.addedTables.length) console.log(`  新增表：${entry.addedTables.join(", ")}`);
  if (entry.removedTables.length) console.log(`  移除表：${entry.removedTables.join(", ")}`);
  for (const t of entry.tables) {
    const flags = [
      t.rebuilt ? "重建" : "",
      t.noIdentity ? "無識別" : "",
      t.structural ? "結構變動" : "",
      t.systematic?.length ? `系統性x${t.systematic.length}` : "",
    ]
      .filter(Boolean)
      .join(" ");
    console.log(
      `  ${t.label}(${t.table})  +${t.counts.added} ~${t.counts.changed} −${t.counts.removed}` +
        (flags ? `  [${flags}]` : ""),
    );
  }
  console.log(`\n已寫入 ${path.relative(PROJECT_ROOT, outFile)}`);
  console.log("請 review 內容（可手改 note），再：");
  console.log(`  git add ${DB_FILE} src/data/changelog/*.json && git commit`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
