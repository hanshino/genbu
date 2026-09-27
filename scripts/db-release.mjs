// tthol.sqlite 不進 git，實體檔放在 GitHub Release；repo 只留 db.lock.json
// 記錄目前這個 commit 對應哪一版 DB（tag + sha256）。
//
//   npm run db:pull      依 db.lock.json 下載 DB 到工作區（已是同一版就略過）
//   npm run db:publish   把工作區的 DB 上傳成新的 Release，並改寫 db.lock.json
//
// db:publish 需要已登入的 gh CLI；db:pull 只用公開下載網址，不需要 token。

import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const PROJECT_ROOT = path.resolve(__dirname, "..");
export const REPO = "hanshino/genbu";
export const DB_FILE = "tthol.sqlite";
export const DB_PATH = path.join(PROJECT_ROOT, DB_FILE);
export const LOCK_FILE = "db.lock.json";
const LOCK_PATH = path.join(PROJECT_ROOT, LOCK_FILE);

export function sha256File(file) {
  const hash = createHash("sha256");
  const fd = fs.openSync(file, "r");
  try {
    const buf = Buffer.alloc(1 << 20);
    let n;
    while ((n = fs.readSync(fd, buf, 0, buf.length, null)) > 0) hash.update(buf.subarray(0, n));
  } finally {
    fs.closeSync(fd);
  }
  return hash.digest("hex");
}

export function readLock(file = LOCK_PATH) {
  if (!fs.existsSync(file)) return null;
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

/** 取某個 git ref 上的 db.lock.json（changelog 用 HEAD 的當舊版基準）。 */
export function readLockAtRef(ref) {
  const text = execFileSync("git", ["show", `${ref}:${LOCK_FILE}`], {
    cwd: PROJECT_ROOT,
    encoding: "utf8",
    windowsHide: true,
    stdio: ["ignore", "pipe", "pipe"],
  });
  return JSON.parse(text);
}

export function releaseUrl(lock) {
  return `https://github.com/${REPO}/releases/download/${lock.tag}/${lock.asset}`;
}

/** 下載 lock 指定的 DB 到 dest，驗過 sha256 才換上（先寫暫存檔，失敗不會弄壞原檔）。 */
export async function downloadLocked(lock, dest) {
  const tmp = `${dest}.download`;
  const res = await fetch(releaseUrl(lock));
  if (!res.ok || !res.body) {
    throw new Error(`下載 ${lock.tag} 失敗：HTTP ${res.status}（Release 是否已發布？）`);
  }
  try {
    await pipeline(Readable.fromWeb(res.body), fs.createWriteStream(tmp));
    const actual = sha256File(tmp);
    if (actual !== lock.sha256) {
      throw new Error(`sha256 不符：預期 ${lock.sha256}，實際 ${actual}`);
    }
    fs.renameSync(tmp, dest);
  } finally {
    fs.rmSync(tmp, { force: true });
  }
}

async function pull(force) {
  const lock = readLock();
  if (!lock) throw new Error(`找不到 ${LOCK_FILE}`);
  if (!force && fs.existsSync(DB_PATH) && sha256File(DB_PATH) === lock.sha256) {
    console.log(`${DB_FILE} 已是 ${lock.tag}，略過下載。`);
    return;
  }
  if (!force && fs.existsSync(DB_PATH)) {
    // 工作區的 DB 跟 lock 不同，可能是還沒 publish 的新版，不要默默蓋掉
    throw new Error(
      `工作區的 ${DB_FILE} 跟 ${LOCK_FILE}（${lock.tag}）不同。\n` +
        `若這是要發布的新版，請跑 npm run db:publish；確定要蓋掉就加 --force。`,
    );
  }
  console.log(`下載 ${lock.tag}（${(lock.size / 1024 / 1024).toFixed(1)} MB）…`);
  await downloadLocked(lock, DB_PATH);
  console.log(`已更新 ${DB_FILE} → ${lock.tag}`);
}

function gh(args) {
  const r = spawnSync("gh", args, { cwd: PROJECT_ROOT, encoding: "utf8", windowsHide: true });
  if (r.error) throw new Error(`無法執行 gh CLI：${r.error.message}`);
  return r;
}

function nextTag() {
  const base = `db-${new Date().toISOString().slice(0, 10)}`;
  for (let n = 1; ; n++) {
    const tag = n === 1 ? base : `${base}-${n}`;
    if (gh(["release", "view", tag, "--repo", REPO]).status !== 0) return tag;
  }
}

function publish() {
  if (!fs.existsSync(DB_PATH)) throw new Error(`找不到 ${DB_FILE}`);
  const sha256 = sha256File(DB_PATH);
  const lock = readLock();
  if (lock?.sha256 === sha256) {
    console.log(`${DB_FILE} 跟 ${LOCK_FILE}（${lock.tag}）相同，不需要發布。`);
    return;
  }
  const tag = nextTag();
  const size = fs.statSync(DB_PATH).size;
  console.log(`上傳 ${DB_FILE} 為 ${tag}（${(size / 1024 / 1024).toFixed(1)} MB）…`);
  const r = gh([
    "release",
    "create",
    tag,
    DB_PATH,
    "--repo",
    REPO,
    "--prerelease",
    "--latest=false",
    "--title",
    tag,
    "--notes",
    `tthol.sqlite 遊戲資料庫\n\nsha256: \`${sha256}\``,
  ]);
  if (r.status !== 0) throw new Error(`gh release create 失敗：${(r.stderr || r.stdout).trim()}`);

  const next = { tag, asset: DB_FILE, sha256, size };
  fs.writeFileSync(LOCK_PATH, JSON.stringify(next, null, 2) + "\n", "utf8");
  console.log(`已發布 ${tag}，並更新 ${LOCK_FILE}。`);
  console.log(`請 commit ${LOCK_FILE}（和 changelog JSON）再 push。`);
  console.log(`線上主機換 DB：curl -fL -o tthol.sqlite ${releaseUrl(next)}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [cmd, ...rest] = process.argv.slice(2);
  const run =
    cmd === "pull" ? () => pull(rest.includes("--force")) : cmd === "publish" ? publish : null;
  if (!run) {
    console.error("用法：node scripts/db-release.mjs <pull [--force]|publish>");
    process.exit(1);
  }
  Promise.resolve()
    .then(run)
    .catch((e) => {
      console.error(e instanceof Error ? e.message : e);
      process.exit(1);
    });
}
