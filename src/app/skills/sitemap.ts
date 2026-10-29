import type { MetadataRoute } from "next";
import { getAllSkillIds } from "@/lib/queries/magic";
import { detailEntries } from "@/lib/sitemap";

// 同 app/sitemap.ts：DB 執行期才掛載，必須 force-dynamic。
export const dynamic = "force-dynamic";

export default function sitemap(): MetadataRoute.Sitemap {
  return detailEntries(getAllSkillIds(), (id) => `/skills/${id}`);
}
