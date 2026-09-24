import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { getAdjacentGuides, getGuide, getGuides, headingId, type GuideStage } from "../guides";
import { getGuideRef, type GuideRefKind } from "../guide-refs";
import { getItemBoxContents } from "../queries/mission-logic";
import { getMissionDetail } from "../queries/missions";

const CONTENT_DIR = path.join(process.cwd(), "content", "guides");

describe("getGuides", () => {
  it("returns all 6 drafted guides sorted by order", () => {
    const guides = getGuides();
    expect(guides.length).toBe(6);
    for (let i = 1; i < guides.length; i++) {
      expect(guides[i].order).toBeGreaterThan(guides[i - 1].order);
    }
  });

  it("every guide has complete required fields", () => {
    const validStages: GuideStage[] = ["beginner", "sub-clan", "advanced", "rebirth", "topic"];
    for (const g of getGuides()) {
      expect(g.slug).toMatch(/^[a-z0-9-]+$/);
      expect(g.title.trim().length).toBeGreaterThan(0);
      expect(validStages).toContain(g.stage);
      expect(g.summary.trim().length).toBeGreaterThan(0);
      expect(Array.isArray(g.unlocks)).toBe(true);
      expect(g.author.trim().length).toBeGreaterThan(0);
      expect(g.updated).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(Number.isInteger(g.order)).toBe(true);
      expect(g.readingMinutes).toBeGreaterThanOrEqual(1);
      if (g.levelMin != null) expect(typeof g.levelMin).toBe("number");
      if (g.levelMax != null) expect(typeof g.levelMax).toBe("number");
    }
  });

  it("has the expected stage per slug (01-04 road, 05/06 topic)", () => {
    const bySlug = new Map(getGuides().map((g) => [g.slug, g]));
    expect(bySlug.get("beginner-1-30")?.stage).toBe("beginner");
    expect(bySlug.get("sub-clan-30-65")?.stage).toBe("sub-clan");
    expect(bySlug.get("advanced-65-100")?.stage).toBe("advanced");
    expect(bySlug.get("rebirth-100-140")?.stage).toBe("rebirth");
    expect(bySlug.get("party-exp")?.stage).toBe("topic");
    expect(bySlug.get("stats-and-market")?.stage).toBe("topic");
  });
});

describe("headingId", () => {
  it("trims and collapses whitespace into hyphens", () => {
    expect(headingId("  這階段你要做什麼  ")).toBe("這階段你要做什麼");
    expect(headingId("foo   bar")).toBe("foo-bar");
  });
});

