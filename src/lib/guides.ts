// ponytail: 不引入 server-only 套件——repo 內其他 server-only 模組（db.ts 等）
// 也是靠「只在 Server Component / Route Handler 使用」的慣例把關，這裡跟隨同樣模式。
import fs from "node:fs";
import path from "node:path";
import * as yaml from "js-yaml";
import remarkGfm from "remark-gfm";
import remarkCjkFriendly from "remark-cjk-friendly";
import { compileMDX } from "next-mdx-remote/rsc";
import type { MDXComponents } from "mdx/types";
import type { ReactElement } from "react";

export type GuideStage = "beginner" | "sub-clan" | "advanced" | "rebirth" | "topic";

export interface GuideMeta {
  slug: string;
  title: string;
  stage: GuideStage;
  levelMin: number | null;
  levelMax: number | null;
  order: number;
  summary: string;
  unlocks: string[];
  author: string;
  sourceUrl?: string;
  /** YYYY-MM-DD */
  updated: string;
  /** 由內文字數估算，中文約 400 字/分鐘，最少 1。 */
  readingMinutes: number;
  /** 迷宮攻略分類；未指定時視為一般路線文章（不進「迷宮攻略」區塊）。 */
  category?: "dungeon";
}

export interface GuideHeading {
  id: string;
  text: string;
}

const CONTENT_DIR = path.join(process.cwd(), "content", "guides");
const SLUG_RE = /^[a-z0-9-]+$/;
// 跟 src/app/guides/ 底下的靜態路由撞名的 slug（靜態路由會蓋掉 [slug]，文章會永遠打不開）
const RESERVED_SLUGS: readonly string[] = ["dungeons"];
const VALID_STAGES: readonly GuideStage[] = [
  "beginner",
  "sub-clan",
  "advanced",
  "rebirth",
  "topic",
];

/** h2 元件與 TOC 共用：把標題文字轉成穩定的 anchor id。 */
export function headingId(text: string): string {
  return text.trim().replace(/\s+/g, "-");
}

interface RawFrontmatter {
  title?: unknown;
  slug?: unknown;
  stage?: unknown;
  levelMin?: unknown;
  levelMax?: unknown;
  order?: unknown;
  summary?: unknown;
  unlocks?: unknown;
  author?: unknown;
  sourceUrl?: unknown;
  updated?: unknown;
  category?: unknown;
}

function requireField<T>(
  fm: RawFrontmatter,
  key: keyof RawFrontmatter,
  filename: string,
  check: (v: unknown) => v is T,
): T {
  const v = fm[key];
  if (!check(v)) {
    throw new Error(`content/guides/${filename}: frontmatter 缺少或型別錯誤的欄位 "${String(key)}"`);
  }
  return v;
}

function isNonEmptyString(v: unknown): v is string {
  return typeof v === "string" && v.trim().length > 0;
}

function isStringArray(v: unknown): v is string[] {
  return Array.isArray(v) && v.every((x) => typeof x === "string");
}

function isNumber(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

function isNullableNumber(v: unknown): v is number | null {
  return v === null || v === undefined || isNumber(v);
}

function isStage(v: unknown): v is GuideStage {
  return typeof v === "string" && (VALID_STAGES as readonly string[]).includes(v);
}

function isDateString(v: unknown): v is string {
  return typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);
}

