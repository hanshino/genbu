import type { MetadataRoute } from "next";
import { getAllShopIds } from "@/lib/queries/shops";
import { detailEntries } from "@/lib/sitemap";

// 同 app/sitemap.ts：DB 執行期才掛載，必須 force-dynamic。
export const dynamic = "force-dynamic";

export default function sitemap(): MetadataRoute.Sitemap {
  return detailEntries(getAllShopIds(), (id) => `/shops/${id}`);
}