describe("getGuide", () => {
  it("returns meta, source, and headings for a known slug", () => {
    const guide = getGuide("beginner-1-30");
    expect(guide).not.toBeNull();
    expect(guide!.meta.slug).toBe("beginner-1-30");
    expect(guide!.source).not.toMatch(/^---/); // frontmatter stripped
    expect(guide!.headings.length).toBeGreaterThan(0);
    for (const h of guide!.headings) {
      expect(h.id).toBe(headingId(h.text));
    }
  });

  it("extracts h2 headings matching '## ' lines in body", () => {
    const guide = getGuide("advanced-65-100")!;
    const rawBody = fs.readFileSync(path.join(CONTENT_DIR, "advanced-65-100.mdx"), "utf8");
    const expectedTitles = [...rawBody.matchAll(/^##\s+(.+)$/gm)].map((m) => m[1].trim());
    expect(guide.headings.map((h) => h.text)).toEqual(expectedTitles);
  });

  it("returns null for path traversal attempts", () => {
    expect(getGuide("../etc")).toBeNull();
    expect(getGuide("../../etc/passwd")).toBeNull();
    expect(getGuide("..%2f..%2fetc")).toBeNull();
    expect(getGuide("foo/bar")).toBeNull();
  });

  it("returns null for unknown but well-formed slug", () => {
    expect(getGuide("does-not-exist-guide")).toBeNull();
  });

  it("returns null for slug with uppercase or invalid chars", () => {
    expect(getGuide("Beginner-1-30")).toBeNull();
    expect(getGuide("beginner_1_30")).toBeNull();
  });
});

describe("getAdjacentGuides", () => {
  it("first road stop has null prev and a next", () => {
    const { prev, next } = getAdjacentGuides("beginner-1-30");
    expect(prev).toBeNull();
    expect(next).not.toBeNull();
    expect(next!.slug).toBe("sub-clan-30-65");
  });

  it("last road stop has a prev and null next", () => {
    const { prev, next } = getAdjacentGuides("rebirth-100-140");
    expect(prev).not.toBeNull();
    expect(prev!.slug).toBe("advanced-65-100");
    expect(next).toBeNull();
  });

  it("middle road stop has both prev and next", () => {
    const { prev, next } = getAdjacentGuides("sub-clan-30-65");
    expect(prev!.slug).toBe("beginner-1-30");
    expect(next!.slug).toBe("advanced-65-100");
  });

  it("topic articles return two nulls", () => {
    expect(getAdjacentGuides("party-exp")).toEqual({ prev: null, next: null });
    expect(getAdjacentGuides("stats-and-market")).toEqual({ prev: null, next: null });
  });

  it("unknown slug returns two nulls", () => {
    expect(getAdjacentGuides("does-not-exist")).toEqual({ prev: null, next: null });
  });
});

// 掃 content/guides/*.mdx 裡所有 <Item id={n}>/<Map id={n}>/<Monster id={n}>/<Skill id={n}>/<Mission id={n}> 標籤，
// 確認每一個都能在 DB 中查到對應資料（guide-refs 回傳非 null）。
function scanRefTags(): { kind: GuideRefKind; id: number; file: string }[] {
  const tagRe = /<(Item|Map|Monster|Skill|Mission)\s+id=\{(\d+)\}>/g;
  const kindMap: Record<string, GuideRefKind> = {
    Item: "item",
    Map: "map",
    Monster: "monster",
    Skill: "skill",
    Mission: "mission",
  };
  const refs: { kind: GuideRefKind; id: number; file: string }[] = [];
  for (const file of fs.readdirSync(CONTENT_DIR).filter((f) => f.endsWith(".mdx"))) {
    const content = fs.readFileSync(path.join(CONTENT_DIR, file), "utf8");
    let m: RegExpExecArray | null;
    while ((m = tagRe.exec(content)) !== null) {
      refs.push({ kind: kindMap[m[1]], id: Number(m[2]), file });
    }
  }
  return refs;
}

describe("getGuideRef — every inline tag in content/guides resolves", () => {
  const refs = scanRefTags();

  it("found at least one inline ref tag across all drafts", () => {
    expect(refs.length).toBeGreaterThan(0);
  });

  it.each(refs)("$kind id=$id (from $file) resolves to a non-null ref", ({ kind, id }) => {
    const ref = getGuideRef(kind, id);
    expect(ref).not.toBeNull();
    expect(ref!.id).toBe(id);
    expect(ref!.kind).toBe(kind);
    expect(ref!.name.length).toBeGreaterThan(0);
    expect(ref!.href.startsWith("/")).toBe(true);
  });
});

describe("getGuideRef — unknown ids", () => {
  it("returns null for ids that don't exist in the DB", () => {
    expect(getGuideRef("item", 999999999)).toBeNull();
    expect(getGuideRef("map", 999999999)).toBeNull();
    expect(getGuideRef("monster", 999999999)).toBeNull();
    expect(getGuideRef("skill", 999999999)).toBeNull();
    expect(getGuideRef("mission", 999999999)).toBeNull();
  });

  it("returns null for invalid ids", () => {
    expect(getGuideRef("item", 0)).toBeNull();
    expect(getGuideRef("item", -1)).toBeNull();
    expect(getGuideRef("item", 1.5)).toBeNull();
  });
});

describe("getGuideRef — icon structure", () => {
  // item 24222「新手禮盒」在 tthol.sqlite 的 item_images 有一筆 kind='icon' 記錄
  // （url: https://img.hanshino.dev/zedgr1.png），以此為準斷言非 null。
  it("item 24222 (新手禮盒) has a non-null icon with a non-empty url", () => {
    const ref = getGuideRef("item", 24222);
    expect(ref).not.toBeNull();
    expect(ref!.icon).not.toBeNull();
    expect(ref!.icon!.url.length).toBeGreaterThan(0);
    expect(ref!.icon!.width).toEqual(expect.any(Number));
    expect(ref!.icon!.height).toEqual(expect.any(Number));
  });

  // map/skill/mission 目前 guide-refs 未接圖片查詢，icon 恆為 null。
  it("map/skill/mission refs have null icon (no image query wired up yet)", () => {
    expect(getGuideRef("map", 45)?.icon).toBeNull();
    expect(getGuideRef("skill", 111)?.icon).toBeNull();
    expect(getGuideRef("mission", 801)?.icon).toBeNull();
  });

  // monster 8126（●李大嘴，練功窟怪物）在 npc_images 有圖，驗證 monster kind 也能帶圖。
  it("monster 8126 (●李大嘴) has a non-null icon", () => {
    const ref = getGuideRef("monster", 8126);
    expect(ref).not.toBeNull();
    expect(ref!.icon).not.toBeNull();
    expect(ref!.icon!.url.length).toBeGreaterThan(0);
  });
});

describe("getGuideRef — mission kind", () => {
  it("mission 801 (新手教學／如假似真) resolves with correct href", () => {
    const ref = getGuideRef("mission", 801);
    expect(ref).not.toBeNull();
    expect(ref!.kind).toBe("mission");
    expect(ref!.id).toBe(801);
    expect(ref!.name).toBe("如假似真");
    expect(ref!.href).toBe("/missions/801");
    expect(ref!.facts.length).toBeGreaterThan(0);
  });
});

// 掃 content/guides/*.mdx 裡所有 <BoxContents id={n}> / <MissionCard id={n}> 標籤，
// 確認每個 id 背後的資料都存在（禮盒有內容物、任務查得到），避免 @designer 元件渲染出空殼。
function scanBoxAndMissionCardTags(): { component: "BoxContents" | "MissionCard"; id: number; file: string }[] {
  const tagRe = /<(BoxContents|MissionCard)\s+id=\{(\d+)\}/g;
  const refs: { component: "BoxContents" | "MissionCard"; id: number; file: string }[] = [];
  for (const file of fs.readdirSync(CONTENT_DIR).filter((f) => f.endsWith(".mdx"))) {
    const content = fs.readFileSync(path.join(CONTENT_DIR, file), "utf8");
    let m: RegExpExecArray | null;
    while ((m = tagRe.exec(content)) !== null) {
      refs.push({ component: m[1] as "BoxContents" | "MissionCard", id: Number(m[2]), file });
    }
  }
  return refs;
}

describe("<BoxContents>/<MissionCard> tags in content/guides resolve to real data", () => {
  const tags = scanBoxAndMissionCardTags();

  it("found at least one BoxContents and one MissionCard tag", () => {
    expect(tags.some((t) => t.component === "BoxContents")).toBe(true);
    expect(tags.some((t) => t.component === "MissionCard")).toBe(true);
  });

  it.each(tags.filter((t) => t.component === "BoxContents"))(
    "BoxContents id=$id (from $file): getItemBoxContents returns non-empty options",
    ({ id }) => {
      expect(getItemBoxContents(id).length).toBeGreaterThan(0);
    },
  );

  it.each(tags.filter((t) => t.component === "MissionCard"))(
    "MissionCard id=$id (from $file): getMissionDetail is non-null",
    ({ id }) => {
      expect(getMissionDetail(id)).not.toBeNull();
    },
  );
});