// 中文估算：約 400 字/分鐘，最少 1 分鐘。以「本文去掉 markdown 語法字元後的字數」概算即可。
function estimateReadingMinutes(source: string): number {
  const stripped = source
    .replace(/```[\s\S]*?```/g, "")
    .replace(/<[^>]+>/g, "")
    .replace(/[#*_>|~`[\]()-]/g, "")
    .replace(/\s+/g, "");
  const minutes = Math.round(stripped.length / 400);
  return Math.max(1, minutes);
}

function parseFrontmatter(raw: string, filename: string): { fm: RawFrontmatter; body: string } {
  const match = raw.match(/^---\n([\s\S]*?)\n---\n?/);
  if (!match) {
    throw new Error(`content/guides/${filename}: 缺少 frontmatter block`);
  }
  const fm = (yaml.load(match[1]) ?? {}) as RawFrontmatter;
  const body = raw.slice(match[0].length);
  return { fm, body };
}

/** export 給測試直接呼叫（驗 frontmatter 規則，例如保留 slug）；非公開契約。 */
export function toGuideMeta(fm: RawFrontmatter, body: string, filename: string): GuideMeta {
  const slug = requireField(fm, "slug", filename, isNonEmptyString);
  if (!SLUG_RE.test(slug)) {
    throw new Error(`content/guides/${filename}: slug "${slug}" 不符合 /^[a-z0-9-]+$/`);
  }
  if (RESERVED_SLUGS.includes(slug)) {
    throw new Error(`content/guides/${filename}: slug "${slug}" 是保留字（已被 /guides/${slug} 頁面使用）`);
  }
  const title = requireField(fm, "title", filename, isNonEmptyString);
  const stage = requireField(fm, "stage", filename, isStage);
  const levelMin = isNullableNumber(fm.levelMin) ? (fm.levelMin ?? null) : requireField(fm, "levelMin", filename, isNullableNumber);
  const levelMax = isNullableNumber(fm.levelMax) ? (fm.levelMax ?? null) : requireField(fm, "levelMax", filename, isNullableNumber);
  const order = requireField(fm, "order", filename, isNumber);
  const summary = requireField(fm, "summary", filename, isNonEmptyString);
  const unlocks = requireField(fm, "unlocks", filename, isStringArray);
  const author = requireField(fm, "author", filename, isNonEmptyString);
  const updated = requireField(fm, "updated", filename, isDateString);
  const sourceUrl = fm.sourceUrl;
  if (sourceUrl !== undefined && !isNonEmptyString(sourceUrl)) {
    throw new Error(`content/guides/${filename}: frontmatter "sourceUrl" 型別錯誤`);
  }
  if (fm.category !== undefined && fm.category !== "dungeon") {
    throw new Error(`content/guides/${filename}: frontmatter "category" 只能是 "dungeon" 或省略`);
  }
  const category = fm.category === "dungeon" ? ("dungeon" as const) : undefined;

  return {
    slug,
    title,
    stage,
    levelMin,
    levelMax,
    order,
    summary,
    unlocks,
    author,
    ...(sourceUrl ? { sourceUrl } : {}),
    updated,
    readingMinutes: estimateReadingMinutes(body),
    ...(category ? { category } : {}),
  };
}

/**
 * 掃 body 找 h2（`## ` 開頭）與 `<DungeonStep n={N} ... title="…">` 開場標籤，
 * 依文件中出現順序合併成目錄。DungeonStep 的 TOC 文字＝`{n 補零 2 位} · {title}`，
 * anchor id 跟 dungeon-step.tsx 的 h2 id 對齊（同用 headingId(title)）。
 * export 給測試直接呼叫（避免透過 fixture .mdx 檔間接測，content/guides 現有 6 篇
 * 不想為了這個測試多長一篇）；非公開契約，@designer 不需要引用它。
 */
export function extractHeadings(body: string): GuideHeading[] {
  type Hit = { index: number; heading: GuideHeading };
  const hits: Hit[] = [];

  const h2Re = /^##\s+(.+)$/gm;
  let m: RegExpExecArray | null;
  while ((m = h2Re.exec(body)) !== null) {
    const text = m[1].trim();
    hits.push({ index: m.index, heading: { id: headingId(text), text } });
  }

  // <DungeonStep n={2} title="外圍" stage={1932} ... > — props 可能跨行、順序不定，
  // 只掃到第一個 attrs 內未出現 "/>" 的 ">"（DungeonStep 一定有 children，非自閉合標籤，
  // 且 props 值本身不含裸的 ">"）。TOC 文字＝零填 2 位的 n ＋ "· " ＋ title；
  // anchor id 與 dungeon-step.tsx 的 h2 id 對齊（同用 headingId(title)）。
  const stepRe = /<DungeonStep\b([\s\S]*?)>/g;
  while ((m = stepRe.exec(body)) !== null) {
    const attrs = m[1];
    const nMatch = attrs.match(/\bn=\{?\s*["']?(\d+)["']?\s*\}?/);
    const titleMatch = attrs.match(/\btitle=(?:"([^"]*)"|\{`([^`]*)`\}|\{'([^']*)'\})/);
    if (!nMatch || !titleMatch) continue;
    const title = (titleMatch[1] ?? titleMatch[2] ?? titleMatch[3] ?? "").trim();
    const seal = nMatch[1].padStart(2, "0");
    hits.push({ index: m.index, heading: { id: headingId(title), text: `${seal} · ${title}` } });
  }

  hits.sort((a, b) => a.index - b.index);
  return hits.map((h) => h.heading);
}

function listContentFiles(): string[] {
  if (!fs.existsSync(CONTENT_DIR)) return [];
  return fs.readdirSync(CONTENT_DIR).filter((f) => f.endsWith(".mdx"));
}

let cachedMetas: GuideMeta[] | null = null;

/** 依 order 排序的全部攻略 meta。 */
export function getGuides(): GuideMeta[] {
  if (cachedMetas) return cachedMetas;
  const metas: GuideMeta[] = [];
  for (const filename of listContentFiles()) {
    const raw = fs.readFileSync(path.join(CONTENT_DIR, filename), "utf8");
    const { fm, body } = parseFrontmatter(raw, filename);
    metas.push(toGuideMeta(fm, body, filename));
  }
  metas.sort((a, b) => a.order - b.order);
  cachedMetas = metas;
  return metas;
}

/**
 * 讀取單篇攻略。slug 需符合 /^[a-z0-9-]+$/，避免 path traversal；
 * 不合法或找不到對應檔案一律回 null。
 */
export function getGuide(
  slug: string,
): { meta: GuideMeta; source: string; headings: GuideHeading[] } | null {
  if (!SLUG_RE.test(slug)) return null;
  const filePath = path.join(CONTENT_DIR, `${slug}.mdx`);
  if (!fs.existsSync(filePath)) return null;
  const raw = fs.readFileSync(filePath, "utf8");
  const { fm, body } = parseFrontmatter(raw, `${slug}.mdx`);
  const meta = toGuideMeta(fm, body, `${slug}.mdx`);
  const headings = extractHeadings(body);
  return { meta, source: body, headings };
}

/**
 * 只在非 topic 的路線文章之間依 order 走；topic 文章（或找不到對應 slug）回傳兩個 null。
 */
export function getAdjacentGuides(slug: string): {
  prev: GuideMeta | null;
  next: GuideMeta | null;
} {
  const guides = getGuides();
  const current = guides.find((g) => g.slug === slug);
  if (!current || current.stage === "topic") return { prev: null, next: null };

  const roadStops = guides.filter((g) => g.stage !== "topic").sort((a, b) => a.order - b.order);
  const index = roadStops.findIndex((g) => g.slug === slug);
  if (index === -1) return { prev: null, next: null };

  return {
    prev: index > 0 ? roadStops[index - 1] : null,
    next: index < roadStops.length - 1 ? roadStops[index + 1] : null,
  };
}

/** 包 next-mdx-remote/rsc 的 compileMDX + remark-gfm。 */
export async function renderGuideBody(
  source: string,
  components: MDXComponents,
): Promise<ReactElement> {
  const { content } = await compileMDX({
    source,
    components,
    options: {
      // ponytail: 內容全是 repo 內自己寫的 .mdx，允許 JS 表達式才能用 id={123} 這種屬性；
      // 若日後開放外部投稿，要改回 blockJS: true 並把 id 改成字串屬性。
      blockJS: false,
      mdxOptions: {
        // 等級區間常寫成「1~9」，單個 ~ 不能當刪除線；要刪除線請用 ~~文字~~
        // remark-cjk-friendly: 修正 `點**「X」**拿` 這類 CJK 標點旁的粗體不生效
        remarkPlugins: [[remarkGfm, { singleTilde: false }], remarkCjkFriendly],
      },
    },
  });
  return content;
}
