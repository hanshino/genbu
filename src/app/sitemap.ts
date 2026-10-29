import type { MetadataRoute } from "next";
import { getAllHeroIds } from "@/lib/queries/heroes";
import { getGuides } from "@/lib/guides";
import { BASE_URL, DATA_LASTMOD, detailEntries } from "@/lib/sitemap";

// tthol.sqlite 是執行期掛載、不在 image 裡：這個路由一定要保持 force-dynamic，
// 不能用 revalidate 或讓它在 build time 靜態產生（build 時查不到 DB 會直接炸）。
export const dynamic = "force-dynamic";

// 這份只放入口頁、攻略與英雄，讓 Google 先抓這些；道具、怪物等詳情頁拆到各段的
// sitemap.xml（見 DETAIL_SITEMAP_SEGMENTS），一起列在 robots.txt。
// data: true 的頁面內容跟著 DB 版本變，lastmod 用 DATA_LASTMOD。
const STATIC_ROUTES: Array<{
  path: string;
  changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"];
  priority: number;
  data?: boolean;
}> = [
  { path: "/", changeFrequency: "daily", priority: 1, data: true },
  { path: "/items", changeFrequency: "daily", priority: 0.8, data: true },
  { path: "/skills", changeFrequency: "weekly", priority: 0.8, data: true },
  { path: "/monsters", changeFrequency: "weekly", priority: 0.8, data: true },
  { path: "/ranking", changeFrequency: "weekly", priority: 0.7, data: true },
  { path: "/compare", changeFrequency: "weekly", priority: 0.5 },
  { path: "/maps", changeFrequency: "weekly", priority: 0.7, data: true },
  { path: "/npcs", changeFrequency: "weekly", priority: 0.6, data: true },
  { path: "/missions", changeFrequency: "weekly", priority: 0.7, data: true },
  { path: "/shops", changeFrequency: "weekly", priority: 0.6, data: true },
  { path: "/compounds", changeFrequency: "weekly", priority: 0.6, data: true },
  { path: "/zhenjie", changeFrequency: "monthly", priority: 0.6, data: true },
  { path: "/heroes", changeFrequency: "weekly", priority: 0.6, data: true },
  { path: "/heroes/team-builder", changeFrequency: "monthly", priority: 0.5 },
  { path: "/achievements", changeFrequency: "weekly", priority: 0.6, data: true },
  { path: "/training-spots", changeFrequency: "weekly", priority: 0.6, data: true },
  { path: "/guides", changeFrequency: "weekly", priority: 0.7 },
  { path: "/guides/dungeons", changeFrequency: "weekly", priority: 0.7 },
  { path: "/tools", changeFrequency: "monthly", priority: 0.6 },
  { path: "/tools/stat-sim", changeFrequency: "monthly", priority: 0.6 },
  { path: "/tools/meridian", changeFrequency: "monthly", priority: 0.6 },
  { path: "/tools/salon", changeFrequency: "monthly", priority: 0.5 },
  { path: "/tools/enhance", changeFrequency: "weekly", priority: 0.5, data: true },
  { path: "/tools/160", changeFrequency: "monthly", priority: 0.5 },
  { path: "/tools/175", changeFrequency: "monthly", priority: 0.5 },
  { path: "/tools/180", changeFrequency: "monthly", priority: 0.5 },
  { path: "/changelog", changeFrequency: "weekly", priority: 0.4, data: true },
  { path: "/about", changeFrequency: "monthly", priority: 0.3 },
  { path: "/legal", changeFrequency: "yearly", priority: 0.2 },
];

export default function sitemap(): MetadataRoute.Sitemap {
  const staticEntries: MetadataRoute.Sitemap = STATIC_ROUTES.map((r) => ({
    url: `${BASE_URL}${r.path}`,
    lastModified: r.data ? DATA_LASTMOD : undefined,
    changeFrequency: r.changeFrequency,
    priority: r.priority,
  }));

  const guideEntries: MetadataRoute.Sitemap = getGuides().map((g) => ({
    url: `${BASE_URL}/guides/${g.slug}`,
    lastModified: new Date(`${g.updated}T00:00:00+08:00`),
    changeFrequency: "monthly",
    priority: 0.6,
  }));

  return [
    ...staticEntries,
    ...guideEntries,
    ...detailEntries(getAllHeroIds(), (id) => `/heroes/${id}`),
  ];
}
