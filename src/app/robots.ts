import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/api/", "/login", "/me", "/search"],
    },
    sitemap: "https://genbu.hanshino.dev/sitemap.xml",
  };
}
