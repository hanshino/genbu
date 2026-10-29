import { describe, expect, it } from "vitest";
import dbLock from "../../../db.lock.json";
import coreSitemap from "@/app/sitemap";
import itemsSitemap from "@/app/items/sitemap";
import monstersSitemap from "@/app/monsters/sitemap";
import mapsSitemap from "@/app/maps/sitemap";
import robots from "@/app/robots";
import { isPlaceholderItemName } from "@/lib/placeholder-data";
import { isPlaceholderMonster } from "@/lib/queries/monsters";
import { DATA_LASTMOD, DETAIL_SITEMAP_SEGMENTS } from "@/lib/sitemap";

const idOf = (url: string) => Number(url.split("/").pop());

describe("isPlaceholderItemName", () => {
  it.each(["測試彎刀", "副本獎勵保留", "TEST帽", "", "  ", null])("%s 是佔位道具", (name) =>
    expect(isPlaceholderItemName(name)).toBe(true),
  );

  it.each(["龍躍鳳鳴匕首", "40級究極武盒", "林間精靈"])("%s 不是", (name) =>
    expect(isPlaceholderItemName(name)).toBe(false),
  );
});

describe("DATA_LASTMOD", () => {
  it("取 db.lock.json 標籤的日期", () => {
    const date = /^db-(\d{4}-\d{2}-\d{2})/.exec(dbLock.tag)![1];
    expect(DATA_LASTMOD?.toLocaleDateString("sv-SE", { timeZone: "Asia/Taipei" })).toBe(date);
  });
});

describe("核心 sitemap", () => {
  const entries = coreSitemap();

  it("只放入口頁、攻略與英雄，不含道具、怪物等詳情頁", () => {
    const urls = entries.map((e) => e.url);
    expect(urls).toContain("https://genbu.hanshino.dev/");
    expect(urls).toContain("https://genbu.hanshino.dev/tools/stat-sim");
    expect(urls.some((u) => /\/guides\/dungeon-/.test(u))).toBe(true);
    expect(urls.some((u) => /\/heroes\/\d+$/.test(u))).toBe(true);
    expect(urls.some((u) => /\/(items|monsters|skills|maps)\/\d+$/.test(u))).toBe(false);
    expect(entries.length).toBeLessThan(300);
  });

  it("攻略的 lastmod 用文章的 updated 日期", () => {
    const guide = entries.find((e) => e.url.endsWith("/guides/dungeon-liemo"));
    expect(guide?.lastModified).toBeInstanceOf(Date);
  });
});

describe("詳情頁 sitemap", () => {
  it("道具 sitemap 不含測試／保留道具", () => {
    const ids = new Set(itemsSitemap().map((e) => idOf(e.url)));
    expect(ids.has(22292)).toBe(false); // 測試彎刀
    expect(ids.has(55002)).toBe(true); // 龍躍鳳鳴匕首
    expect(itemsSitemap()[0].lastModified).toEqual(DATA_LASTMOD);
  });

  it("怪物 sitemap 不含佔位怪物", () => {
    const ids = monstersSitemap().map((e) => idOf(e.url));
    expect(ids.length).toBeGreaterThan(0);
    expect(ids.slice(0, 200).some(isPlaceholderMonster)).toBe(false);
  });

  it("地圖 sitemap 不含佔位地圖", () => {
    const ids = new Set(mapsSitemap().map((e) => idOf(e.url)));
    expect(ids.has(233)).toBe(true); // 西湖湖底二層
  });
});

describe("robots.txt", () => {
  it("列出核心與每一段詳情頁 sitemap", () => {
    const { sitemap } = robots();
    expect(sitemap).toEqual([
      "https://genbu.hanshino.dev/sitemap.xml",
      ...DETAIL_SITEMAP_SEGMENTS.map((seg) => `https://genbu.hanshino.dev/${seg}/sitemap.xml`),
    ]);
  });
});
