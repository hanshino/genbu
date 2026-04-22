// 從 Google Sheet 拉座騎/背飾圖片，下載到 public/equipment，
// 並產出 src/lib/generated/equipment-images.json manifest。
//
// 使用： npm run sync:images
//
// Sheet key / gid 與 linebot 專案保持一致；欄位為中文（名稱 / 新版圖片 / 圖片網址）。

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Database from "better-sqlite3";
import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, "..");

const SHEET_KEY = "1I4TjN0yWh72syHHAzLcwkA-l-PKb5KMzev3cdBNsZLE";
const SHEETS = [
  { type: "座騎", gid: "1820863038" },
  { type: "背飾", gid: "1508012721" },
];

const PUBLIC_DIR = path.join(PROJECT_ROOT, "public", "equipment");
const MANIFEST_PATH = path.join(PROJECT_ROOT, "src", "lib", "generated", "equipment-images.json");
const DB_PATH = path.join(PROJECT_ROOT, "tthol.sqlite");

async function fetchSheet({ key, gid }) {
  const qs = new URLSearchParams({ gid, tqx: "out:json", tq: "SELECT *" });
  const url = `https://docs.google.com/spreadsheets/u/0/d/${key}/gviz/tq?${qs.toString()}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`sheet fetch failed: ${res.status} ${res.statusText}`);
  const text = await res.text();
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("sheet response not parseable");
  const json = JSON.parse(match[0]);
  const cols = json.table.cols.map((c) => (c.label && c.label.trim()) || c.id);
  return json.table.rows.map((r) => {
    const row = {};
    r.c.forEach((cell, i) => {
      if (cell == null) return;
      row[cols[i]] = cell.f ?? cell.v;
    });
    return row;
  });
}

async function downloadImage(url) {
  const res = await fetch(url, {
    headers: {
      // 部分 host（uj.com.tw）對 referer 敏感；模擬瀏覽器訪問
      "user-agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36",
      accept: "image/*,*/*;q=0.8",
    },
  });
  if (!res.ok) throw new Error(`download failed: ${res.status} ${res.statusText}`);
  return Buffer.from(await res.arrayBuffer());
}

// 一律轉 JPEG 並統一副檔名，避免 manifest/磁碟因 .jpg/.png 分歧造成 HMR/快取錯亂。
// PNG 透明底會被合成成白背景。
async function toJpeg(buf) {
  const img = sharp(buf, { failOn: "none" }).flatten({ background: "#ffffff" });
  const meta = await img.metadata();
  const out = await img.jpeg({ quality: 85, mozjpeg: true }).toBuffer();
  return { buf: out, width: meta.width ?? null, height: meta.height ?? null };
}

async function main() {
  await fs.mkdir(PUBLIC_DIR, { recursive: true });
  await fs.mkdir(path.dirname(MANIFEST_PATH), { recursive: true });

  // 清掉舊的 public/equipment（避免殘留已移除/改名裝備的舊圖）
  const prev = await fs.readdir(PUBLIC_DIR).catch(() => []);
  for (const f of prev) {
    if (f === ".gitkeep") continue;
    await fs.rm(path.join(PUBLIC_DIR, f));
  }

  const db = new Database(DB_PATH, { readonly: true });
  const items = db.prepare("SELECT id, name, type FROM items WHERE type IN ('座騎', '背飾')").all();
  db.close();

  // (type, name) → item ids
  const byKey = new Map();
  for (const it of items) {
    const key = `${it.type}::${it.name}`;
    if (!byKey.has(key)) byKey.set(key, []);
    byKey.get(key).push(it.id);
  }

  const manifest = {};
  let downloaded = 0;
  let skippedNotFound = 0;
  let skippedNoUrl = 0;
  let failed = 0;

  for (const { type, gid } of SHEETS) {
    const rows = await fetchSheet({ key: SHEET_KEY, gid });
    console.log(`[${type}] fetched ${rows.length} rows from sheet`);

    for (const row of rows) {
      const name = typeof row["名稱"] === "string" ? row["名稱"].trim() : null;
      const url = row["新版圖片"] || row["圖片網址"] || null;
      if (!name) continue;
      if (!url) {
        skippedNoUrl++;
        continue;
      }

      const ids = byKey.get(`${type}::${name}`);
      if (!ids || ids.length === 0) {
        skippedNotFound++;
        console.warn(`  ✗ 「${name}」(${type}) 在 sqlite 找不到 — skip`);
        continue;
      }

      try {
        const raw = await downloadImage(url);
        const { buf, width, height } = await toJpeg(raw);
        const filename = `${ids[0]}.jpg`;
        await fs.writeFile(path.join(PUBLIC_DIR, filename), buf);
        const entry = {
          src: `/equipment/${filename}`,
          width,
          height,
          sourceUrl: url,
        };
        for (const id of ids) manifest[id] = entry;
        downloaded++;
        console.log(
          `  ✓ ${name} (${type}) → ${filename}${width ? ` ${width}×${height}` : ""}${
            ids.length > 1 ? ` (+${ids.length - 1} alias)` : ""
          }`,
        );
      } catch (err) {
        failed++;
        console.error(`  ✗ ${name} (${type}) 下載失敗: ${err.message}`);
      }
    }
  }

  // 固定 key 順序以便 git diff 穩定
  const sorted = Object.fromEntries(
    Object.entries(manifest).sort(([a], [b]) => Number(a) - Number(b)),
  );
  await fs.writeFile(MANIFEST_PATH, JSON.stringify(sorted, null, 2) + "\n", "utf8");

  console.log("");
  console.log(
    `[sync] 下載 ${downloaded}、找不到 ${skippedNotFound}、無圖 ${skippedNoUrl}、失敗 ${failed}`,
  );
  console.log(`[sync] manifest → ${path.relative(PROJECT_ROOT, MANIFEST_PATH)}`);
  console.log(`[sync] 共 ${Object.keys(sorted).length} 個 item id 有圖`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
