// 從 Google Sheet 拉座騎/背飾圖片「網址」，產出 manifest，前端直接 hotlink。
// 不再下載本地，不再產 /public/equipment 檔案。
//
// 使用： npm run sync:images
//
// Sheet key / gid 與 linebot 專案保持一致；欄位為中文（名稱 / 新版圖片 / 圖片網址）。

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Database from "better-sqlite3";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, "..");

const SHEET_KEY = "1I4TjN0yWh72syHHAzLcwkA-l-PKb5KMzev3cdBNsZLE";
const SHEETS = [
  { type: "座騎", gid: "1820863038" },
  { type: "背飾", gid: "1508012721" },
];

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

async function main() {
  await fs.mkdir(path.dirname(MANIFEST_PATH), { recursive: true });

  const db = new Database(DB_PATH, { readonly: true });
  const items = db.prepare("SELECT id, name, type FROM items WHERE type IN ('座騎', '背飾')").all();
  db.close();

  const byKey = new Map();
  for (const it of items) {
    const key = `${it.type}::${it.name}`;
    if (!byKey.has(key)) byKey.set(key, []);
    byKey.get(key).push(it.id);
  }

  const manifest = {};
  const hostCounts = {};
  let mapped = 0;
  let skippedNotFound = 0;
  let skippedNoUrl = 0;

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

      const entry = { src: url, sourceUrl: url };
      for (const id of ids) manifest[id] = entry;
      mapped++;

      try {
        const host = new URL(url).hostname;
        hostCounts[host] = (hostCounts[host] ?? 0) + 1;
      } catch {
        hostCounts["<invalid>"] = (hostCounts["<invalid>"] ?? 0) + 1;
      }
    }
  }

  const sorted = Object.fromEntries(
    Object.entries(manifest).sort(([a], [b]) => Number(a) - Number(b)),
  );
  await fs.writeFile(MANIFEST_PATH, JSON.stringify(sorted, null, 2) + "\n", "utf8");

  console.log("");
  console.log(`[sync] 對上 ${mapped}、找不到 ${skippedNotFound}、無圖 ${skippedNoUrl}`);
  console.log(`[sync] manifest → ${path.relative(PROJECT_ROOT, MANIFEST_PATH)}`);
  console.log(`[sync] 共 ${Object.keys(sorted).length} 個 item id 有圖`);
  console.log(`[sync] host 分佈：`, hostCounts);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
