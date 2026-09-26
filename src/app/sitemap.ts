import type { MetadataRoute } from "next";
import { getAllItemIds } from "@/lib/queries/items";
import { getAllSkillIds } from "@/lib/queries/magic";
import { getAllMonsterIds } from "@/lib/queries/monsters";
import { getAllStageIds } from "@/lib/queries/stages";
import { getAllShopIds } from "@/lib/queries/shops";
import { getAllMissionIds } from "@/lib/queries/missions";
import { getAllCompoundGroupIds } from "@/lib/queries/compound";
import { getAllHeroIds } from "@/lib/queries/heroes";
import { getGuides } from "@/lib/guides";

// tthol.sqlite 是執行期掛載、不在 image 裡：這個路由一定要保持 force-dynamic，
// 不能用 revalidate 或讓它在 build time 靜態產生（build 時查不到 DB 會直接炸）。
export const dynamic = "force-dynamic";

const BASE_URL = "https://genbu.hanshino.dev";

const STATIC_ROUTES: Array<{
  path: string;
  changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"];
  priority: number;
}> = [
  { path: "/", changeFrequency: "daily", priority: 1 },
  { path: "/items", changeFrequency: "daily", priority: 0.8 },
  { path: "/skills", changeFrequency: "weekly", priority: 0.8 },
  { path: "/monsters", changeFrequency: "weekly", priority: 0.8 },
  { path: "/ranking", changeFrequency: "weekly", priority: 0.7 },
  { path: "/compare", changeFrequency: "weekly", priority: 0.5 },
  { path: "/maps", changeFrequency: "weekly", priority: 0.7 },
  { path: "/missions", changeFrequency: "weekly", priority: 0.7 },
  { path: "/shops", changeFrequency: "weekly", priority: 0.6 },
  { path: "/compounds", changeFrequency: "weekly", priority: 0.6 },
  { path: "/heroes", changeFrequency: "weekly", priority: 0.6 },
  { path: "/heroes/team-builder", changeFrequency: "monthly", priority: 0.5 },
  { path: "/achievements", changeFrequency: "weekly", priority: 0.6 },
  { path: "/training-spots", changeFrequency: "weekly", priority: 0.6 },
  { path: "/guides", changeFrequency: "weekly", priority: 0.6 },
  { path: "/guides/dungeons", changeFrequency: "weekly", priority: 0.6 },
  { path: "/tools", changeFrequency: "monthly", priority: 0.6 },
  { path: "/tools/160", changeFrequency: "monthly", priority: 0.5 },
  { path: "/tools/175", changeFrequency: "monthly", priority: 0.5 },
  { path: "/tools/180", changeFrequency: "monthly", priority: 0.5 },
  { path: "/tools/enhance", changeFrequency: "weekly", priority: 0.5 },
  { path: "/changelog", changeFrequency: "weekly", priority: 0.4 },
  { path: "/about", changeFrequency: "monthly", priority: 0.3 },
];

function detailEntries(
  ids: readonly number[],
  toPath: (id: number) => string,
): MetadataRoute.Sitemap {
  return ids.map((id) => ({
    url: `${BASE_URL}${toPath(id)}`,
    changeFrequency: "monthly",
    priority: 0.5,
  }));
}

export default function sitemap(): MetadataRoute.Sitemap {
  const staticEntries: MetadataRoute.Sitemap = STATIC_ROUTES.map((r) => ({
    url: `${BASE_URL}${r.path}`,
    changeFrequency: r.changeFrequency,
    priority: r.priority,
  }));

  const guideEntries: MetadataRoute.Sitemap = getGuides().map((g) => ({
    url: `${BASE_URL}/guides/${g.slug}`,
    changeFrequency: "monthly",
    priority: 0.5,
  }));

  return [
    ...staticEntries,
    ...detailEntries(getAllItemIds(), (id) => `/items/${id}`),
    ...detailEntries(getAllSkillIds(), (id) => `/skills/${id}`),
    ...detailEntries(getAllMonsterIds(), (id) => `/monsters/${id}`),
    ...detailEntries(getAllStageIds(), (id) => `/maps/${id}`),
    ...detailEntries(getAllShopIds(), (id) => `/shops/${id}`),
    ...detailEntries(getAllMissionIds(), (id) => `/missions/${id}`),
    ...detailEntries(getAllCompoundGroupIds(), (id) => `/compounds/${id}`),
    ...detailEntries(getAllHeroIds(), (id) => `/heroes/${id}`),
    ...guideEntries,
  ];
}
