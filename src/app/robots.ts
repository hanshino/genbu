import type { MetadataRoute } from "next";
import { BASE_URL, DETAIL_SITEMAP_SEGMENTS } from "@/lib/sitemap";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/api/", "/login", "/me", "/search"],
    },
    sitemap: [
      `${BASE_URL}/sitemap.xml`,
      ...DETAIL_SITEMAP_SEGMENTS.map((seg) => `${BASE_URL}/${seg}/sitemap.xml`),
    ],
  };
}
