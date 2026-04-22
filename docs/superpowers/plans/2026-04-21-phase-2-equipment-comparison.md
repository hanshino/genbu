# Phase 2 — Equipment Comparison Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the Phase 2 equipment comparison features — weighted ranking (`/ranking`), N-item comparison (`/compare`), and item-detail enhancements for 座騎/背飾 — while reserving a clean Phase 2.5 extension point for rule-based item tags.

**Architecture:** Pure-function scoring module (`src/lib/scoring/*`) consumed by Server Components that hydrate Client Components. Data is fetched per-type at page render, all scoring / filtering / sorting happens client-side for instant weight-editor feedback. URL query string is the single source of truth for sharable state; localStorage is only used for "我的配方" and the compare tray.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Tailwind 4, shadcn/ui + @base-ui/react, better-sqlite3 (read-only). Adds `vitest` + `@testing-library/react` for unit tests.

**Spec reference:** `docs/superpowers/specs/2026-04-21-phase-2-equipment-comparison-design.md`

---

## File Map

**Created:**

- `vitest.config.ts`, `vitest.setup.ts`
- `src/lib/scoring/types.ts`
- `src/lib/scoring/attribute-alias.ts`
- `src/lib/scoring/random-expected.ts`
- `src/lib/scoring/score.ts`
- `src/lib/scoring/presets.ts`
- `src/lib/scoring/index.ts`
- `src/lib/classifier/types.ts`
- `src/lib/classifier/index.ts`
- `src/lib/hooks/use-compare-tray.ts`
- `src/lib/hooks/use-custom-presets.ts`
- `src/configs/weighted.ts`
- `src/components/items/stat-bar-chart.tsx`
- `src/components/items/item-tags.tsx`
- `src/components/items/compare-button.tsx`
- `src/components/ranking/preset-selector.tsx`
- `src/components/ranking/weight-editor.tsx`
- `src/components/ranking/level-range.tsx`
- `src/components/ranking/threshold-filters.tsx`
- `src/components/ranking/ranking-table.tsx`
- `src/components/compare/item-picker.tsx`
- `src/components/compare/compare-matrix.tsx`
- `src/components/compare/compare-presets.tsx`
- `src/components/compare/compare-bar.tsx`
- `src/app/ranking/page.tsx`
- `src/app/ranking/ranking-client.tsx`
- `src/app/compare/page.tsx`
- `src/app/compare/compare-client.tsx`
- Plus `__tests__` companion files for each scoring module.

**Modified:**

- `package.json` — add vitest, testing-library
- `src/lib/queries/items.ts` — add `getItemsByType`, `getItemsByIds`, `getItemRandsByIds`
- `src/components/layout/navbar.tsx` — add Ranking/Compare links
- `src/app/items/[id]/page.tsx` — render CompareButton, StatBarChart, ItemTags for 座騎/背飾

---

## Task 1: Add test infrastructure (vitest)

**Files:**

- Create: `vitest.config.ts`
- Create: `vitest.setup.ts`
- Modify: `package.json`

- [ ] **Step 1: Install vitest and testing-library**

Run:

```bash
npm install -D vitest @vitejs/plugin-react jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event
```

- [ ] **Step 2: Create `vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    globals: true,
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
```

- [ ] **Step 3: Create `vitest.setup.ts`**

```ts
import "@testing-library/jest-dom/vitest";
```

- [ ] **Step 4: Add scripts to `package.json`**

Edit `package.json` scripts section to add:

```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 5: Smoke-test the runner**

Create `src/lib/__tests__/sanity.test.ts`:

```ts
import { describe, it, expect } from "vitest";
describe("vitest sanity", () => {
  it("runs", () => {
    expect(1 + 1).toBe(2);
  });
});
```

Run: `npm test`
Expected: PASS with 1 test.

Delete `src/lib/__tests__/sanity.test.ts` after verification.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json vitest.config.ts vitest.setup.ts
git commit -m "chore: add vitest + testing-library for phase 2"
```

---

## Task 2: Scoring types

**Files:**

- Create: `src/lib/scoring/types.ts`

- [ ] **Step 1: Write the type module**

Create `src/lib/scoring/types.ts`:

```ts
import type { Item, ItemRand } from "@/lib/types/item";

// A single attribute key → weight mapping. Keys are DB column names
// (e.g., "str", "atk", "dex"). Missing keys are treated as weight 0.
export type Weights = Record<string, number>;

export interface Preset {
  id: string;
  label: string;
  weights: Weights;
  // Reserved for future: presets may declare which item types they apply to.
  // Phase 2 leaves this undefined (applies to all types).
  applicableTypes?: readonly string[];
}

export interface ScoredItem {
  item: Item;
  baseScore: number; // fixed-attr-only score
  score: number; // baseScore + random expected contribution
  expectedRandom: Record<string, number>; // per-attribute expected value
}

// Item together with its item_rand rows, ready to be scored.
export interface ItemWithRands {
  item: Item;
  rands: ItemRand[];
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/scoring/types.ts
git commit -m "feat(scoring): add type definitions for Weights, Preset, ScoredItem"
```

---

## Task 3: Attribute alias reverse lookup (TDD)

**Files:**

- Create: `src/lib/scoring/attribute-alias.ts`
- Test: `src/lib/scoring/__tests__/attribute-alias.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/scoring/__tests__/attribute-alias.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { labelToKey, knownRandLabels } from "../attribute-alias";

describe("labelToKey", () => {
  it("resolves every rand attribute label observed in production data", () => {
    // Labels actually present in item_rand for 座騎+背飾 (measured from DB)
    const observed = [
      "內力",
      "內勁",
      "外功",
      "技巧",
      "根骨",
      "物攻",
      "玄學",
      "真氣",
      "護勁",
      "身法",
      "重擊",
      "防禦",
      "體力",
    ];
    for (const label of observed) {
      expect(labelToKey(label), `${label} should resolve`).not.toBeNull();
    }
  });

  it("maps 外功 → str", () => {
    expect(labelToKey("外功")).toBe("str");
  });
  it("maps 技巧 → dex", () => {
    expect(labelToKey("技巧")).toBe("dex");
  });
  it("maps 內力 → pow", () => {
    expect(labelToKey("內力")).toBe("pow");
  });
  it("maps 物攻 → atk", () => {
    expect(labelToKey("物攻")).toBe("atk");
  });
  it("returns null for unknown labels", () => {
    expect(labelToKey("中二屬性")).toBeNull();
  });

  it("exposes the full set of known labels for docs/diagnostics", () => {
    expect(knownRandLabels.length).toBeGreaterThan(10);
    expect(knownRandLabels).toContain("外功");
  });
});
```

- [ ] **Step 2: Run test, verify it fails**

Run: `npm test -- attribute-alias`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Implement `attribute-alias.ts`**

Create `src/lib/scoring/attribute-alias.ts`:

```ts
import { itemAttributeNames } from "@/lib/constants/i18n";

// Reverse map: 中文標籤 → DB column key
const labelToKeyMap: ReadonlyMap<string, string> = new Map(
  Object.entries(itemAttributeNames).map(([key, label]) => [label, key]),
);

export function labelToKey(label: string): string | null {
  return labelToKeyMap.get(label) ?? null;
}

export const knownRandLabels: readonly string[] = Array.from(labelToKeyMap.keys());
```

- [ ] **Step 4: Run test, verify it passes**

Run: `npm test -- attribute-alias`
Expected: PASS (all cases).

- [ ] **Step 5: Commit**

```bash
git add src/lib/scoring/attribute-alias.ts src/lib/scoring/__tests__/attribute-alias.test.ts
git commit -m "feat(scoring): reverse lookup for item_rand attribute labels"
```

---

## Task 4: Random-attribute expected value (TDD)

**Files:**

- Create: `src/lib/scoring/random-expected.ts`
- Test: `src/lib/scoring/__tests__/random-expected.test.ts`

- [ ] **Step 1: Write failing tests**

Create `src/lib/scoring/__tests__/random-expected.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { expectedRandom } from "../random-expected";
import type { ItemRand } from "@/lib/types/item";

const mkRand = (attr: string, min: number, max: number, rate: number): ItemRand => ({
  id: "1",
  attribute: attr,
  min,
  max,
  rate,
});

describe("expectedRandom", () => {
  it("returns empty object when there are no rand rows", () => {
    expect(expectedRandom([])).toEqual({});
  });

  it("matches the spec example for item 22074 (外功 4.06)", () => {
    // From spec §3.2: 外功 with (3~5 @ rate 970000) and (6~6 @ rate 30000)
    // totalRate = 1_000_000
    // E[str] = 4 * 0.97 + 6 * 0.03 = 3.88 + 0.18 = 4.06
    const rands = [mkRand("外功", 3, 5, 970000), mkRand("外功", 6, 6, 30000)];
    const e = expectedRandom(rands);
    expect(e.str).toBeCloseTo(4.06, 4);
  });

  it("handles multiple attributes within a single item", () => {
    // item has both 外功 and 技巧 random pools; each is guaranteed for this
    // item (it rolls one of each), so totalRate spans both attributes.
    const rands = [
      mkRand("外功", 2, 4, 500000), // E[str contribution] = 3 * 0.5 = 1.5
      mkRand("技巧", 1, 3, 500000), // E[dex contribution] = 2 * 0.5 = 1.0
    ];
    const e = expectedRandom(rands);
    expect(e.str).toBeCloseTo(1.5, 4);
    expect(e.dex).toBeCloseTo(1.0, 4);
  });

  it("ignores unknown attribute labels (does not throw)", () => {
    const rands = [mkRand("外功", 1, 3, 500000), mkRand("虛構屬性", 1, 3, 500000)];
    const e = expectedRandom(rands);
    expect(e.str).toBeCloseTo(2 * 0.5, 4);
    // Unknown label contributes nothing to output keys.
    expect(Object.keys(e)).toEqual(["str"]);
  });

  it("returns empty object when totalRate is 0 (defensive)", () => {
    const rands = [mkRand("外功", 1, 5, 0)];
    expect(expectedRandom(rands)).toEqual({});
  });
});
```

- [ ] **Step 2: Run test, verify it fails**

Run: `npm test -- random-expected`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Implement `random-expected.ts`**

Create `src/lib/scoring/random-expected.ts`:

```ts
import type { ItemRand } from "@/lib/types/item";
import { labelToKey } from "./attribute-alias";

/**
 * Compute the expected random contribution per attribute key for an item,
 * given its item_rand rows. Uses the "rate-weighted midpoint" model:
 *   E[key X] = Σ over rows with attribute==X of ((min+max)/2) × (rate/totalRate)
 * where totalRate is the sum of rate across ALL rand rows for the item.
 */
export function expectedRandom(rands: readonly ItemRand[]): Record<string, number> {
  if (rands.length === 0) return {};

  const totalRate = rands.reduce((acc, r) => acc + r.rate, 0);
  if (totalRate === 0) return {};

  const out: Record<string, number> = {};
  for (const row of rands) {
    const key = labelToKey(row.attribute);
    if (!key) continue;
    const midpoint = (row.min + row.max) / 2;
    const contribution = midpoint * (row.rate / totalRate);
    out[key] = (out[key] ?? 0) + contribution;
  }
  return out;
}
```

- [ ] **Step 4: Run test, verify it passes**

