import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  getAdjacentGuides,
  getGuide,
  getGuides,
  extractHeadings,
  headingId,
  renderGuideBody,
  toGuideMeta,
  type GuideStage,
} from "../guides";
import { getGuideRef, type GuideRefKind } from "../guide-refs";
import { getItemBoxContents } from "../queries/mission-logic";
import { getMissionDetail } from "../queries/missions";
import { getStepData } from "../guide-steps.server";
import type { StepGroupInput, StepMarkInput } from "../guide-steps";

const CONTENT_DIR = path.join(process.cwd(), "content", "guides");

describe("getGuides", () => {
  it("returns all 9 drafted guides sorted by order", () => {
    const guides = getGuides();
    expect(guides.length).toBe(9);
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

  it("only dungeon guides have category set to dungeon", () => {
    const bySlug = new Map(getGuides().map((g) => [g.slug, g]));
    for (const g of getGuides()) {
      if (DUNGEON_SLUGS.includes(g.slug)) {
        expect(g.category).toBe("dungeon");
      } else {
        expect(g.category).toBeUndefined();
      }
    }
    expect(bySlug.get("dungeon-mistforest")?.order).toBe(7);
    expect(bySlug.get("dungeon-deepforest")?.order).toBe(8);
    expect(bySlug.get("dungeon-sevenstar")?.order).toBe(9);
  });
});

describe("toGuideMeta — reserved slugs", () => {
  it("throws when a guide uses a slug taken by a static /guides route", () => {
    expect(() => toGuideMeta({ slug: "dungeons" }, "", "dungeons.mdx")).toThrow(/保留字/);
  });
});

describe("headingId", () => {
  it("trims and collapses whitespace into hyphens", () => {
    expect(headingId("  這階段你要做什麼  ")).toBe("這階段你要做什麼");
    expect(headingId("foo   bar")).toBe("foo-bar");
  });
});

describe("extractHeadings — merges ## headings with <DungeonStep> tags", () => {
  it("merges h2 and DungeonStep in document order; TOC text is zero-padded n · title", () => {
    const body = `
## 前言

<DungeonStep n={1} title="外圍" stage={1932}>
內文
</DungeonStep>

## 中場休息

<DungeonStep
  n={2}
  title="水源"
  stage={1932}
  crop={[150, 380, 1400, 1380]}
>
內文
</DungeonStep>
`;
    const headings = extractHeadings(body);
    expect(headings.map((h) => h.text)).toEqual(["前言", "01 · 外圍", "中場休息", "02 · 水源"]);
  });

  it("anchor id matches headingId(title), not headingId of the TOC text", () => {
    const body = `<DungeonStep n={3} title="核心之間" stage={1933}>x</DungeonStep>`;
    const headings = extractHeadings(body);
    expect(headings).toEqual([{ id: headingId("核心之間"), text: "03 · 核心之間" }]);
  });

  it("n is zero-padded to 2 digits", () => {
    const body = `<DungeonStep n={9} title="單位數" stage={1}>x</DungeonStep>`;
    expect(extractHeadings(body)[0].text).toBe("09 · 單位數");
  });

  it("props in any order (title before n) still parse", () => {
    const body = `<DungeonStep title="順序反過來" n={5} stage={1}>x</DungeonStep>`;
    expect(extractHeadings(body)[0].text).toBe("05 · 順序反過來");
  });

  it("no DungeonStep tags falls back to plain ## headings (existing behaviour)", () => {
    const body = "## 只有標題\n\n內文";
    expect(extractHeadings(body)).toEqual([{ id: headingId("只有標題"), text: "只有標題" }]);
  });
});

describe("renderGuideBody", () => {
  it("does not turn single tildes in level ranges into strikethrough", async () => {
    const { renderToStaticMarkup } = await import("react-dom/server");
    const el = await renderGuideBody("1~9 等、低自己 2~4 等；~~真刪除線~~", {});
    const html = renderToStaticMarkup(el);
    expect(html).toContain("1~9 等、低自己 2~4 等");
    expect(html.match(/<del>/g)?.length ?? 0).toBe(1);
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

// ── dungeon guide guards ──────────────────────────────────────────────────
//
// D2/D3 hard rules（見 /tmp/opencode/mistforest/plan.md、Lane C 任務說明）：
// prose 不能用數字 id 敘事（同名怪物改用特徵標籤區分）、不能出現「內功」字樣。
// 用「先整段砍掉 <details>…</details>（外形 ID／來源年份合法出現數字的地方），
// 再砍掉剩下所有 JSX/HTML 開合標籤與 URL，才對剩餘純敘事文字抓 4–5 位數字」
// 的順序，避免把 DungeonStep 的 crop/id props、或 <details> 裡合法的外形 ID
// 表格／年份 URL 誤判成違規。

const DUNGEON_SLUGS = ["dungeon-mistforest", "dungeon-deepforest", "dungeon-sevenstar"];

function readDungeonBody(slug: string): string {
  const raw = fs.readFileSync(path.join(CONTENT_DIR, `${slug}.mdx`), "utf8");
  return raw.replace(/^---\n[\s\S]*?\n---\n?/, "");
}

describe.each(DUNGEON_SLUGS)("%s — prose guards (no numeric-id narration, no 內功)", (slug) => {
  const body = readDungeonBody(slug);
  // 1) 先整段砍 <details>…</details>（外形 ID 表格、社群原文年份/URL 允許出現數字）
  // 2) 砍剩下所有標籤（DungeonStep/StepMap 等 props 裡的 id/crop 數字一併清掉）
  // 3) 砍 URL（sourceUrl、社群原文連結裡的 bsn/parent/sn 數字）
  const prose = body
    .replace(/<details>[\s\S]*?<\/details>/g, "")
    .replace(/<[^>]*>/g, " ")
    .replace(/https?:\/\/\S+/g, "");

  it("prose never narrates with bare 4–5 digit numeric ids (years like 20xx are exempt)", () => {
    const hits = [...prose.matchAll(/\b\d{4,5}\b/g)]
      .map((m) => m[0])
      .filter((n) => !/^20\d{2}$/.test(n));
    expect(hits).toEqual([]);
  });

  it("never uses the word 內功 (use 內力 / 外功 instead)", () => {
    expect(prose).not.toContain("內功");
  });

  it("does use 內力 and 外功 to explain defensive traits", () => {
    expect(prose).toContain("內力");
    expect(prose).toContain("外功");
  });
});

// 掃 <DungeonStep n={N} title="…" stage={N} crop={[...]} groups={[...]} marks={[...]}>
// 開場標籤，解出 props（含 JS 陣列/物件字面值），逐一呼叫 getStepData 驗證：
// image 非 null、每個 map!==false 的 group／每個非 tbd 的 mark 至少有 1 個座標點，
// missing 除了允許的 tbd id 之外必須是空陣列。
interface ParsedDungeonStep {
  n: number;
  title: string;
  stage: number;
  crop?: [number, number, number, number];
  groups: StepGroupInput[];
  marks: StepMarkInput[];
}

function parseTagProps(attrsSrc: string): Record<string, unknown> {
  const props: Record<string, unknown> = {};
  const re = /([a-zA-Z][\w-]*)\s*=\s*/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(attrsSrc)) !== null) {
    const name = m[1];
    const idx = re.lastIndex;
    const ch = attrsSrc[idx];
    if (ch === '"' || ch === "'") {
      const quote = ch;
      let end = idx + 1;
      while (end < attrsSrc.length && attrsSrc[end] !== quote) end++;
      props[name] = attrsSrc.slice(idx + 1, end);
      re.lastIndex = end + 1;
    } else if (ch === "{") {
      let depth = 0;
      let end = idx;
      for (; end < attrsSrc.length; end++) {
        if (attrsSrc[end] === "{") depth++;
        else if (attrsSrc[end] === "}") {
          depth--;
          if (depth === 0) {
            end++;
            break;
          }
        }
      }
      const inner = attrsSrc.slice(idx + 1, end - 1);
      // ponytail: 內容都是本檔自己寫的字面陣列/物件（id/tag/as/label/map/tbd），
      // 不是外部輸入；用 Function 求值比手刻一個 mini-JSON parser 划算。
      props[name] = new Function(`return (${inner});`)();
      re.lastIndex = end;
    }
  }
  return props;
}

function parseDungeonSteps(body: string): ParsedDungeonStep[] {
  const steps: ParsedDungeonStep[] = [];
  const re = /<DungeonStep\b([\s\S]*?)>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(body)) !== null) {
    const props = parseTagProps(m[1]);
    steps.push({
      n: Number(props.n),
      title: String(props.title),
      stage: Number(props.stage),
      crop: props.crop as ParsedDungeonStep["crop"],
      groups: (props.groups as StepGroupInput[] | undefined) ?? [],
      marks: (props.marks as StepMarkInput[] | undefined) ?? [],
    });
  }
  return steps;
}

describe.each(DUNGEON_SLUGS)("%s — DungeonStep props resolve via getStepData", (slug) => {
  const steps = parseDungeonSteps(readDungeonBody(slug));

  it("finds exactly 7 DungeonStep tags, numbered 1–7 in order", () => {
    expect(steps.map((s) => s.n)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it.each(steps)(
    "step $n ($title): image non-null, every mapped group/non-tbd mark has ≥1 point, missing only contains allowed tbd ids",
    (step) => {
      const data = getStepData({
        stage: step.stage,
        crop: step.crop,
        groups: step.groups,
        marks: step.marks,
      });

      expect(data.image).not.toBeNull();

      for (const g of data.groups) {
        if (g.map === false) continue;
        expect(g.points.length, `group ${g.key} (tag=${g.tag}) has no map point`).toBeGreaterThan(0);
      }

      const tbdIds = new Set(step.marks.filter((m) => m.tbd).map((m) => m.id));
      for (const mk of data.marks) {
        if (mk.tbd) continue;
        expect(mk.points.length, `mark ${mk.key} (id=${mk.id}) has no map point`).toBeGreaterThan(0);
      }

      const unexpectedMissing = data.missing.filter((id) => !tbdIds.has(id));
      expect(unexpectedMissing, `unexpected missing ids in step ${step.n}`).toEqual([]);
    },
  );
});
