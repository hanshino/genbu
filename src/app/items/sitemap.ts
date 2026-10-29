import type { MetadataRoute } from "next";
import { getAllItemIds } from "@/lib/queries/items";
import { detailEntries } from "@/lib/sitemap";

// 同 app/sitemap.ts：DB 執行期才掛載，必須 force-dynamic。
export const dynamic = "force-dynamic";

export default function sitemap(): MetadataRoute.Sitemap {
  return detailEntries(getAllItemIds(), (id) => `/items/${id}`);
}