Run: `npm test -- random-expected`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/scoring/random-expected.ts src/lib/scoring/__tests__/random-expected.test.ts
git commit -m "feat(scoring): compute rate-weighted random attribute expectations"
```

---

## Task 5: Score function (TDD)

**Files:**

- Create: `src/lib/scoring/score.ts`
- Test: `src/lib/scoring/__tests__/score.test.ts`

- [ ] **Step 1: Write failing tests**

Create `src/lib/scoring/__tests__/score.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { scoreItem } from "../score";
import type { Item, ItemRand } from "@/lib/types/item";

// Helper: build an Item with only the fields that matter, zero for others
function mkItem(partial: Partial<Item>): Item {
  const base: Item = {
    id: 1,
    name: "T",
    note: null,
    type: "座騎",
    summary: null,
    level: 80,
    weight: 0,
    hp: 0,
    mp: 0,
    str: 0,
    pow: 0,
    vit: 0,
    dex: 0,
    agi: 0,
    wis: 0,
    atk: 0,
    matk: 0,
    def: 0,
    mdef: 0,
    dodge: 0,
    uncanny_dodge: 0,
    critical: 0,
    hit: 0,
    speed: 0,
    fire: 0,
    water: 0,
    thunder: 0,
    tree: 0,
    freeze: 0,
    min_damage: 0,
    max_damage: 0,
    min_pdamage: 0,
    max_pdamage: 0,
    picture: 0,
    icon: 0,
    value: 0,
    durability: 0,
  };
  return { ...base, ...partial };
}

const noRand: ItemRand[] = [];

describe("scoreItem", () => {
  it("sums weighted fixed attributes", () => {
    const item = mkItem({ str: 10, dex: 5, hit: 8 });
    const weights = { str: 11, dex: 3, hit: 1 };
    const scored = scoreItem(item, noRand, weights);
    expect(scored.baseScore).toBe(10 * 11 + 5 * 3 + 8 * 1); // 133
    expect(scored.score).toBe(133);
    expect(scored.expectedRandom).toEqual({});
  });

  it("adds random expectations multiplied by matching weights", () => {
    const item = mkItem({ str: 10 });
    const rands: ItemRand[] = [
      { id: "1", attribute: "外功", min: 3, max: 5, rate: 970000 },
      { id: "1", attribute: "外功", min: 6, max: 6, rate: 30000 },
    ];
    // E[str] = 4.06
    // baseScore = 10 * 11 = 110
    // score    = 110 + 4.06 * 11 = 154.66
    const scored = scoreItem(item, rands, { str: 11 });
    expect(scored.baseScore).toBe(110);
    expect(scored.expectedRandom.str).toBeCloseTo(4.06, 4);
    expect(scored.score).toBeCloseTo(154.66, 2);
  });

  it("ignores weight keys that do not exist on the item (no throw)", () => {
    const item = mkItem({ str: 10 });
    const scored = scoreItem(item, noRand, { str: 2, not_a_real_key: 99 });
    expect(scored.score).toBe(20);
  });

  it("handles negative weights (subtraction)", () => {
    const item = mkItem({ str: 10, weight: 50 });
    const scored = scoreItem(item, noRand, { str: 1, weight: -0.5 });
    expect(scored.score).toBe(10 - 25); // -15
  });

  it("empty weights yields zero score", () => {
    const item = mkItem({ str: 100 });
    const scored = scoreItem(item, noRand, {});
    expect(scored.score).toBe(0);
  });
});
```

- [ ] **Step 2: Run test, verify it fails**

Run: `npm test -- score`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Implement `score.ts`**

Create `src/lib/scoring/score.ts`:

```ts
import type { Item, ItemRand } from "@/lib/types/item";
import type { ScoredItem, Weights } from "./types";
import { expectedRandom } from "./random-expected";

/**
 * Compute the weighted score for an item, combining fixed attributes with
 * random-attribute expectations. Weight keys missing from the item are
 * ignored. Missing keys in weights contribute 0 (no weight).
 */
export function scoreItem(item: Item, rands: readonly ItemRand[], weights: Weights): ScoredItem {
  const asRecord = item as unknown as Record<string, number | string | null>;
  const expected = expectedRandom(rands);

  let baseScore = 0;
  let score = 0;
  for (const [key, w] of Object.entries(weights)) {
    const raw = asRecord[key];
    const fixed = typeof raw === "number" ? raw : 0;
    baseScore += fixed * w;
    score += (fixed + (expected[key] ?? 0)) * w;
  }

  return { item, baseScore, score, expectedRandom: expected };
}
```

- [ ] **Step 4: Run test, verify it passes**

Run: `npm test -- score`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/scoring/score.ts src/lib/scoring/__tests__/score.test.ts
git commit -m "feat(scoring): scoreItem combines fixed attributes with random expectations"
```

---

## Task 6: 7 preset playstyles + parity with LINE bot

**Files:**

- Create: `src/lib/scoring/presets.ts`
- Test: `src/lib/scoring/__tests__/presets.test.ts`
- Create: `src/lib/scoring/index.ts`

- [ ] **Step 1: Implement presets**

Create `src/lib/scoring/presets.ts`:

```ts
import type { Preset } from "./types";

// Ported verbatim from ../tthol-line-bot/src/configs/weighted.config.js
// Do not edit values without updating the parity test.
export const presets: readonly Preset[] = [
  {
    id: "pure-wis",
    label: "純玄系列",
    weights: { wis: 7, dex: 3, hit: 1, def: 0.5, mdef: 0.25 },
  },
  {
    id: "pure-str",
    label: "純外系列",
    weights: { str: 11, atk: 1, dex: 3, hit: 1, def: 0.5, mdef: 0.5 },
  },
  {
    id: "pure-pow",
    label: "純內系列",
    weights: { pow: 9, matk: 1, dex: 3, hit: 1, def: 0.5, mdef: 0.5 },
  },
  {
    id: "wis-pow",
    label: "玄內系列",
    weights: { wis: 7, pow: 5, matk: 1, dex: 3, hit: 1, def: 0.5, mdef: 0.25 },
  },
  {
    id: "wis-str",
    label: "玄外系列",
    weights: { wis: 7, str: 5, atk: 1, dex: 3, hit: 1, def: 0.5, mdef: 0.5 },
  },
  {
    id: "crit-blade",
    label: "爆刀",
    weights: { agi: 7, str: 7, critical: 5, def: 0.75, mdef: 0.75 },
  },
  {
    id: "gauntlet",
    label: "手甲",
    weights: { dex: 15, hit: 5, atk: 7 },
  },
] as const;

export function getPresetById(id: string): Preset | null {
  return presets.find((p) => p.id === id) ?? null;
}

export function getPresetByLabel(label: string): Preset | null {
  return presets.find((p) => p.label === label) ?? null;
}
```

- [ ] **Step 2: Write parity test against LINE bot config**

Create `src/lib/scoring/__tests__/presets.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { presets, getPresetById, getPresetByLabel } from "../presets";

// Snapshot of LINE bot's weighted.config.js at the time of porting
// (../tthol-line-bot/src/configs/weighted.config.js).
const lineBotConfig = [
  {
    type: "純玄系列",
    params: [
      { key: "wis", value: 7 },
      { key: "dex", value: 3 },
      { key: "hit", value: 1 },
      { key: "def", value: 0.5 },
      { key: "mdef", value: 0.25 },
    ],
  },
  {
    type: "純外系列",
    params: [
      { key: "str", value: 11 },
      { key: "atk", value: 1 },
      { key: "dex", value: 3 },
      { key: "hit", value: 1 },
      { key: "def", value: 0.5 },
      { key: "mdef", value: 0.5 },
    ],
  },
  {
    type: "純內系列",
    params: [
      { key: "pow", value: 9 },
      { key: "matk", value: 1 },
      { key: "dex", value: 3 },
      { key: "hit", value: 1 },
      { key: "def", value: 0.5 },
      { key: "mdef", value: 0.5 },
    ],
  },
  {
    type: "玄內系列",
    params: [
      { key: "wis", value: 7 },
      { key: "pow", value: 5 },
      { key: "matk", value: 1 },
      { key: "dex", value: 3 },
      { key: "hit", value: 1 },
      { key: "def", value: 0.5 },
      { key: "mdef", value: 0.25 },
    ],
  },
  {
    type: "玄外系列",
    params: [
      { key: "wis", value: 7 },
      { key: "str", value: 5 },
      { key: "atk", value: 1 },
      { key: "dex", value: 3 },
      { key: "hit", value: 1 },
      { key: "def", value: 0.5 },
      { key: "mdef", value: 0.5 },
    ],
  },
  {
    type: "爆刀",
    params: [
      { key: "agi", value: 7 },
      { key: "str", value: 7 },
      { key: "critical", value: 5 },
      { key: "def", value: 0.75 },
      { key: "mdef", value: 0.75 },
    ],
  },
  {
    type: "手甲",
    params: [
      { key: "dex", value: 15 },
      { key: "hit", value: 5 },
      { key: "atk", value: 7 },
    ],
  },
];

describe("presets parity with LINE bot weighted.config.js", () => {
  it("has the same number of presets", () => {
    expect(presets.length).toBe(lineBotConfig.length);
  });

  for (const cfg of lineBotConfig) {
    it(`${cfg.type} has identical weights`, () => {
      const p = presets.find((x) => x.label === cfg.type);
      expect(p, `preset labelled ${cfg.type}`).toBeDefined();
      const expected: Record<string, number> = {};
      for (const { key, value } of cfg.params) expected[key] = value;
      expect(p!.weights).toEqual(expected);
    });
  }
});

describe("preset lookup helpers", () => {
  it("finds by id", () => {
    expect(getPresetById("pure-str")?.label).toBe("純外系列");
  });
  it("finds by label", () => {
    expect(getPresetByLabel("手甲")?.id).toBe("gauntlet");
  });
  it("returns null for missing", () => {
    expect(getPresetById("nope")).toBeNull();
  });
});
```

- [ ] **Step 3: Run test, verify it passes**

Run: `npm test -- presets`
Expected: PASS (7 parity cases + 3 lookup cases).

- [ ] **Step 4: Create scoring barrel export**

Create `src/lib/scoring/index.ts`:

```ts
export * from "./types";
export * from "./score";
export * from "./random-expected";
export * from "./attribute-alias";
export * from "./presets";
```

- [ ] **Step 5: Commit**

```bash
git add src/lib/scoring/presets.ts src/lib/scoring/__tests__/presets.test.ts src/lib/scoring/index.ts
git commit -m "feat(scoring): 7 preset playstyles ported from LINE bot with parity test"
```

---

## Task 7: Classifier stub (Phase 2.5 placeholder)

**Files:**

- Create: `src/lib/classifier/types.ts`
- Create: `src/lib/classifier/index.ts`
- Test: `src/lib/classifier/__tests__/index.test.ts`

- [ ] **Step 1: Define types**

Create `src/lib/classifier/types.ts`:

```ts
import type { Item, ItemRand } from "@/lib/types/item";

export interface Tag {
  id: string;
  label: string;
  // optional tooltip / explanation
  description?: string;
}

export interface ClassifierInput {
  item: Item;
  rands: readonly ItemRand[];
}

// Future: rule shape will be declarative, e.g.
//   { tag, requires: ['str:>=5', 'dex:>=5'], excludes: ['pow:>=3'] }
// Phase 2 only ships the module shell.
```

- [ ] **Step 2: Implement empty classifier with placeholder test**

Create `src/lib/classifier/index.ts`:

