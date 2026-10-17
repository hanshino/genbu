// 摸魚練功房的場景背景：從整張地圖裁出一塊空曠沙地，存成 public/idle/backdrop-stage147.webp。
// 整張地圖是 8800x8400、約 5 MB 的 webp，瀏覽器只需要其中 1000x280 的一塊。
//
// 使用： node scripts/crop-idle-backdrop.mjs [來源網址或本機檔案]
//
// 來源：tthol.sqlite 的 map_images（stage_kind = 'stage', stage_id = 147，雷島南˙淺灘）。
// 裁切：左上角 (6010, 3010)，寬 1000、高 280（地圖像素）。這個範圍是純沙地，下緣與右緣是海，
//      所以只取這一塊左上角；場景把它左右鏡射接起來捲動，不會出現海面。
// 改動裁切範圍時，要同步改 src/components/idle/scene-draw.ts 的 BACKDROP_SIZE 與 public 檔名。

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const SOURCE = process.argv[2] ?? "https://img.hanshino.dev/5y8xs3.webp";
const CROP = { left: 6010, top: 3010, width: 1000, height: 280 };
const OUT = path.join(PROJECT_ROOT, "public", "idle", "backdrop-stage147.webp");

async function load(source) {
  if (/^https?:\/\//.test(source)) {
    const res = await fetch(source);
    if (!res.ok) throw new Error(`下載失敗：${res.status} ${res.statusText}`);
    return Buffer.from(await res.arrayBuffer());
  }
  return fs.readFile(source);
}

const input = await load(SOURCE);
const meta = await sharp(input).metadata();
if (meta.width < CROP.left + CROP.width || meta.height < CROP.top + CROP.height) {
  throw new Error(`來源圖 ${meta.width}x${meta.height} 比裁切範圍小`);
}
await fs.mkdir(path.dirname(OUT), { recursive: true });
// 場景用 pixelated 的方式放大，細節不能糊掉，所以品質開高。
const info = await sharp(input).extract(CROP).webp({ quality: 90, effort: 6 }).toFile(OUT);
console.log(
  `${path.relative(PROJECT_ROOT, OUT)}  ${info.width}x${info.height}  ${(info.size / 1024).toFixed(1)} KB`,
);
