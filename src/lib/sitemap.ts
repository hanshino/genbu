import type { MetadataRoute } from "next";
import dbLock from "../../db.lock.json";

export const BASE_URL = "https://genbu.hanshino.dev";

/** 詳情頁 sitemap 的路徑，robots.txt 與各段 sitemap.ts 共用同一份清單。 */
export const DETAIL_SITEMAP_SEGMENTS = [
  "items",
  "skills",
  "monsters",
  "maps",
  "missions",
  "shops",
  "compounds",
] as const;

/**
 * 遊戲資料頁的 lastmod：取 db.lock.json 的 Release 標籤日期（db-YYYY-MM-DD[-n]）。
 * 執行期掛載的 DB 跟著部署的 commit 走，這個日期就是目前資料的版本。
 */
export const DATA_LASTMOD: Date | undefined = (() => {
  const m = /^db-(\d{4}-\d{2}-\d{2})/.exec(dbLock.tag);
  return m ? new Date(`${m[1]}T00:00:00+08:00`) : undefined;
})();

export function detailEntries(
  ids: readonly number[],
  toPath: (id: number) => string,
): MetadataRoute.Sitemap {
  return ids.map((id) => ({
    url: `${BASE_URL}${toPath(id)}`,
    lastModified: DATA_LASTMOD,
    changeFrequency: "monthly",
    priority: 0.5,
  }));
}