```ts
import type { ClassifierInput, Tag } from "./types";

export type { Tag, ClassifierInput } from "./types";

// Phase 2 stub: returns no tags. Phase 2.5 will add rule-based classification
// (e.g. "外功+技巧 without 內力 → 外功型"). Consumers should treat an empty
// array as "no tags to display" rather than "unknown".
export function classify(_input: ClassifierInput): Tag[] {
  return [];
}
```

Create `src/lib/classifier/__tests__/index.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { classify } from "../index";

describe("classify (Phase 2 stub)", () => {
  it("returns empty array", () => {
    const result = classify({
      item: { id: 1 } as never,
      rands: [],
    });
    expect(result).toEqual([]);
  });
});
```

- [ ] **Step 3: Run test, verify it passes**

Run: `npm test -- classifier`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/lib/classifier src/lib/classifier/__tests__
git commit -m "feat(classifier): stub module reserving Phase 2.5 tag API"
```

---

## Task 8: Extend item queries

**Files:**

- Modify: `src/lib/queries/items.ts`

Server-side batch queries for the ranking and compare pages. The ranking page needs a trimmed item payload (drop `picture`, `icon`, `summary`, `note`, `durability`, `value`) to keep the wire size low.

- [ ] **Step 1: Add trimmed payload type**

Open `src/lib/queries/items.ts` and add at the top (after existing imports):

```ts
// Columns required by ranking/compare UI: identity + level + all numeric
// attributes used in scoring/display. Excludes picture/icon/summary/note/
// durability/value to reduce payload size.
export const RANKING_ITEM_COLUMNS = [
  "id",
  "name",
  "type",
  "level",
  "weight",
  "hp",
  "mp",
  "str",
  "pow",
  "vit",
  "dex",
  "agi",
  "wis",
  "atk",
  "matk",
  "def",
  "mdef",
  "dodge",
  "uncanny_dodge",
  "critical",
  "hit",
  "speed",
  "fire",
  "water",
  "thunder",
  "tree",
  "freeze",
  "min_damage",
  "max_damage",
  "min_pdamage",
  "max_pdamage",
] as const;

export type RankingItem = Pick<Item, (typeof RANKING_ITEM_COLUMNS)[number]>;
```

- [ ] **Step 2: Add `getItemsByType`**

Append to the same file:

```ts
export function getItemsByType(type: string): RankingItem[] {
  const db = getDb();
  const cols = RANKING_ITEM_COLUMNS.join(", ");
  return db
    .prepare(`SELECT ${cols} FROM items WHERE type = ? ORDER BY level DESC, id ASC`)
    .all(type) as RankingItem[];
}
```

- [ ] **Step 3: Add `getItemsByIds` and `getItemRandsByIds`**

```ts
export function getItemsByIds(ids: readonly number[]): Item[] {
  if (ids.length === 0) return [];
  const db = getDb();
  const placeholders = ids.map(() => "?").join(",");
  return db.prepare(`SELECT * FROM items WHERE id IN (${placeholders})`).all(...ids) as Item[];
}

export function getItemRandsByIds(ids: readonly number[]): ItemRand[] {
  if (ids.length === 0) return [];
  const db = getDb();
  const stringIds = ids.map(String);
  const placeholders = stringIds.map(() => "?").join(",");
  return db
    .prepare(`SELECT * FROM item_rand WHERE id IN (${placeholders}) ORDER BY rate DESC`)
    .all(...stringIds) as ItemRand[];
}
```

- [ ] **Step 4: Smoke-test in a unit test**

Create `src/lib/queries/__tests__/items-phase2.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { getItemsByType, getItemsByIds, getItemRandsByIds } from "../items";

describe("getItemsByType", () => {
  it("returns 座騎 rows with only ranking columns", () => {
    const rows = getItemsByType("座騎");
    expect(rows.length).toBeGreaterThan(0);
    const sample = rows[0] as Record<string, unknown>;
    expect(sample.picture).toBeUndefined(); // trimmed
    expect(sample.summary).toBeUndefined(); // trimmed
    expect(typeof sample.str).toBe("number"); // kept
  });
});

describe("getItemsByIds / getItemRandsByIds", () => {
  it("returns empty arrays for empty input", () => {
    expect(getItemsByIds([])).toEqual([]);
    expect(getItemRandsByIds([])).toEqual([]);
  });

  it("round-trips at least one 座騎 with its rand rows", () => {
    const [first] = getItemsByType("座騎");
    expect(first).toBeDefined();
    const full = getItemsByIds([first.id]);
    expect(full).toHaveLength(1);
    expect(full[0].id).toBe(first.id);
    const rands = getItemRandsByIds([first.id]);
    // Not every item has rand rows; just assert the call succeeded and
    // returned an array.
    expect(Array.isArray(rands)).toBe(true);
  });
});
```

- [ ] **Step 5: Run test, verify it passes**

Run: `npm test -- items-phase2`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/queries/items.ts src/lib/queries/__tests__/items-phase2.test.ts
git commit -m "feat(queries): trimmed getItemsByType + batch getItemsByIds/getItemRandsByIds"
```

---

## Task 9: localStorage hooks

**Files:**

- Create: `src/lib/hooks/use-compare-tray.ts`
- Create: `src/lib/hooks/use-custom-presets.ts`
- Test: `src/lib/hooks/__tests__/use-compare-tray.test.tsx`
- Test: `src/lib/hooks/__tests__/use-custom-presets.test.tsx`

Both hooks gracefully degrade when `localStorage` is unavailable (private mode / SSR) by falling back to in-memory state.

- [ ] **Step 1: Implement `use-compare-tray`**

Create `src/lib/hooks/use-compare-tray.ts`:

```ts
"use client";

import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "genbu.compareTray";
const MAX_ITEMS = 5;

function readStorage(): number[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((n): n is number => typeof n === "number");
  } catch {
    return [];
  }
}

function writeStorage(ids: number[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
  } catch {
    /* private mode or quota exceeded — fall back to memory-only */
  }
}

export interface CompareTray {
  ids: number[];
  isFull: boolean;
  has: (id: number) => boolean;
  add: (id: number) => void;
  remove: (id: number) => void;
  clear: () => void;
}

export function useCompareTray(): CompareTray {
  const [ids, setIds] = useState<number[]>([]);

  useEffect(() => {
    setIds(readStorage());
  }, []);

  const commit = useCallback((next: number[]) => {
    setIds(next);
    writeStorage(next);
  }, []);

  const add = useCallback((id: number) => {
    setIds((prev) => {
      if (prev.includes(id) || prev.length >= MAX_ITEMS) return prev;
      const next = [...prev, id];
      writeStorage(next);
      return next;
    });
  }, []);

  const remove = useCallback((id: number) => {
    setIds((prev) => {
      const next = prev.filter((x) => x !== id);
      writeStorage(next);
      return next;
    });
  }, []);

  const clear = useCallback(() => commit([]), [commit]);
  const has = useCallback((id: number) => ids.includes(id), [ids]);

  return { ids, isFull: ids.length >= MAX_ITEMS, has, add, remove, clear };
}

export { MAX_ITEMS as COMPARE_TRAY_MAX };
```

- [ ] **Step 2: Write test for `use-compare-tray`**

Create `src/lib/hooks/__tests__/use-compare-tray.test.tsx`:

```tsx
import { describe, it, expect, beforeEach } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useCompareTray, COMPARE_TRAY_MAX } from "../use-compare-tray";

beforeEach(() => window.localStorage.clear());

describe("useCompareTray", () => {
  it("starts empty", () => {
    const { result } = renderHook(() => useCompareTray());
    expect(result.current.ids).toEqual([]);
    expect(result.current.isFull).toBe(false);
  });

  it("adds, deduplicates, and removes", () => {
    const { result } = renderHook(() => useCompareTray());
    act(() => result.current.add(1));
    act(() => result.current.add(2));
    act(() => result.current.add(1)); // duplicate ignored
    expect(result.current.ids).toEqual([1, 2]);

    act(() => result.current.remove(1));
    expect(result.current.ids).toEqual([2]);
  });

  it("caps at MAX items", () => {
    const { result } = renderHook(() => useCompareTray());
    act(() => {
      for (let i = 0; i < COMPARE_TRAY_MAX + 3; i++) result.current.add(100 + i);
    });
    expect(result.current.ids).toHaveLength(COMPARE_TRAY_MAX);
    expect(result.current.isFull).toBe(true);
  });

  it("persists to localStorage", () => {
    const { result, unmount } = renderHook(() => useCompareTray());
    act(() => result.current.add(42));
    unmount();
    const { result: second } = renderHook(() => useCompareTray());
    // Wait one tick for useEffect to read storage.
    expect(second.current.ids).toEqual([42]);
  });
});
```

- [ ] **Step 3: Implement `use-custom-presets`**

Create `src/lib/hooks/use-custom-presets.ts`:

```ts
"use client";

import { useCallback, useEffect, useState } from "react";
import type { Weights } from "@/lib/scoring";

const STORAGE_KEY = "genbu.ranking.customPresets";

export interface CustomPreset {
  id: string; // generated: `${Date.now()}-${crypto.random}` or name-based
  name: string;
  type: string; // 座騎 | 背飾 | ...
  weights: Weights;
}

function read(): CustomPreset[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (p): p is CustomPreset =>
        typeof p === "object" &&
        p !== null &&
        typeof (p as CustomPreset).id === "string" &&
        typeof (p as CustomPreset).name === "string" &&
        typeof (p as CustomPreset).type === "string" &&
        typeof (p as CustomPreset).weights === "object",
    );
  } catch {
    return [];
  }
}

function write(list: CustomPreset[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch {
    /* noop */
  }
}

export function useCustomPresets() {
  const [presets, setPresets] = useState<CustomPreset[]>([]);

  useEffect(() => setPresets(read()), []);

  const save = useCallback((preset: Omit<CustomPreset, "id">) => {
    setPresets((prev) => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const next = [...prev, { ...preset, id }];
      write(next);
      return next;
    });
  }, []);

  const remove = useCallback((id: string) => {
    setPresets((prev) => {
      const next = prev.filter((p) => p.id !== id);
      write(next);
      return next;
    });
  }, []);

  return { presets, save, remove };
}
```

- [ ] **Step 4: Write test for `use-custom-presets`**

Create `src/lib/hooks/__tests__/use-custom-presets.test.tsx`:

```tsx
import { describe, it, expect, beforeEach } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useCustomPresets } from "../use-custom-presets";

beforeEach(() => window.localStorage.clear());

describe("useCustomPresets", () => {
  it("saves and removes entries", () => {
    const { result } = renderHook(() => useCustomPresets());
    act(() =>
      result.current.save({
        name: "My 外功",
        type: "座騎",
        weights: { str: 11, atk: 1 },
      }),
    );
    expect(result.current.presets).toHaveLength(1);
    const { id } = result.current.presets[0];
    act(() => result.current.remove(id));
    expect(result.current.presets).toEqual([]);
  });

  it("gracefully handles corrupted storage", () => {
    window.localStorage.setItem("genbu.ranking.customPresets", "not json");
    const { result } = renderHook(() => useCustomPresets());
    expect(result.current.presets).toEqual([]);
  });
});
```

- [ ] **Step 5: Run tests**

Run: `npm test -- hooks`
Expected: both hook suites PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/hooks
git commit -m "feat(hooks): localStorage-backed compare tray + custom presets"
```

---

## Task 10: `<StatBarChart>` and `<ItemTags>` shared components

**Files:**

- Create: `src/components/items/stat-bar-chart.tsx`
- Create: `src/components/items/item-tags.tsx`

- [ ] **Step 1: Implement `<StatBarChart>`**

A dependency-free horizontal bar chart. Each row shows attribute label, numeric value, and a bar whose width is `value / maxValue * 100%`.

Create `src/components/items/stat-bar-chart.tsx`:

```tsx
import { itemAttributeNames } from "@/lib/constants/i18n";

