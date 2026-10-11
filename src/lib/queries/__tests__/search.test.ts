import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { getDb } from "@/lib/db";
import { getSearchablePages, NAV_SECTIONS } from "@/lib/site-nav";
import { searchAll, snippetAround } from "../search";

describe("searchAll（真實資料庫）", () => {
  it("空字串與純空白回空結果", () => {
    expect(searchAll("")).toEqual({ query: "", total: 0, groups: [] });
    expect(searchAll("   ")).toEqual({ query: "", total: 0, groups: [] });
  });

  it("易容 的第一組是頁面，且含易容閣", () => {
    const first = searchAll("易容").groups[0];
    expect(first.type).toBe("page");
    expect(first.hits.map((h) => h.href)).toContain("/tools/salon");
  });

  it("易容 找得到道具", () => {
    const items = searchAll("易容").groups.find((g) => g.type === "item")!;
    expect(items.total).toBeGreaterThan(0);
    for (const hit of items.hits) expect(hit.href).toMatch(/^\/items\/\d+$/);
  });

  it("道具說明也會被搜到，排在名稱命中之後並附上命中片段", () => {
    const items = searchAll("赤焰", { type: "item" }).groups[0];
    const crystal = items.hits.find((h) => h.name === "冷伶水晶");
    expect(crystal?.snippet).toContain("赤焰");
    const lastNameHit = items.hits.findLastIndex((h) => h.name.includes("赤焰"));
    expect(items.hits.indexOf(crystal!)).toBeGreaterThan(lastNameHit);
    for (const hit of items.hits.filter((h) => h.name.includes("赤焰"))) {
      expect(hit.snippet).toBeUndefined();
    }
  });

  it("snippetAround 去掉標籤與換行並截出命中處", () => {
    const text = "前言很長很長很長很長很長很長很長很長<FONT COLOR=F80000>赤焰洞</FONT>\\n後面還有很多很多很多很多很多字";
    const s = snippetAround(text, "赤焰");
    expect(s).toContain("赤焰洞 後面");
    expect(s).not.toMatch(/<|\\n/);
    expect(s.startsWith("…")).toBe(true);
  });

  it("道具 meta 顯示中文類型而非原始代碼", () => {
    const items = searchAll("易容").groups.find((g) => g.type === "item")!;
    for (const hit of items.hits) expect(hit.meta).not.toMatch(/^[A-Z_]+$/);
  });

  it("完全同名的道具排在組內第一，total 大於 perType 時 hits 被截斷", () => {
    const names = getDb()
      .prepare("SELECT DISTINCT name FROM items WHERE length(name) BETWEEN 1 AND 2 AND name NOT GLOB '*[0-9]*' ORDER BY length(name), id LIMIT 50")
      .all() as { name: string }[];
    let checked = 0;
    for (const { name } of names) {
      const items = searchAll(name).groups.find((g) => g.type === "item")!;
      if (items.total <= 5) continue;
      expect(items.hits).toHaveLength(5);
      expect(items.hits[0].name).toBe(name);
      checked++;
    }
    expect(checked).toBeGreaterThan(0);
  });

  it("數字查詢會比對道具 id", () => {
    const row = getDb().prepare("SELECT id, name FROM items ORDER BY id LIMIT 1").get() as {
      id: number;
      name: string;
    };
    const items = searchAll(String(row.id)).groups.find((g) => g.type === "item")!;
    expect(items.hits[0]).toMatchObject({ id: String(row.id), href: `/items/${row.id}` });
  });

  it("% 與 _ 單獨輸入不會匹配全部", () => {
    const itemCount = (getDb().prepare("SELECT COUNT(*) AS c FROM items").get() as { c: number })
      .c;
    for (const q of ["%", "_", "\\"]) {
      const items = searchAll(q).groups.find((g) => g.type === "item");
      const literal = (
        getDb()
          .prepare(
            "SELECT COUNT(*) AS c FROM items WHERE instr(name, @q) > 0 OR instr(summary, @q) > 0",
          )
          .get({ q }) as { c: number }
      ).c;
      expect(items?.total ?? 0).toBe(literal);
      expect(items?.total ?? 0).toBeLessThan(itemCount);
    }
  });

  it("▲ 怪物去掉前綴搜尋時視為完全相同（排名 0）", () => {
    const monsters = searchAll("波波鼠", { type: "monster" }).groups[0];
    expect(monsters.hits[0].name).toBe("▲波波鼠");
    expect(monsters.hits[0].href).toMatch(/^\/monsters\/\d+$/);
    // 排名 0 的怪物組要排在只有「包含」命中的道具組前面
    expect(searchAll("波波鼠").groups[0].type).toBe("monster");
  });

  it("type 選項只回該類型，且預設上限較大", () => {
    const result = searchAll("大", { type: "item" });
    expect(result.groups).toHaveLength(1);
    expect(result.groups[0].type).toBe("item");
    expect(result.groups[0].hits.length).toBeGreaterThan(5);
    expect(result.total).toBe(result.groups[0].total);
  });

  it("技能 hit id 為 id:name，連到最低等級", () => {
    const skills = searchAll("", { type: "skill" });
    expect(skills.groups).toEqual([]);
    const hit = searchAll("劍", { type: "skill" }).groups[0].hits[0];
    expect(hit.id).toMatch(/^\d+:/);
    expect(hit.href).toMatch(/^\/skills\/\d+\?level=\d+$/);
  });

  it("查詢字超過 50 字會被截斷", () => {
    expect(searchAll("a".repeat(80)).query).toHaveLength(50);
  });
});

describe("site-nav", () => {
  it("每個入口的 href 都對應到 src/app 底下存在的 page.tsx", () => {
    const entries = [...NAV_SECTIONS.flatMap((s) => s.items), ...getSearchablePages()];
    for (const { href } of entries) {
      const segments = href.split("?")[0].split("/").filter(Boolean);
      const file = path.join(process.cwd(), "src", "app", ...segments, "page.tsx");
      expect(fs.existsSync(file), `${href} → ${file}`).toBe(true);
    }
  });

  it("搜尋用頁面清單依 href 去重", () => {
    const hrefs = getSearchablePages().map((p) => p.href);
    expect(new Set(hrefs).size).toBe(hrefs.length);
  });
});