export interface StatBarChartProps {
  values: Record<string, number>;
  maxValues: Record<string, number>;
  // Optional: restrict which keys to render and in what order
  keys?: readonly string[];
}

const DEFAULT_KEYS = [
  "str",
  "pow",
  "wis",
  "agi",
  "dex",
  "vit",
  "atk",
  "matk",
  "def",
  "mdef",
  "hit",
  "dodge",
  "critical",
] as const;

export function StatBarChart({ values, maxValues, keys = DEFAULT_KEYS }: StatBarChartProps) {
  const rows = keys
    .map((k) => ({
      key: k,
      label: itemAttributeNames[k] ?? k,
      value: values[k] ?? 0,
      max: Math.max(1, maxValues[k] ?? 0),
    }))
    .filter((r) => r.value !== 0 || (maxValues[r.key] ?? 0) !== 0);

  if (rows.length === 0) return null;

  return (
    <div className="space-y-1.5">
      {rows.map((r) => {
        const pct = Math.max(0, Math.min(100, (r.value / r.max) * 100));
        return (
          <div key={r.key} className="grid grid-cols-[4rem_1fr_3rem] items-center gap-2 text-xs">
            <span className="text-muted-foreground">{r.label}</span>
            <div className="h-2 rounded-sm bg-muted overflow-hidden">
              <div
                className="h-full bg-primary/70 transition-[width] motion-reduce:transition-none"
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className="font-mono text-right">{r.value}</span>
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Implement `<ItemTags>` placeholder**

Create `src/components/items/item-tags.tsx`:

```tsx
import { classify } from "@/lib/classifier";
import type { Item, ItemRand } from "@/lib/types/item";
import { Badge } from "@/components/ui/badge";

export interface ItemTagsProps {
  item: Item;
  rands?: readonly ItemRand[];
}

// Phase 2: classifier stub returns []. Renders nothing today, but the UI
// slot is wired so Phase 2.5 can light up tags without structural changes.
export function ItemTags({ item, rands = [] }: ItemTagsProps) {
  const tags = classify({ item, rands });
  if (tags.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1">
      {tags.map((t) => (
        <Badge key={t.id} variant="outline" title={t.description}>
          {t.label}
        </Badge>
      ))}
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/items/stat-bar-chart.tsx src/components/items/item-tags.tsx
git commit -m "feat(items): shared StatBarChart + ItemTags placeholder"
```

---

## Task 11: Configs re-export

**Files:**

- Create: `src/configs/weighted.ts`

- [ ] **Step 1: Write the re-export**

Create `src/configs/weighted.ts`:

```ts
// CLAUDE.md documents this directory for weighted formulas & constants.
// The canonical source lives in src/lib/scoring/presets.ts; this module
// re-exports for discoverability alongside future cross-feature configs.
export { presets as weightedPresets, getPresetById, getPresetByLabel } from "@/lib/scoring/presets";
export type { Preset, Weights } from "@/lib/scoring/types";
```

- [ ] **Step 2: Commit**

```bash
git add src/configs/weighted.ts
git commit -m "chore(configs): re-export weighted presets for discoverability"
```

---

## Task 12: Navbar — add Ranking + Compare links

**Files:**

- Modify: `src/components/layout/navbar.tsx`

- [ ] **Step 1: Add entries**

Edit `src/components/layout/navbar.tsx` — replace the `navItems` constant:

```tsx
const navItems = [
  { href: "/", label: "首頁" },
  { href: "/items", label: "道具查詢" },
  { href: "/ranking", label: "排行榜" },
  { href: "/compare", label: "比較" },
];
```

- [ ] **Step 2: Verify render**

Run: `npm run build`
Expected: build succeeds (routes don't exist yet but Navbar links are just hrefs).

- [ ] **Step 3: Commit**

```bash
git add src/components/layout/navbar.tsx
git commit -m "feat(nav): add Ranking and Compare links"
```

---

## Task 13: Ranking page shell (Server Component)

**Files:**

- Create: `src/app/ranking/page.tsx`

At this stage the page renders a placeholder client component so we can verify type=座騎 data fetches correctly before building the full filter UI.

- [ ] **Step 1: Write the Server Component**

Create `src/app/ranking/page.tsx`:

```tsx
import type { Metadata } from "next";
import { getItemsByType, getItemRandsByIds, type RankingItem } from "@/lib/queries/items";
import { RankingClient } from "./ranking-client";

export const metadata: Metadata = {
  title: "加權排行榜 · 玄武",
  description: "座騎 / 背飾 的自訂加權排行",
};

const SUPPORTED_TYPES = ["座騎", "背飾"] as const;
type SupportedType = (typeof SUPPORTED_TYPES)[number];

interface Props {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function resolveType(raw: unknown): SupportedType {
  if (typeof raw === "string" && SUPPORTED_TYPES.includes(raw as SupportedType)) {
    return raw as SupportedType;
  }
  return "座騎";
}

export default async function RankingPage({ searchParams }: Props) {
  const params = await searchParams;
  const type = resolveType(params.type);
  const items: RankingItem[] = getItemsByType(type);
  const rands = getItemRandsByIds(items.map((i) => i.id));

  return (
    <div className="mx-auto max-w-6xl space-y-4 px-4 py-8">
      <header>
        <h1 className="text-2xl font-semibold">加權排行榜</h1>
        <p className="text-sm text-muted-foreground">
          目前類型：{type}。切換 type、調整權重、設定門檻後立即重排。
        </p>
      </header>
      <RankingClient type={type} items={items} rands={rands} />
    </div>
  );
}
```

- [ ] **Step 2: Placeholder `ranking-client.tsx`**

Create `src/app/ranking/ranking-client.tsx`:

```tsx
"use client";

import type { RankingItem } from "@/lib/queries/items";
import type { ItemRand } from "@/lib/types/item";

interface Props {
  type: string;
  items: RankingItem[];
  rands: ItemRand[];
}

export function RankingClient({ type, items, rands }: Props) {
  return (
    <pre className="text-xs text-muted-foreground">
      {type}: {items.length} items, {rands.length} rand rows (UI coming in next task)
    </pre>
  );
}
```

- [ ] **Step 3: Visually verify**

Run: `npm run dev` (background), open `http://localhost:3000/ranking`
Expected: page renders "座騎: 407 items, NNN rand rows".
Also try `/ranking?type=背飾` → 366 items.

Stop dev server after checking.

- [ ] **Step 4: Commit**

```bash
git add src/app/ranking
git commit -m "feat(ranking): SSR shell with type routing and data plumbing"
```

---

## Task 14: `<PresetSelector>` component

**Files:**

- Create: `src/components/ranking/preset-selector.tsx`

Dropdown/radio selector for the 7 presets + 自訂 + 我的配方 (names from `useCustomPresets`).

- [ ] **Step 1: Implement**

Create `src/components/ranking/preset-selector.tsx`:

```tsx
"use client";

import { presets } from "@/lib/scoring";
import type { CustomPreset } from "@/lib/hooks/use-custom-presets";

export type PresetSelection =
  | { kind: "builtin"; id: string }
  | { kind: "custom"; id: string }
  | { kind: "ad-hoc" }; // user has edited weights beyond a named preset

interface Props {
  value: PresetSelection;
  onChange: (s: PresetSelection) => void;
  customPresets: readonly CustomPreset[];
}

export function PresetSelector({ value, onChange, customPresets }: Props) {
  const currentValue = value.kind === "ad-hoc" ? "ad-hoc" : `${value.kind}:${value.id}`;

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium">流派</label>
      <select
        className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
        value={currentValue}
        onChange={(e) => {
          const v = e.target.value;
          if (v === "ad-hoc") return onChange({ kind: "ad-hoc" });
          const [kind, id] = v.split(":", 2);
          if (kind === "builtin" || kind === "custom") onChange({ kind, id });
        }}
      >
        <optgroup label="預設">
          {presets.map((p) => (
            <option key={p.id} value={`builtin:${p.id}`}>
              {p.label}
            </option>
          ))}
        </optgroup>
        {customPresets.length > 0 && (
          <optgroup label="我的配方">
            {customPresets.map((p) => (
              <option key={p.id} value={`custom:${p.id}`}>
                {p.name}
              </option>
            ))}
          </optgroup>
        )}
        <option value="ad-hoc">自訂（手動權重）</option>
      </select>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/ranking/preset-selector.tsx
git commit -m "feat(ranking): PresetSelector with builtin + custom groups"
```

---

## Task 15: `<WeightEditor>` component

**Files:**

- Create: `src/components/ranking/weight-editor.tsx`

Editable table of attribute → weight pairs. Each row has an attribute dropdown (restricted to scoreable keys) and a numeric input. User can add/remove rows.

- [ ] **Step 1: Implement**

Create `src/components/ranking/weight-editor.tsx`:

```tsx
"use client";

import { useMemo } from "react";
import { itemAttributeNames } from "@/lib/constants/i18n";
import type { Weights } from "@/lib/scoring";
import { Button } from "@/components/ui/button";

// Attributes that make sense as scoring inputs. Excludes metadata (id/name/type)
// and non-stat fields (weight/value/durability/picture/icon).
const SCOREABLE_KEYS = [
  "hp",
  "mp",
  "str",
  "pow",
  "vit",
  "dex",
  "agi",
  "wis",
  "atk",
  "matk",
  "def",
  "mdef",
  "dodge",
  "uncanny_dodge",
  "critical",
  "hit",
  "speed",
  "fire",
  "water",
  "thunder",
  "tree",
  "freeze",
  "min_damage",
  "max_damage",
  "min_pdamage",
  "max_pdamage",
] as const;

interface Row {
  key: string;
  value: number;
}

interface Props {
  weights: Weights;
  onChange: (next: Weights) => void;
}

export function WeightEditor({ weights, onChange }: Props) {
  const rows: Row[] = useMemo(
    () => Object.entries(weights).map(([key, value]) => ({ key, value })),
    [weights],
  );

  const availableKeys = useMemo(() => SCOREABLE_KEYS.filter((k) => !(k in weights)), [weights]);

  const setRowKey = (oldKey: string, newKey: string) => {
    if (oldKey === newKey) return;
    const next: Weights = {};
    for (const [k, v] of Object.entries(weights)) {
      next[k === oldKey ? newKey : k] = v;
    }
    onChange(next);
  };

  const setRowValue = (key: string, value: number) => {
    onChange({ ...weights, [key]: value });
  };

  const removeRow = (key: string) => {
    const next = { ...weights };
    delete next[key];
    onChange(next);
  };

  const addRow = () => {
    const firstFree = availableKeys[0];
    if (!firstFree) return;
    onChange({ ...weights, [firstFree]: 1 });
  };

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium">權重</label>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={addRow}
          disabled={availableKeys.length === 0}
        >
          + 新增屬性
        </Button>
      </div>
      {rows.length === 0 && <p className="text-xs text-muted-foreground">尚未設定權重</p>}
      {rows.map((r) => (
        <div key={r.key} className="grid grid-cols-[1fr_5rem_2rem] items-center gap-1.5">
          <select
            className="min-h-[44px] rounded-md border border-border bg-background px-2 py-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            value={r.key}
            onChange={(e) => setRowKey(r.key, e.target.value)}
          >
            <option value={r.key}>{itemAttributeNames[r.key] ?? r.key}</option>
            {availableKeys.map((k) => (
              <option key={k} value={k}>
                {itemAttributeNames[k] ?? k}
              </option>
            ))}
          </select>
          <input
            type="number"
            inputMode="decimal"
            step="0.25"
            className="min-h-[44px] rounded-md border border-border bg-background px-2 py-1 text-sm font-mono focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            value={r.value}
            onChange={(e) => {
              const v = Number(e.target.value);
              setRowValue(r.key, Number.isFinite(v) ? v : 0);
            }}
          />
          <Button
            type="button"
            size="icon"
            variant="ghost"
            onClick={() => removeRow(r.key)}
            aria-label={`移除 ${r.key}`}
            className="min-h-[44px] min-w-[44px]"
          >
            ×
          </Button>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/ranking/weight-editor.tsx
git commit -m "feat(ranking): WeightEditor with scoreable-attribute dropdowns"
```

---

## Task 16: `<LevelRange>` component

**Files:**

- Create: `src/components/ranking/level-range.tsx`

Dual number input for min/max level (simpler + more precise than a slider for TT players targeting specific breakpoints; can be upgraded later).

- [ ] **Step 1: Implement**

Create `src/components/ranking/level-range.tsx`:

```tsx
"use client";

interface Props {
  min: number;
  max: number;
  absoluteMin: number;
  absoluteMax: number;
  onChange: (range: { min: number; max: number }) => void;
}

export function LevelRange({ min, max, absoluteMin, absoluteMax, onChange }: Props) {
  const clamp = (n: number) => Math.max(absoluteMin, Math.min(absoluteMax, n));

  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium">等級範圍</label>
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
        <input
          type="number"
          inputMode="numeric"
          min={absoluteMin}
          max={absoluteMax}
          value={min}
          onChange={(e) => {
            const v = clamp(Number(e.target.value) || absoluteMin);
            onChange({ min: Math.min(v, max), max });
          }}
          className="min-h-[44px] rounded-md border border-border bg-background px-2 py-1 text-sm font-mono focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        <span className="text-muted-foreground text-xs">~</span>
        <input
          type="number"
          inputMode="numeric"
          min={absoluteMin}
          max={absoluteMax}
          value={max}
          onChange={(e) => {
            const v = clamp(Number(e.target.value) || absoluteMax);
            onChange({ min, max: Math.max(v, min) });
          }}
          className="min-h-[44px] rounded-md border border-border bg-background px-2 py-1 text-sm font-mono focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>
      <p className="text-xs text-muted-foreground">
        允許 {absoluteMin}~{absoluteMax}
      </p>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/ranking/level-range.tsx
git commit -m "feat(ranking): LevelRange dual-input component"
```

---

## Task 17: `<ThresholdFilters>` component

**Files:**

- Create: `src/components/ranking/threshold-filters.tsx`

"Hard threshold" numeric inputs for `hit / def / mdef / dodge` — leaving an input empty means "no threshold".

- [ ] **Step 1: Implement**

Create `src/components/ranking/threshold-filters.tsx`:

```tsx
"use client";

import { itemAttributeNames } from "@/lib/constants/i18n";

const THRESHOLD_KEYS = ["hit", "def", "mdef", "dodge"] as const;
export type ThresholdKey = (typeof THRESHOLD_KEYS)[number];
export type Thresholds = Partial<Record<ThresholdKey, number>>;

interface Props {
  values: Thresholds;
  onChange: (next: Thresholds) => void;
}

export function ThresholdFilters({ values, onChange }: Props) {
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium">硬性門檻</label>
      <p className="text-xs text-muted-foreground">空白代表不限制</p>
      <div className="space-y-1.5">
        {THRESHOLD_KEYS.map((k) => (
          <div key={k} className="grid grid-cols-[4rem_1fr] items-center gap-2">
            <span className="text-xs text-muted-foreground">{itemAttributeNames[k]} ≥</span>
            <input
              type="number"
              inputMode="numeric"
              value={values[k] ?? ""}
              placeholder="—"
              onChange={(e) => {
                const raw = e.target.value.trim();
                const next = { ...values };
                if (raw === "") delete next[k];
                else next[k] = Number(raw) || 0;
                onChange(next);
              }}
              className="min-h-[44px] rounded-md border border-border bg-background px-2 py-1 text-sm font-mono focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
        ))}
      </div>
    </div>
  );
}

export const thresholdKeys = THRESHOLD_KEYS;
```

- [ ] **Step 2: Commit**

```bash
git add src/components/ranking/threshold-filters.tsx
git commit -m "feat(ranking): ThresholdFilters for hit/def/mdef/dodge"
```

---

## Task 18: `<RankingTable>` component

**Files:**

- Create: `src/components/ranking/ranking-table.tsx`

Renders the scored item list. Columns: rank, name, level, active-preset score (highlighted), each of the 7 preset scores (sortable), actions (詳情 / 加入比較).

- [ ] **Step 1: Implement**

Create `src/components/ranking/ranking-table.tsx`:

```tsx
"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { presets } from "@/lib/scoring";
import type { ScoredItem } from "@/lib/scoring";
import { Button } from "@/components/ui/button";
import { useCompareTray } from "@/lib/hooks/use-compare-tray";

export interface RankingRow {
  scored: ScoredItem;
  // Score under every built-in preset, keyed by preset.id
  presetScores: Record<string, number>;
}

type SortKey = "current" | string; // "current" or preset id

interface Props {
  rows: RankingRow[];
  activePresetId: string | null; // null = custom / ad-hoc
  highlightId?: number | null;
  limit?: number;
  onShowAll?: () => void;
  showingAll?: boolean;
}

// Auto-collapse preset columns on narrow viewports; user can override.
function useInitialCompactMode() {
  const [compact, setCompact] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(max-width: 768px)");
    setCompact(mq.matches);
  }, []);
  return [compact, setCompact] as const;
}

export function RankingTable({
  rows,
  activePresetId,
  highlightId,
  limit = 30,
  onShowAll,
  showingAll,
}: Props) {
  const [sortKey, setSortKey] = useState<SortKey>("current");
  const [compact, setCompact] = useInitialCompactMode();
  const tray = useCompareTray();

  const sorted = useMemo(() => {
    const compareFn = (a: RankingRow, b: RankingRow) =>
      sortKey === "current"
        ? b.scored.score - a.scored.score
        : (b.presetScores[sortKey] ?? 0) - (a.presetScores[sortKey] ?? 0);
    return [...rows].sort(compareFn);
  }, [rows, sortKey]);

  const shown = showingAll ? sorted : sorted.slice(0, limit);

  // In compact mode, only show the "current" column and (if a preset is active)
  // that preset's column. Other preset columns are hidden.
  const visiblePresets = compact ? presets.filter((p) => p.id === activePresetId) : presets;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-end gap-2 text-xs text-muted-foreground">
        <span>顯示：</span>
        <Button
          size="sm"
          variant={compact ? "default" : "outline"}
          onClick={() => setCompact(true)}
        >
          簡潔
        </Button>
        <Button
          size="sm"
          variant={compact ? "outline" : "default"}
          onClick={() => setCompact(false)}
        >
          完整
        </Button>
      </div>
      <div className="overflow-x-auto rounded-md border border-border/60">
        <table className="w-full text-sm">
          <thead className="bg-muted/40">
            <tr>
              <th className="px-2 py-1.5 text-left w-10">#</th>
              <th className="px-2 py-1.5 text-left">名稱</th>
              <th className="px-2 py-1.5 text-right w-14">等級</th>
              <th
                className="px-2 py-1.5 text-right w-20 cursor-pointer hover:bg-muted focus-visible:bg-muted focus-visible:outline-none"
                role="button"
                tabIndex={0}
                onClick={() => setSortKey("current")}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setSortKey("current");
                  }
                }}
                aria-label="依目前流派排序"
                title="依目前流派排序"
              >
                目前 {sortKey === "current" ? "▼" : ""}
              </th>
              {visiblePresets.map((p) => (
                <th
                  key={p.id}
                  className={
                    "px-2 py-1.5 text-right w-20 cursor-pointer hover:bg-muted focus-visible:bg-muted focus-visible:outline-none " +
                    (activePresetId === p.id ? "bg-primary/5 text-primary" : "")
                  }
                  role="button"
                  tabIndex={0}
                  onClick={() => setSortKey(p.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setSortKey(p.id);
                    }
                  }}
                  aria-label={`依 ${p.label} 分數排序`}
                  title={`依 ${p.label} 分數排序`}
                >
                  {p.label.replace("系列", "")} {sortKey === p.id ? "▼" : ""}
                </th>
              ))}
              <th className="px-2 py-1.5 text-center w-32">操作</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((row, i) => {
              const { item } = row.scored;
              const isHighlighted = highlightId === item.id;
              return (
                <tr
                  key={item.id}
                  className={
                    "border-t border-border/40 hover:bg-muted/20 " +
                    (isHighlighted ? "bg-yellow-50 dark:bg-yellow-900/20" : "")
                  }
                >
                  <td className="px-2 py-1.5 text-muted-foreground">{i + 1}</td>
                  <td className="px-2 py-1.5">
                    <Link
                      href={`/items/${item.id}`}
                      className="inline-flex min-h-[44px] items-center hover:underline focus-visible:underline focus-visible:outline-none"
                    >
                      {item.name}
                    </Link>
                  </td>
                  <td className="px-2 py-1.5 text-right font-mono">{item.level}</td>
                  <td className="px-2 py-1.5 text-right font-mono">
                    {Math.round(row.scored.score)}
                  </td>
                  {visiblePresets.map((p) => (
                    <td
                      key={p.id}
                      className={
                        "px-2 py-1.5 text-right font-mono " +
                        (activePresetId === p.id ? "bg-primary/5 font-semibold" : "")
                      }
                    >
                      {Math.round(row.presetScores[p.id] ?? 0)}
                    </td>
                  ))}
                  <td className="px-2 py-1.5 text-center">
                    <Button
                      size="sm"
                      variant={tray.has(item.id) ? "secondary" : "outline"}
                      onClick={() => (tray.has(item.id) ? tray.remove(item.id) : tray.add(item.id))}
                      disabled={!tray.has(item.id) && tray.isFull}
                      className="min-h-[44px]"
                    >
                      {tray.has(item.id) ? "已在比較" : "加入比較"}
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!showingAll && sorted.length > limit && onShowAll && (
          <div className="p-2 text-center">
            <Button variant="ghost" size="sm" onClick={onShowAll}>
              顯示全部（{sorted.length} 件）
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/ranking/ranking-table.tsx
git commit -m "feat(ranking): RankingTable with 7-preset score columns and sort"
```

---

## Task 19: Wire the ranking page together

**Files:**

- Modify: `src/app/ranking/ranking-client.tsx`

Replace the placeholder with the full client implementation: URL-state wiring, preset/custom handling, scoring, threshold filtering, table.

- [ ] **Step 1: Rewrite `ranking-client.tsx`**

Overwrite `src/app/ranking/ranking-client.tsx`:

```tsx
"use client";

import { useCallback, useMemo, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { RankingItem } from "@/lib/queries/items";
import type { ItemRand } from "@/lib/types/item";
import { scoreItem, presets, getPresetById, type Weights } from "@/lib/scoring";
import { useCustomPresets } from "@/lib/hooks/use-custom-presets";
import { PresetSelector, type PresetSelection } from "@/components/ranking/preset-selector";
import { WeightEditor } from "@/components/ranking/weight-editor";
import { LevelRange } from "@/components/ranking/level-range";
import {
  ThresholdFilters,
  thresholdKeys,
  type Thresholds,
} from "@/components/ranking/threshold-filters";
import { RankingTable, type RankingRow } from "@/components/ranking/ranking-table";
import { Button } from "@/components/ui/button";

interface Props {
  type: "座騎" | "背飾";
  items: RankingItem[];
  rands: ItemRand[];
}

// Parse `weights` query param formatted as `key:val,key:val`
function parseWeights(raw: string | null): Weights | null {
  if (!raw) return null;
  const out: Weights = {};
  for (const pair of raw.split(",")) {
    const [k, v] = pair.split(":");
    if (!k) continue;
    const n = Number(v);
    if (Number.isFinite(n)) out[k] = n;
  }
  return Object.keys(out).length > 0 ? out : null;
}

function serializeWeights(w: Weights): string {
  return Object.entries(w)
    .map(([k, v]) => `${k}:${v}`)
    .join(",");
}

export function RankingClient({ type, items, rands }: Props) {
  const router = useRouter();
  const search = useSearchParams();
  const [isPending, startTransition] = useTransition();

  // --- URL → initial state ---------------------------------------------------
  const initialPresetId = search.get("preset") ?? "pure-str";
  const initialWeights =
    parseWeights(search.get("weights")) ??
    getPresetById(initialPresetId)?.weights ??
    presets[0].weights;

  const [weights, setWeights] = useState<Weights>(initialWeights);
  const [selection, setSelection] = useState<PresetSelection>(
    getPresetById(initialPresetId) ? { kind: "builtin", id: initialPresetId } : { kind: "ad-hoc" },
  );

  const levelRange = useMemo(() => {
    const all = items.map((i) => i.level);
    return {
      absoluteMin: Math.min(...all),
      absoluteMax: Math.max(...all),
    };
  }, [items]);

  const [minLv, setMinLv] = useState<number>(Number(search.get("minLv")) || 50);
  const [maxLv, setMaxLv] = useState<number>(Number(search.get("maxLv")) || 100);

  const [thresholds, setThresholds] = useState<Thresholds>(() => {
    const out: Thresholds = {};
    for (const k of thresholdKeys) {
      const v = search.get(`${k}Min`);
      if (v !== null && v !== "") out[k] = Number(v);
    }
    return out;
  });

  const [showAll, setShowAll] = useState(search.get("showAll") === "1");
  const highlightId = Number(search.get("highlight")) || null;
  const { presets: customPresets, save: saveCustom } = useCustomPresets();

  // --- Sync state → URL ------------------------------------------------------
  const pushUrl = useCallback(
    (patch: Record<string, string | null>) => {
      const params = new URLSearchParams(search.toString());
      for (const [k, v] of Object.entries(patch)) {
        if (v === null || v === "") params.delete(k);
        else params.set(k, v);
      }
      startTransition(() => {
        router.replace(`/ranking?${params.toString()}`, { scroll: false });
      });
    },
    [router, search],
  );

  const handlePresetChange = (next: PresetSelection) => {
    setSelection(next);
    if (next.kind === "builtin") {
      const p = getPresetById(next.id);
      if (p) {
        setWeights(p.weights);
        pushUrl({ preset: next.id, weights: null });
      }
    } else if (next.kind === "custom") {
      const c = customPresets.find((x) => x.id === next.id);
      if (c) {
        setWeights(c.weights);
        pushUrl({ preset: null, weights: serializeWeights(c.weights) });
      }
    } else {
      pushUrl({ preset: null, weights: serializeWeights(weights) });
    }
  };

  const handleWeightsChange = (next: Weights) => {
    setWeights(next);
    // Any manual edit drops us into ad-hoc unless the new weights match the current builtin.
    setSelection({ kind: "ad-hoc" });
    pushUrl({ preset: null, weights: serializeWeights(next) });
  };

  // --- Scoring ---------------------------------------------------------------
  const randsByItem = useMemo(() => {
    const map = new Map<number, ItemRand[]>();
    for (const r of rands) {
      const key = Number(r.id);
      const arr = map.get(key);
      if (arr) arr.push(r);
      else map.set(key, [r]);
    }
    return map;
  }, [rands]);

  const rows = useMemo<RankingRow[]>(() => {
    return items
      .filter((it) => it.level >= minLv && it.level <= maxLv)
      .filter((it) => {
        const rec = it as unknown as Record<string, number>;
        for (const [k, v] of Object.entries(thresholds)) {
          if (v !== undefined && (rec[k] ?? 0) < v) return false;
        }
        return true;
      })
      .map((it) => {
        const its = it as unknown as import("@/lib/types/item").Item;
        const rs = randsByItem.get(it.id) ?? [];
        const scored = scoreItem(its, rs, weights);
        const presetScores: Record<string, number> = {};
        for (const p of presets) {
          presetScores[p.id] = scoreItem(its, rs, p.weights).score;
        }
        return { scored, presetScores };
      })
      .filter((r) => r.scored.score !== 0);
  }, [items, randsByItem, weights, minLv, maxLv, thresholds]);

  const activePresetId = selection.kind === "builtin" ? selection.id : null;

  // --- Save as custom --------------------------------------------------------
  const onSaveCustom = () => {
    const name = window.prompt("為這組權重命名：");
    if (!name) return;
    saveCustom({ name, type, weights });
  };

  return (
    <div
      className={
        "grid gap-6 md:grid-cols-[18rem_1fr] transition-opacity motion-reduce:transition-none " +
        (isPending ? "opacity-60" : "")
      }
    >
      <aside className="space-y-5 md:sticky md:top-16 md:self-start">
        {/* Type tabs */}
        <div className="flex gap-1">
          {(["座騎", "背飾"] as const).map((t) => (
            <Button
              key={t}
              variant={t === type ? "default" : "outline"}
              size="sm"
              className="flex-1"
              onClick={() =>
                startTransition(() => router.replace(`/ranking?type=${encodeURIComponent(t)}`))
              }
            >
              {t}
            </Button>
          ))}
        </div>
        <LevelRange
          min={minLv}
          max={maxLv}
          absoluteMin={levelRange.absoluteMin}
          absoluteMax={levelRange.absoluteMax}
          onChange={({ min, max }) => {
            setMinLv(min);
            setMaxLv(max);
            pushUrl({ minLv: String(min), maxLv: String(max) });
          }}
        />
        <PresetSelector
          value={selection}
          onChange={handlePresetChange}
          customPresets={customPresets}
        />
        <WeightEditor weights={weights} onChange={handleWeightsChange} />
        <ThresholdFilters
          values={thresholds}
          onChange={(next) => {
            setThresholds(next);
            const patch: Record<string, string | null> = {};
            for (const k of thresholdKeys) {
              patch[`${k}Min`] = next[k] !== undefined ? String(next[k]) : null;
            }
            pushUrl(patch);
          }}
        />
        <Button variant="outline" size="sm" className="w-full" onClick={onSaveCustom}>
          儲存為我的配方
        </Button>
      </aside>
      <div className="space-y-2">
        <div className="text-sm text-muted-foreground" role="status" aria-live="polite">
          {rows.length} 件符合條件
        </div>
        {rows.length === 0 ? (
          <div className="rounded-md border border-dashed border-border/60 px-4 py-8 text-center text-sm text-muted-foreground">
            沒有符合條件的裝備。試試放寬等級區間或移除門檻。
          </div>
        ) : (
          <RankingTable
            rows={rows}
            activePresetId={activePresetId}
            highlightId={highlightId}
            showingAll={showAll}
            onShowAll={() => {
              setShowAll(true);
              pushUrl({ showAll: "1" });
            }}
          />
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Visual QA**

Run: `npm run dev` (background), visit `http://localhost:3000/ranking`:

- Default renders with preset `pure-str` (純外) and shows 30 items for 座騎.
- Toggle 背飾 tab — URL becomes `/ranking?type=背飾`, table repopulates.
- Change `純外` to `純玄` in PresetSelector — top rows shuffle.
- Edit a weight value — selector flips to 自訂, table reorders.
- Fill `命中 ≥ 50` threshold — rows reduce.
- Click a preset column header — table sorts by that preset's score.
- Copy URL and paste in a new tab — state fully restored.

Stop dev server after checking.

- [ ] **Step 3: Build must pass**

Run: `npm run build`
Expected: build succeeds with no type errors.

- [ ] **Step 4: Commit**

```bash
git add src/app/ranking/ranking-client.tsx
git commit -m "feat(ranking): wire filters, presets, scoring, URL state"
```

---

## Task 20: Compare page shell (Server Component)

**Files:**

- Create: `src/app/compare/page.tsx`
- Create: `src/app/compare/compare-client.tsx`

- [ ] **Step 1: Write Server Component**

Create `src/app/compare/page.tsx`:

```tsx
import type { Metadata } from "next";
import { getItemsByIds, getItemRandsByIds } from "@/lib/queries/items";
import { CompareClient } from "./compare-client";

export const metadata: Metadata = {
  title: "裝備比較 · 玄武",
  description: "同時比較多件座騎/背飾的屬性與加權分數",
};

interface Props {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function parseIds(raw: unknown): number[] {
  if (typeof raw !== "string" || raw.length === 0) return [];
  return raw
    .split(",")
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isInteger(n) && n > 0)
    .slice(0, 5);
}

export default async function ComparePage({ searchParams }: Props) {
  const params = await searchParams;
  const ids = parseIds(params.ids);
  const items = getItemsByIds(ids);
  const rands = getItemRandsByIds(ids);
  // Preserve original order from URL (query order)
  items.sort((a, b) => ids.indexOf(a.id) - ids.indexOf(b.id));

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-8">
      <header>
        <h1 className="text-2xl font-semibold">裝備比較</h1>
        <p className="text-sm text-muted-foreground">
          可比較 1~5 件同類型裝備。由物品詳情頁「加入比較」累積，或在本頁搜尋加入。
        </p>
      </header>
      <CompareClient initialItems={items} initialRands={rands} initialIds={ids} />
    </div>
  );
}
```

- [ ] **Step 2: Placeholder client**

Create `src/app/compare/compare-client.tsx`:

```tsx
"use client";

import type { Item, ItemRand } from "@/lib/types/item";

interface Props {
  initialItems: Item[];
  initialRands: ItemRand[];
  initialIds: number[];
}

export function CompareClient({ initialItems, initialRands, initialIds }: Props) {
  return (
    <pre className="text-xs text-muted-foreground">
      ids={initialIds.join(",")} items={initialItems.length} rands={initialRands.length}
    </pre>
  );
}
```

- [ ] **Step 3: Smoke test**

Run: `npm run dev`, visit `/compare?ids=21766,21767` → placeholder shows ids & counts.

Stop dev server.

- [ ] **Step 4: Commit**

```bash
git add src/app/compare
git commit -m "feat(compare): SSR shell with id routing and data plumbing"
```

---

## Task 21: `<ItemPicker>` component

**Files:**

- Create: `src/components/compare/item-picker.tsx`

Simple combobox: select `type` first (if the tray is empty), then search-as-you-type over that type's items.

- [ ] **Step 1: Implement**

Create `src/components/compare/item-picker.tsx`:

```tsx
"use client";

import { useMemo, useState } from "react";
import type { RankingItem } from "@/lib/queries/items";

interface Props {
  pool: RankingItem[];
  excludeIds: readonly number[];
  onPick: (item: RankingItem) => void;
  placeholder?: string;
}

export function ItemPicker({
  pool,
  excludeIds,
  onPick,
  placeholder = "搜尋裝備名稱或 ID…",
}: Props) {
  const [q, setQ] = useState("");

  const trimmed = q.trim();
  const matches = useMemo(() => {
    if (trimmed.length === 0) return [] as RankingItem[];
    const asNum = Number(trimmed);
    return pool
      .filter((it) => !excludeIds.includes(it.id))
      .filter((it) => (Number.isInteger(asNum) && it.id === asNum) || it.name.includes(trimmed))
      .slice(0, 10);
  }, [pool, excludeIds, trimmed]);

  const showEmpty = trimmed.length > 0 && matches.length === 0;

  return (
    <div className="relative">
      <input
        type="text"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={placeholder}
        aria-label="搜尋裝備"
        className="min-h-[44px] w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      />
      {matches.length > 0 && (
        <ul className="absolute z-10 mt-1 w-full rounded-md border border-border bg-popover shadow-md">
          {matches.map((it) => (
            <li key={it.id}>
              <button
                type="button"
                className="flex min-h-[44px] w-full items-center justify-between px-3 py-1.5 text-left text-sm hover:bg-muted focus-visible:bg-muted focus-visible:outline-none"
                onClick={() => {
                  onPick(it);
                  setQ("");
                }}
              >
                <span>{it.name}</span>
                <span className="text-xs text-muted-foreground font-mono">
                  Lv{it.level} · #{it.id}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {showEmpty && (
        <div
          role="status"
          aria-live="polite"
          className="absolute z-10 mt-1 w-full rounded-md border border-border bg-popover px-3 py-2 text-xs text-muted-foreground shadow-md"
        >
          查無符合「{trimmed}」的裝備
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/compare/item-picker.tsx
git commit -m "feat(compare): ItemPicker with name/id search"
```

---

## Task 22: `<CompareMatrix>` component

**Files:**

- Create: `src/components/compare/compare-matrix.tsx`

Attribute rows × items cols. Each row: label, then one cell per item. Per-row, highlight the max value.

- [ ] **Step 1: Implement**

Create `src/components/compare/compare-matrix.tsx`:

```tsx
"use client";

import type { Item } from "@/lib/types/item";
import { itemAttributeNames, displayableAttributeKeys } from "@/lib/constants/i18n";

interface Props {
  items: Item[];
}

export function CompareMatrix({ items }: Props) {
  const rows = displayableAttributeKeys
    .map((key) => {
      const values = items.map((it) => {
        const v = (it as unknown as Record<string, number | null>)[key];
        return typeof v === "number" ? v : 0;
      });
      return { key, label: itemAttributeNames[key] ?? key, values };
    })
    .filter((r) => r.values.some((v) => v !== 0));

  if (items.length === 0) return null;

  return (
    <div className="overflow-x-auto rounded-md border border-border/60">
      <table className="w-full text-sm">
        <thead className="bg-muted/40">
          <tr>
            <th className="px-2 py-1.5 text-left">屬性</th>
            {items.map((it) => (
              <th key={it.id} className="px-2 py-1.5 text-right">
                {it.name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const max = Math.max(...r.values);
            return (
              <tr key={r.key} className="border-t border-border/40">
                <td className="px-2 py-1.5 text-muted-foreground">{r.label}</td>
                {r.values.map((v, i) => (
                  <td
                    key={items[i].id}
                    className={
                      "px-2 py-1.5 text-right font-mono " +
                      (v === max && v > 0 ? "bg-primary/10 font-semibold text-primary" : "")
                    }
                  >
                    {v}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/compare/compare-matrix.tsx
git commit -m "feat(compare): CompareMatrix with per-row max highlight"
```

---

## Task 23: `<ComparePresets>` component

**Files:**

- Create: `src/components/compare/compare-presets.tsx`

7-preset × N-item score matrix.

- [ ] **Step 1: Implement**

Create `src/components/compare/compare-presets.tsx`:

```tsx
"use client";

import type { Item, ItemRand } from "@/lib/types/item";
import { presets, scoreItem } from "@/lib/scoring";

interface Props {
  items: Item[];
  randsByItem: Map<number, ItemRand[]>;
}

export function ComparePresets({ items, randsByItem }: Props) {
  if (items.length === 0) return null;

  const rows = presets.map((p) => {
    const scores = items.map((it) => scoreItem(it, randsByItem.get(it.id) ?? [], p.weights).score);
    return { preset: p, scores };
  });

  return (
    <div className="overflow-x-auto rounded-md border border-border/60">
      <table className="w-full text-sm">
        <thead className="bg-muted/40">
          <tr>
            <th className="px-2 py-1.5 text-left">流派</th>
            {items.map((it) => (
              <th key={it.id} className="px-2 py-1.5 text-right">
                {it.name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const max = Math.max(...r.scores);
            const min = Math.min(...r.scores);
            return (
              <tr key={r.preset.id} className="border-t border-border/40">
                <td className="px-2 py-1.5 text-muted-foreground">{r.preset.label}</td>
                {r.scores.map((s, i) => (
                  <td
                    key={items[i].id}
                    className={
                      "px-2 py-1.5 text-right font-mono " +
                      (s === max && max !== min
                        ? "bg-primary/10 font-semibold text-primary"
                        : s === min && max !== min
                          ? "text-muted-foreground"
                          : "")
                    }
                  >
                    {Math.round(s)}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/compare/compare-presets.tsx
git commit -m "feat(compare): ComparePresets with per-preset max/min color"
```

---

## Task 24: `<CompareBar>` + `<CompareButton>` (tray UI)

**Files:**

- Create: `src/components/items/compare-button.tsx`
- Create: `src/components/compare/compare-bar.tsx`

`<CompareButton>` toggles one item's membership in the tray. `<CompareBar>` is a sticky bar shown on any page with items in the tray; it lets the user review and jump to `/compare`.

- [ ] **Step 1: Implement `<CompareButton>`**

Create `src/components/items/compare-button.tsx`:

```tsx
"use client";

import { Button } from "@/components/ui/button";
import { useCompareTray } from "@/lib/hooks/use-compare-tray";

interface Props {
  itemId: number;
}

export function CompareButton({ itemId }: Props) {
  const tray = useCompareTray();
  const inTray = tray.has(itemId);

  return (
    <Button
      variant={inTray ? "secondary" : "outline"}
      size="sm"
      onClick={() => (inTray ? tray.remove(itemId) : tray.add(itemId))}
      disabled={!inTray && tray.isFull}
      title={tray.isFull && !inTray ? "比較盤已滿（最多 5 件）" : undefined}
    >
      {inTray ? "移出比較盤" : "加入比較"}
    </Button>
  );
}
```

- [ ] **Step 2: Implement `<CompareBar>`**

Create `src/components/compare/compare-bar.tsx`:

```tsx
"use client";

import Link from "next/link";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { useCompareTray } from "@/lib/hooks/use-compare-tray";

export function CompareBar() {
  const tray = useCompareTray();

  // When the bar is visible, reserve bottom padding on <body> so its fixed
  // position does not cover the last row of table / chart content.
  useEffect(() => {
    if (typeof document === "undefined") return;
    const hasItems = tray.ids.length > 0;
    document.body.classList.toggle("has-compare-bar", hasItems);
    return () => document.body.classList.remove("has-compare-bar");
  }, [tray.ids.length]);

  if (tray.ids.length === 0) return null;
  return (
    <div
      role="region"
      aria-label="比較盤"
      className="fixed bottom-4 left-1/2 z-40 -translate-x-1/2 rounded-full border border-border bg-background/95 px-4 py-2 shadow-lg backdrop-blur flex items-center gap-3 text-sm"
    >
      <span className="text-muted-foreground">比較盤：{tray.ids.length} 件</span>
      <Link
        href={`/compare?ids=${tray.ids.join(",")}`}
        className="min-h-[44px] inline-flex items-center rounded-md bg-primary px-3 py-1 text-primary-foreground text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        去比較 →
      </Link>
      <Button variant="ghost" size="sm" onClick={tray.clear} className="min-h-[44px] px-2 text-xs">
        清空
      </Button>
    </div>
  );
}
```

Add the matching CSS rule in `src/app/globals.css` (append at the bottom):

```css
body.has-compare-bar {
  padding-bottom: 5rem;
}
```

- [ ] **Step 3: Mount `<CompareBar>` globally**

Edit `src/app/layout.tsx` — add import and render:

```tsx
import { CompareBar } from "@/components/compare/compare-bar";
```

Inside `<body>`, after `<Footer />`:

```tsx
<CompareBar />
```

- [ ] **Step 4: Visual check**

Run `npm run dev`, add 2 items via ranking page's `加入比較` button → sticky bar appears → click 「去比較 →」 → lands on `/compare?ids=...`.

- [ ] **Step 5: Commit**

```bash
git add src/components/items/compare-button.tsx src/components/compare/compare-bar.tsx src/app/layout.tsx
git commit -m "feat(compare): CompareButton + sticky CompareBar tray UI"
```

---

## Task 25: Wire the compare page

**Files:**

- Modify: `src/app/compare/compare-client.tsx`
- Modify: `src/app/compare/page.tsx`

The compare page needs: the currently-picked items (full `Item` type), their rands, and also the type-specific pool for `<ItemPicker>` search. We extend the server page to fetch the pool when we know the type.

- [ ] **Step 1: Extend server page to also fetch pool**

Update `src/app/compare/page.tsx` — replace body with:

```tsx
import type { Metadata } from "next";
import { getItemsByIds, getItemRandsByIds, getItemsByType } from "@/lib/queries/items";
import { CompareClient } from "./compare-client";

export const metadata: Metadata = {
  title: "裝備比較 · 玄武",
  description: "同時比較多件座騎/背飾的屬性與加權分數",
};

interface Props {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function parseIds(raw: unknown): number[] {
  if (typeof raw !== "string" || raw.length === 0) return [];
  return raw
    .split(",")
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isInteger(n) && n > 0)
    .slice(0, 5);
}

const SUPPORTED_TYPES = ["座騎", "背飾"] as const;
type SupportedType = (typeof SUPPORTED_TYPES)[number];

export default async function ComparePage({ searchParams }: Props) {
  const params = await searchParams;
  const ids = parseIds(params.ids);
  const items = getItemsByIds(ids);
  items.sort((a, b) => ids.indexOf(a.id) - ids.indexOf(b.id));
  const rands = getItemRandsByIds(ids);

  // Pool for the picker: driven by items[0].type, or by ?type query, or default 座騎
  const rawType = typeof params.type === "string" ? params.type : undefined;
  const activeType: SupportedType =
    (items[0]?.type as SupportedType | undefined) ??
    (SUPPORTED_TYPES.includes(rawType as SupportedType) ? (rawType as SupportedType) : "座騎");
  const pool = getItemsByType(activeType);

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-8">
      <header>
        <h1 className="text-2xl font-semibold">裝備比較</h1>
        <p className="text-sm text-muted-foreground">
          可比較 1~5 件同類型裝備。目前類型：{activeType}。
        </p>
      </header>
      <CompareClient
        activeType={activeType}
        initialItems={items}
        initialRands={rands}
        initialIds={ids}
        pool={pool}
      />
    </div>
  );
}
```

- [ ] **Step 2: Rewrite `compare-client.tsx`**

Overwrite `src/app/compare/compare-client.tsx`:

```tsx
"use client";

import { useCallback, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { Item, ItemRand } from "@/lib/types/item";
import type { RankingItem } from "@/lib/queries/items";
import { ItemPicker } from "@/components/compare/item-picker";
import { CompareMatrix } from "@/components/compare/compare-matrix";
import { ComparePresets } from "@/components/compare/compare-presets";
import { StatBarChart } from "@/components/items/stat-bar-chart";
import { Button } from "@/components/ui/button";

const MAX_ITEMS = 5;

interface Props {
  activeType: "座騎" | "背飾";
  initialItems: Item[];
  initialRands: ItemRand[];
  initialIds: number[];
  pool: RankingItem[];
}

export function CompareClient({ activeType, initialItems, initialRands, initialIds, pool }: Props) {
  const router = useRouter();
  const search = useSearchParams();

  const randsByItem = useMemo(() => {
    const map = new Map<number, ItemRand[]>();
    for (const r of initialRands) {
      const key = Number(r.id);
      const arr = map.get(key);
      if (arr) arr.push(r);
      else map.set(key, [r]);
    }
    return map;
  }, [initialRands]);

  const maxValues = useMemo(() => {
    const m: Record<string, number> = {};
    for (const it of pool) {
      for (const [k, v] of Object.entries(it)) {
        if (typeof v === "number") m[k] = Math.max(m[k] ?? 0, v);
      }
    }
    return m;
  }, [pool]);

  const updateIds = useCallback(
    (ids: number[]) => {
      const params = new URLSearchParams(search.toString());
      if (ids.length === 0) params.delete("ids");
      else params.set("ids", ids.join(","));
      router.replace(`/compare?${params.toString()}`, { scroll: false });
    },
    [router, search],
  );

  const handlePick = (picked: RankingItem) => {
    if (initialIds.includes(picked.id)) return;
    if (initialIds.length >= MAX_ITEMS) return;
    updateIds([...initialIds, picked.id]);
  };

  const handleRemove = (id: number) => {
    updateIds(initialIds.filter((x) => x !== id));
  };

  const handleClear = () => updateIds([]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        {(["座騎", "背飾"] as const).map((t) => (
          <Button
            key={t}
            variant={t === activeType ? "default" : "outline"}
            size="sm"
            onClick={() => router.replace(`/compare?type=${encodeURIComponent(t)}`)}
            disabled={initialIds.length > 0 && t !== activeType}
            title={
              initialIds.length > 0 && t !== activeType ? "清空比較盤後才能切換類型" : undefined
            }
          >
            {t}
          </Button>
        ))}
        <div className="flex-1 min-w-[12rem]">
          <ItemPicker
            pool={pool}
            excludeIds={initialIds}
            onPick={handlePick}
            placeholder={
              initialIds.length >= MAX_ITEMS ? `已達 ${MAX_ITEMS} 件上限` : "搜尋裝備名稱或 ID…"
            }
          />
        </div>
        {initialIds.length > 0 && (
          <Button size="sm" variant="ghost" onClick={handleClear}>
            清空
          </Button>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        {initialItems.map((it) => (
          <span
            key={it.id}
            className="inline-flex items-center gap-1 rounded-full border border-border pl-3 pr-1 py-1 text-sm"
          >
            {it.name}
            <button
              type="button"
              aria-label={`移除 ${it.name}`}
              onClick={() => handleRemove(it.id)}
              className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              ×
            </button>
          </span>
        ))}
        {initialItems.length === 0 && (
          <span className="text-sm text-muted-foreground">
            尚未加入裝備。用上方搜尋框加入 1~{MAX_ITEMS} 件。
          </span>
        )}
      </div>

      {initialItems.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-lg font-semibold">屬性矩陣</h2>
          <CompareMatrix items={initialItems} />
        </section>
      )}

      {initialItems.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-lg font-semibold">7 流派分數</h2>
          <ComparePresets items={initialItems} randsByItem={randsByItem} />
        </section>
      )}

      {initialItems.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-lg font-semibold">屬性形狀</h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {initialItems.map((it) => (
              <div key={it.id} className="rounded-md border border-border/60 p-3">
                <div className="mb-2 text-sm font-medium">{it.name}</div>
                <StatBarChart
                  values={it as unknown as Record<string, number>}
                  maxValues={maxValues}
                />
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Visual QA**

`npm run dev`, visit:

- `/compare` → empty state, picker visible
- Add 2 座騎 → matrix + preset + bar chart render
- Try to switch to 背飾 tab while items present → button disabled
- Remove all, switch to 背飾, add 2 items → pools update correctly
- Attempt 6th item → picker shows "已達 5 件上限"
- URL `/compare?ids=21766,21767` → renders directly from fresh tab

- [ ] **Step 4: Build**

Run: `npm run build`
Expected: success.

- [ ] **Step 5: Commit**

```bash
git add src/app/compare
git commit -m "feat(compare): wire picker, matrix, preset grid, stat bars, URL state"
```

---

## Task 26: Enhance item detail page

**Files:**

- Modify: `src/app/items/[id]/page.tsx`

For 座騎/背飾 items, add `<CompareButton>`, `<StatBarChart>` (using this type's pool for max scale), `<ItemTags>`, and a "在排行中查看" link. For other types, render the existing layout unchanged.

- [ ] **Step 1: Update the page**

Edit `src/app/items/[id]/page.tsx`:

```tsx
import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { getItemById, getItemRands, getItemsByType } from "@/lib/queries/items";
import { getMonstersByDropItem } from "@/lib/queries/monsters";
import { ItemDetail } from "@/components/items/item-detail";
import { ItemRandTable } from "@/components/items/item-rand-table";
import { ItemDropList } from "@/components/items/item-drop-list";
import { CompareButton } from "@/components/items/compare-button";
import { StatBarChart } from "@/components/items/stat-bar-chart";
import { ItemTags } from "@/components/items/item-tags";

const PHASE2_TYPES = new Set(["座騎", "背飾"]);

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const item = getItemById(Number(id));
  if (!item) return { title: "道具不存在 · 玄武" };
  return {
    title: `${item.name} · 道具 · 玄武`,
    description: item.summary ?? item.note ?? `${item.name} 的詳細屬性與掉落來源`,
  };
}

export default async function ItemDetailPage({ params }: PageProps) {
  const { id } = await params;
  const itemId = Number(id);
  if (!Number.isInteger(itemId) || itemId <= 0) notFound();

  const item = getItemById(itemId);
  if (!item) notFound();

  const rands = getItemRands(String(item.id));
  const sources = getMonstersByDropItem(item.id);

  const isPhase2Type = item.type !== null && PHASE2_TYPES.has(item.type);
  let maxValues: Record<string, number> = {};
  if (isPhase2Type && item.type) {
    const pool = getItemsByType(item.type);
    for (const it of pool) {
      for (const [k, v] of Object.entries(it)) {
        if (typeof v === "number") maxValues[k] = Math.max(maxValues[k] ?? 0, v);
      }
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-8 px-4 py-8">
      <nav className="text-sm text-muted-foreground">
        <Link href="/items" className="hover:underline">
          ← 返回道具列表
        </Link>
      </nav>

      <ItemDetail item={item} />

      <ItemTags item={item} rands={rands} />

      {isPhase2Type && (
        <div className="flex flex-wrap items-center gap-2">
          <CompareButton itemId={item.id} />
          <Link
            href={`/ranking?type=${encodeURIComponent(item.type!)}&highlight=${item.id}`}
            className="text-sm text-muted-foreground underline hover:text-foreground"
          >
            在排行榜中查看 →
          </Link>
        </div>
      )}

      {isPhase2Type && (
        <div className="rounded-lg border border-border/60 bg-card p-4">
          <div className="mb-2 text-sm font-medium">屬性形狀</div>
          <StatBarChart values={item as unknown as Record<string, number>} maxValues={maxValues} />
        </div>
      )}

      <ItemRandTable rands={rands} />

      <ItemDropList sources={sources} />
    </div>
  );
}
```

- [ ] **Step 2: Visual QA**

`npm run dev`, visit a 座騎 item (e.g. `/items/21766`):

- "加入比較" button appears; click toggles tray sticky bar
- StatBarChart renders with proportional bars
- "在排行榜中查看 →" link goes to `/ranking?type=座騎&highlight=21766` with row highlighted

Verify a non-座騎/背飾 item (e.g. `/items/1`) still renders cleanly without the new UI.

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: success.

- [ ] **Step 4: Commit**

```bash
git add src/app/items/[id]/page.tsx
git commit -m "feat(items): 座騎/背飾 detail page adds compare button, bar chart, tag slot"
```

---

## Task 27: Final verification and manual QA checklist

**Files:** none (verification only).

- [ ] **Step 1: Run full test suite**

Run: `npm test`
Expected: all tests PASS.

- [ ] **Step 2: Production build**

Run: `npm run build`
Expected: success, no type errors.

- [ ] **Step 3: Lint**

Run: `npm run lint`
Expected: clean (or only pre-existing warnings).

- [ ] **Step 4: Manual QA checklist**

With `npm run dev` running, confirm every item in this list:

- [ ] `/ranking` loads with 座騎 selected, default preset = 純外系列
- [ ] Clicking "背飾" tab updates URL and table
- [ ] Dragging/editing a weight switches selector to "自訂" and rerenders immediately
- [ ] Clicking a preset column header sorts by that preset
- [ ] Threshold `命中 ≥ 50` reduces rows count
- [ ] "儲存為我的配方" + prompt adds entry to "我的配方" dropdown
- [ ] Copy URL from `/ranking?...` into a fresh tab — full state restored
- [ ] `/compare` empty state shows picker
- [ ] Add 3 items via picker → matrix, 7-preset grid, bar charts all render
- [ ] Remove 1 item via chip × → URL updates, UI reruns
- [ ] Switching 座騎/背飾 tab blocked while tray has items; works after clearing
- [ ] Tray sticky bar shows count and jumps to `/compare?ids=...`
- [ ] Item detail page for a 座騎: compare button, stat bar chart, "在排行中查看" link all visible
- [ ] Item detail page for a non-座騎/背飾 item: UI unchanged from Phase 1
- [ ] Dev tools → Application → localStorage shows `genbu.compareTray` + `genbu.ranking.customPresets` populated
- [ ] Open private window → no crash, state ephemeral (localStorage calls no-op)
- [ ] Throttle to slow 3G → first-load time acceptable (<3s for `/ranking`)
- [ ] Mobile viewport (375px wide) → ranking table defaults to 簡潔 mode; sidebar stacks above table
- [ ] Keyboard-only navigation: Tab through filter sidebar → preset column headers → action buttons; every focused element shows a visible ring
- [ ] Sortable `<th>` reachable via keyboard and activated by Enter / Space
- [ ] `prefers-reduced-motion: reduce` in DevTools → bar chart bars still work but no width transition
- [ ] Zero-match state: clear all weights → "沒有符合條件的裝備" empty state renders
- [ ] Picker with no matches → "查無符合「xxx」的裝備" live region announces
- [ ] Switching 座騎↔背飾: whole panel briefly dims (`isPending` opacity-60) during SSR re-render
- [ ] CompareBar visible → `<body>` gains `has-compare-bar` class and last table row is not covered

- [ ] **Step 5: Commit verification notes (if any adjustments needed)**

If any QA items failed, fix and commit. Otherwise:

```bash
git log --oneline -30
```

Confirm Phase 2 commits are in order and the tree is clean.
