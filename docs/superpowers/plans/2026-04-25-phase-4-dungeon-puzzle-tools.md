# Phase 4 — Dungeon Puzzle Tools Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship three client-side interactive puzzle solvers (160 迷霧九宮格, 175 北斗七星, 180 神武禁地) behind a `/tools` hub, upgrading the LINE Bot's text flow to visual UI.

**Architecture:** Pure-function solver modules in `src/lib/solvers/` drive thin Client Components under `src/app/tools/*`. No backend, no DB, no API. Solver correctness is the riskiest surface, so every solver is built TDD with a comprehensive test suite before any UI. 180's geometry is a 9-cell magic triangle (corrected from the original plan's mistaken 3×3 square).

**Tech Stack:** Next.js App Router (Client Components), TypeScript, Tailwind, shadcn/ui, lucide-react icons, Vitest + Testing Library.

**Spec:** `docs/superpowers/specs/2026-04-25-phase-4-dungeon-puzzle-tools-design.md`

---

## File Structure

### New files

```
src/lib/solvers/
├── seven-star.ts
├── forest-matrix.ts
├── god-quest.ts
└── __tests__/
    ├── seven-star.test.ts
    ├── forest-matrix.test.ts
    └── god-quest.test.ts

src/app/tools/
├── page.tsx                 # hub
├── not-found.tsx
├── 160/page.tsx
├── 175/page.tsx
└── 180/page.tsx

src/components/tools/
├── tool-card.tsx
├── inline-alert.tsx         # minimal destructive-styled alert div
├── number-pad-popover.tsx   # 1–9 picker (shared, currently only 160 uses it)
├── seven-star-solver.tsx
├── forest-matrix-solver.tsx
├── god-quest-solver.tsx
└── magic-triangle-svg.tsx
```

### Modified files

- `src/components/layout/navbar.tsx` — add `{ href: "/tools", label: "工具" }` to `navItems`.

### One-file, one-job

- Solvers are pure; they do not import React.
- Each solver UI component owns its local state and renders through shadcn primitives (`Card`, `Button`, `Popover`, `Select`, `Input`).
- The SVG triangle renderer (`magic-triangle-svg.tsx`) is presentation-only; 180's solver component passes a `TriangleSolution` down.

---

## Task 0: Branch setup

**Files:** none (git ops only)

- [ ] **Step 1: Create and switch to Phase 4 branch**

Run:
```bash
git checkout -b phase-4-dungeon-tools
```

Expected: switched to a new branch off `main` at the Phase 4 spec commit.

- [ ] **Step 2: Confirm clean working tree**

Run:
```bash
git status --short
```

Expected: either empty or only `?? GEMINI.md` (untracked, ignore).

---

## Task 1: 175 Seven-Star solver (TDD)

Smallest solver, shakes out tooling (Vitest + solver module shape) before the harder ones.

**Files:**
- Create: `src/lib/solvers/seven-star.ts`
- Test: `src/lib/solvers/__tests__/seven-star.test.ts`

- [ ] **Step 1: Write the failing test file**

Create `src/lib/solvers/__tests__/seven-star.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { solveSevenStar, sevenStarToNumber, type SevenStarState } from "../seven-star";

describe("solveSevenStar", () => {
  it("maps number to 7 booleans with star 1 = LSB", () => {
    // 85 = 0b1010101 -> [LSB..MSB] = [1,0,1,0,1,0,1]
    expect(solveSevenStar(85)).toEqual([true, false, true, false, true, false, true]);
  });

  it("handles min value 1", () => {
    expect(solveSevenStar(1)).toEqual([true, false, false, false, false, false, false]);
  });

  it("handles max value 127", () => {
    expect(solveSevenStar(127)).toEqual([true, true, true, true, true, true, true]);
  });

  it("handles 0 (all off) — range clamping is UI's job, solver is total", () => {
    expect(solveSevenStar(0)).toEqual([false, false, false, false, false, false, false]);
  });
});

describe("sevenStarToNumber", () => {
  it("reverses solveSevenStar for 1..127", () => {
    for (let n = 1; n <= 127; n++) {
      const state = solveSevenStar(n);
      expect(sevenStarToNumber(state)).toBe(n);
    }
  });
});
```

- [ ] **Step 2: Run the test — must fail**

Run:
```bash
npm test -- src/lib/solvers/__tests__/seven-star.test.ts
```

Expected: fails with module-not-found for `../seven-star`.

- [ ] **Step 3: Implement the solver**

Create `src/lib/solvers/seven-star.ts`:

```ts
export type SevenStarState = readonly [boolean, boolean, boolean, boolean, boolean, boolean, boolean];

export function solveSevenStar(n: number): SevenStarState {
  return [
    ((n >> 0) & 1) === 1,
    ((n >> 1) & 1) === 1,
    ((n >> 2) & 1) === 1,
    ((n >> 3) & 1) === 1,
    ((n >> 4) & 1) === 1,
    ((n >> 5) & 1) === 1,
    ((n >> 6) & 1) === 1,
  ] as const;
}

export function sevenStarToNumber(states: SevenStarState): number {
  let n = 0;
  for (let i = 0; i < 7; i++) {
    if (states[i]) n |= 1 << i;
  }
  return n;
}
```

- [ ] **Step 4: Re-run — must pass**

Run:
```bash
npm test -- src/lib/solvers/__tests__/seven-star.test.ts
```

Expected: all 5 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/solvers/seven-star.ts src/lib/solvers/__tests__/seven-star.test.ts
git commit -m "feat(phase4): 175 seven-star solver"
```

---

## Task 2: 160 Forest-Matrix solver (TDD)

Closed-form 3×3 magic-square solver. Driven by the 9-cell linear expansion with basis (a = x₀, b = x₂).

**Files:**
- Create: `src/lib/solvers/forest-matrix.ts`
- Test: `src/lib/solvers/__tests__/forest-matrix.test.ts`

- [ ] **Step 1: Write the failing test file**

Create `src/lib/solvers/__tests__/forest-matrix.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { solveForestMatrix, ROOM_NAMES, type RoomName } from "../forest-matrix";

const ok = (r: ReturnType<typeof solveForestMatrix>) => {
  if (!r.ok) throw new Error("expected ok result, got " + r.reason);
  return r.cells;
};

describe("solveForestMatrix — happy path", () => {
  it("sum=15, (魁=4, 岡=6) → classic Lo Shu", () => {
    const cells = ok(
      solveForestMatrix({
        sum: 15,
        known: [
          { room: "魁", value: 4 },
          { room: "岡", value: 6 },
        ],
      }),
    );
    // Standard Lo Shu (one of its reflections):
    //   4 9 2
    //   3 5 7
    //   8 1 6
    expect(cells.魁).toBe(4);
    expect(cells.晶).toBe(9);
    expect(cells.阜).toBe(2);
    expect(cells.寶).toBe(3);
    expect(cells.帝).toBe(5);
    expect(cells.彤).toBe(7);
    expect(cells.牡).toBe(8);
    expect(cells.蒼).toBe(1);
    expect(cells.岡).toBe(6);
  });

  it("sum=12, (魁=3, 岡=5) → verified in spec worked example", () => {
    const cells = ok(
      solveForestMatrix({
        sum: 12,
        known: [
          { room: "魁", value: 3 },
          { room: "岡", value: 5 },
        ],
      }),
    );
    // Spec worked example: [3,4,5, 6,4,2, 3,4,5]
    expect([cells.魁, cells.晶, cells.阜]).toEqual([3, 4, 5]);
    expect([cells.寶, cells.帝, cells.彤]).toEqual([6, 4, 2]);
    expect([cells.牡, cells.蒼, cells.岡]).toEqual([3, 4, 5]);
  });

  it("sum=12, both knowns = center value (4, 4) → all-same solution", () => {
    const cells = ok(
      solveForestMatrix({
        sum: 12,
        known: [
          { room: "魁", value: 4 },
          { room: "晶", value: 4 },
        ],
      }),
    );
    for (const name of ROOM_NAMES) {
      expect(cells[name]).toBe(4);
    }
  });

  it("every row/column/diagonal sums to the stated sum", () => {
    const cells = ok(
      solveForestMatrix({
        sum: 15,
        known: [
          { room: "魁", value: 4 },
          { room: "岡", value: 6 },
        ],
      }),
    );
    const grid = [
      [cells.魁, cells.晶, cells.阜],
      [cells.寶, cells.帝, cells.彤],
      [cells.牡, cells.蒼, cells.岡],
    ];
    // rows
    for (const row of grid) expect(row.reduce((a, b) => a + b, 0)).toBe(15);
    // cols
    for (let c = 0; c < 3; c++) {
      expect(grid[0][c] + grid[1][c] + grid[2][c]).toBe(15);
    }
    // diagonals
    expect(grid[0][0] + grid[1][1] + grid[2][2]).toBe(15);
    expect(grid[0][2] + grid[1][1] + grid[2][0]).toBe(15);
  });
});

describe("solveForestMatrix — error reasons", () => {
  it("invalid sum → invalid_sum", () => {
    const r = solveForestMatrix({
      sum: 18 as never,
      known: [
        { room: "魁", value: 4 },
        { room: "岡", value: 6 },
      ],
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("invalid_sum");
  });

  it("value 0 → invalid_value", () => {
    const r = solveForestMatrix({
      sum: 15,
      known: [
        { room: "魁", value: 0 },
        { room: "岡", value: 6 },
      ],
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("invalid_value");
  });

  it("value 10 → invalid_value", () => {
    const r = solveForestMatrix({
      sum: 15,
      known: [
        { room: "魁", value: 4 },
        { room: "岡", value: 10 },
      ],
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("invalid_value");
  });

  it("same room twice → same_room", () => {
    const r = solveForestMatrix({
      sum: 15,
      known: [
        { room: "魁", value: 4 },
        { room: "魁", value: 6 },
      ],
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("same_room");
  });

  it("one known is 帝 → center_known", () => {
    const r = solveForestMatrix({
      sum: 15,
      known: [
        { room: "帝", value: 5 },
        { room: "魁", value: 4 },
      ],
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("center_known");
  });

  it("symmetric pair (魁, 岡) with values summing != 2c → redundant_pair", () => {
    // 魁 + 岡 must equal 2c = 10 for sum=15; here we pass inconsistent values
    // but the algorithm detects the pair structurally before checking values
    const r = solveForestMatrix({
      sum: 15,
      known: [
        { room: "魁", value: 4 },
        { room: "岡", value: 4 }, // sum != 10
      ],
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("redundant_pair");
  });

  it("symmetric pair with consistent values → still redundant_pair (infinite solutions)", () => {
    const r = solveForestMatrix({
      sum: 15,
      known: [
        { room: "魁", value: 3 },
        { room: "岡", value: 7 }, // sums to 10 = 2c, but only 1 constraint
      ],
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("redundant_pair");
  });

  it("inputs that force a cell out of 1..9 → no_valid_solution", () => {
    // sum=12, (魁=1, 阜=1): x₁ = 3c - a - b = 12 - 1 - 1 = 10 → invalid
    const r = solveForestMatrix({
      sum: 12,
      known: [
        { room: "魁", value: 1 },
        { room: "阜", value: 1 },
      ],
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("no_valid_solution");
  });
});
```

- [ ] **Step 2: Run — must fail (module missing)**

Run:
```bash
npm test -- src/lib/solvers/__tests__/forest-matrix.test.ts
```

Expected: cannot resolve `../forest-matrix`.

- [ ] **Step 3: Implement the solver**

Create `src/lib/solvers/forest-matrix.ts`:

```ts
export const ROOM_NAMES = ["魁", "晶", "阜", "寶", "帝", "彤", "牡", "蒼", "岡"] as const;
export type RoomName = (typeof ROOM_NAMES)[number];

// Position 0..8 matches ROOM_NAMES order. 4 is 帝 (center).
// Each cell is expressed as α·a + β·b + γ·c  where a = x₀, b = x₂, c = sum/3.
const COEFFICIENTS: Record<RoomName, readonly [number, number, number]> = {
  魁: [1, 0, 0],
  晶: [-1, -1, 3],
  阜: [0, 1, 0],
  寶: [-1, 1, 1],
  帝: [0, 0, 1],
  彤: [1, -1, 1],
  牡: [0, -1, 2],
  蒼: [1, 1, -1],
  岡: [-1, 0, 2],
};

export type ForestMatrixInput = {
  sum: 12 | 15;
  known: [
    { room: RoomName; value: number },
    { room: RoomName; value: number },
  ];
};

export type ForestMatrixResult =
  | { ok: true; cells: Record<RoomName, number> }
  | {
      ok: false;
      reason:
        | "invalid_sum"
        | "invalid_value"
        | "same_room"
        | "center_known"
        | "redundant_pair"
        | "no_valid_solution";
    };

export function solveForestMatrix(input: ForestMatrixInput): ForestMatrixResult {
  const { sum, known } = input;
  if (sum !== 12 && sum !== 15) return { ok: false, reason: "invalid_sum" };

  for (const k of known) {
    if (!Number.isInteger(k.value) || k.value < 1 || k.value > 9) {
      return { ok: false, reason: "invalid_value" };
    }
    if (!(k.room in COEFFICIENTS)) return { ok: false, reason: "invalid_value" };
  }

  if (known[0].room === known[1].room) return { ok: false, reason: "same_room" };
  if (known[0].room === "帝" || known[1].room === "帝") {
    return { ok: false, reason: "center_known" };
  }

  const c = sum / 3;
  const [α1, β1, γ1] = COEFFICIENTS[known[0].room];
  const [α2, β2, γ2] = COEFFICIENTS[known[1].room];

  // Solve [α1 β1; α2 β2] · [a; b] = [v1 - γ1·c; v2 - γ2·c]
  const rhs1 = known[0].value - γ1 * c;
  const rhs2 = known[1].value - γ2 * c;
  const D = α1 * β2 - β1 * α2;

  if (D === 0) return { ok: false, reason: "redundant_pair" };

  const a = (rhs1 * β2 - β1 * rhs2) / D;
  const b = (α1 * rhs2 - rhs1 * α2) / D;

  const cells = {} as Record<RoomName, number>;
  for (const name of ROOM_NAMES) {
    const [α, β, γ] = COEFFICIENTS[name];
    const v = α * a + β * b + γ * c;
    if (!Number.isInteger(v) || v < 1 || v > 9) {
      return { ok: false, reason: "no_valid_solution" };
    }
    cells[name] = v;
  }
  return { ok: true, cells };
}
```

- [ ] **Step 4: Run — must pass**

Run:
```bash
npm test -- src/lib/solvers/__tests__/forest-matrix.test.ts
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/solvers/forest-matrix.ts src/lib/solvers/__tests__/forest-matrix.test.ts
git commit -m "feat(phase4): 160 forest-matrix solver (closed-form)"
```

---

## Task 3: 180 Magic-Triangle solver (TDD)

**Files:**
- Create: `src/lib/solvers/god-quest.ts`
- Test: `src/lib/solvers/__tests__/god-quest.test.ts`

- [ ] **Step 1: Write the failing test file**

Create `src/lib/solvers/__tests__/god-quest.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { solveMagicTriangle, type TriangleSolution } from "../god-quest";

function sides(s: TriangleSolution) {
  return [
    s.T + s.u1 + s.u2 + s.BL,
    s.T + s.p1 + s.p2 + s.BR,
    s.BL + s.m1 + s.m2 + s.BR,
  ];
}
function digits(s: TriangleSolution) {
  return [s.T, s.u1, s.u2, s.BL, s.m1, s.m2, s.BR, s.p2, s.p1].sort((a, b) => a - b);
}

describe("solveMagicTriangle — happy path", () => {
  it("sum=19, leak=1 → returns ≥1 solution, each valid", () => {
    const r = solveMagicTriangle(19, 1);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.solutions.length).toBeGreaterThan(0);
    for (const s of r.solutions) {
      expect(s.u1).toBe(1); // leak lives at u1
      expect(sides(s)).toEqual([19, 19, 19]);
      expect(digits(s)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    }
  });

  it("solutions are deduplicated — no identical 9-tuple twice", () => {
    const r = solveMagicTriangle(19, 1);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const seen = new Set<string>();
    for (const s of r.solutions) {
      const key = [s.T, s.u1, s.u2, s.BL, s.m1, s.m2, s.BR, s.p2, s.p1].join(",");
      expect(seen.has(key)).toBe(false);
      seen.add(key);
    }
  });

  it("sum=20, leak=2 → every returned solution passes independent validation", () => {
    const r = solveMagicTriangle(20, 2);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    for (const s of r.solutions) {
      expect(s.u1).toBe(2);
      expect(sides(s)).toEqual([20, 20, 20]);
      expect(digits(s)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    }
  });
});

describe("solveMagicTriangle — error reasons", () => {
  it("sum 16 (below range) → invalid_sum", () => {
    const r = solveMagicTriangle(16, 1);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("invalid_sum");
  });

  it("sum 24 (above range) → invalid_sum", () => {
    const r = solveMagicTriangle(24, 1);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("invalid_sum");
  });

  it("leak 0 → invalid_leak", () => {
    const r = solveMagicTriangle(19, 0);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("invalid_leak");
  });

  it("leak 10 → invalid_leak", () => {
    const r = solveMagicTriangle(19, 10);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("invalid_leak");
  });
});
```

- [ ] **Step 2: Run — must fail**

Run:
```bash
npm test -- src/lib/solvers/__tests__/god-quest.test.ts
```

Expected: cannot resolve module.

- [ ] **Step 3: Implement the solver**

Create `src/lib/solvers/god-quest.ts`:

```ts
export type TriangleSolution = {
  T: number;
  BL: number;
  BR: number;
  u1: number; // always === leak
  u2: number;
  p1: number;
  p2: number;
  m1: number;
  m2: number;
};

export type MagicTriangleResult =
  | { ok: true; solutions: TriangleSolution[] }
  | { ok: false; reason: "invalid_sum" | "invalid_leak" | "no_solution" };

const VALID_SUMS = new Set([17, 18, 19, 20, 21, 22, 23]);

export function solveMagicTriangle(sum: number, leak: number): MagicTriangleResult {
  if (!VALID_SUMS.has(sum)) return { ok: false, reason: "invalid_sum" };
  if (!Number.isInteger(leak) || leak < 1 || leak > 9) {
    return { ok: false, reason: "invalid_leak" };
  }

  const cornersSum = 3 * sum - 45;
  const solutions: TriangleSolution[] = [];
  const seen = new Set<string>();

  // Enumerate ordered corner triples (T, BL, BR), distinct, 1..9, none === leak
  for (let T = 1; T <= 9; T++) {
    if (T === leak) continue;
    for (let BL = 1; BL <= 9; BL++) {
      if (BL === leak || BL === T) continue;
      const BR = cornersSum - T - BL;
      if (BR < 1 || BR > 9) continue;
      if (BR === leak || BR === T || BR === BL) continue;

      // u2 derived from left-side constraint
      const u2 = sum - T - leak - BL;
      if (u2 < 1 || u2 > 9) continue;
      if (u2 === leak || u2 === T || u2 === BL || u2 === BR) continue;

      const usedCore = new Set([T, BL, BR, leak, u2]);
      const pool = [1, 2, 3, 4, 5, 6, 7, 8, 9].filter((n) => !usedCore.has(n));

      // Right-side middles: p1 + p2 = sum - T - BR, distinct, from pool
      const rightTarget = sum - T - BR;
      for (const p1 of pool) {
        const p2 = rightTarget - p1;
        if (p2 === p1) continue;
        if (!pool.includes(p2)) continue;

        const afterRight = pool.filter((n) => n !== p1 && n !== p2);

        // Bottom middles: m1 + m2 = sum - BL - BR
        const bottomTarget = sum - BL - BR;
        for (const m1 of afterRight) {
          const m2 = bottomTarget - m1;
          if (m2 === m1) continue;
          if (!afterRight.includes(m2)) continue;

          const sol: TriangleSolution = { T, BL, BR, u1: leak, u2, p1, p2, m1, m2 };
          const key = `${T},${leak},${u2},${BL},${m1},${m2},${BR},${p2},${p1}`;
          if (seen.has(key)) continue;
          seen.add(key);
          solutions.push(sol);
        }
      }
    }
  }

  if (solutions.length === 0) return { ok: false, reason: "no_solution" };
  return { ok: true, solutions };
}
```

- [ ] **Step 4: Run — must pass**

Run:
```bash
npm test -- src/lib/solvers/__tests__/god-quest.test.ts
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/solvers/god-quest.ts src/lib/solvers/__tests__/god-quest.test.ts
git commit -m "feat(phase4): 180 magic-triangle solver (all solutions)"
```

---

## Task 4: Tools hub + navbar link + not-found

Adds the `/tools` entry page listing the 3 puzzles, plus a friendly 404 for bad slugs, plus the navbar entry.

**Files:**
- Modify: `src/components/layout/navbar.tsx`
- Create: `src/components/tools/tool-card.tsx`
- Create: `src/app/tools/page.tsx`
- Create: `src/app/tools/not-found.tsx`

- [ ] **Step 1: Add `/tools` to navbar**

Edit `src/components/layout/navbar.tsx` — add one entry to `navItems`:

```tsx
const navItems = [
  { href: "/", label: "首頁" },
  { href: "/items", label: "道具" },
  { href: "/ranking", label: "排行榜" },
  { href: "/compare", label: "比較" },
  { href: "/skills", label: "技能" },
  { href: "/monsters", label: "怪物" },
  { href: "/tools", label: "工具" },
];
```

- [ ] **Step 2: Create `tool-card.tsx`**

Create `src/components/tools/tool-card.tsx`:

```tsx
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type Props = {
  href: string;
  title: string;
  subtitle: string;
  description: string;
};

export function ToolCard({ href, title, subtitle, description }: Props) {
  return (
    <Link href={href} className="group block">
      <Card className="h-full transition-colors group-hover:border-primary/60 group-hover:bg-muted/40">
        <CardHeader>
          <CardTitle className="font-heading text-xl">{title}</CardTitle>
          <CardDescription className="text-base text-foreground/80">{subtitle}</CardDescription>
        </CardHeader>
        <CardContent className="text-muted-foreground text-sm">{description}</CardContent>
      </Card>
    </Link>
  );
}
```

- [ ] **Step 3: Create the hub page**

Create `src/app/tools/page.tsx`:

```tsx
import type { Metadata } from "next";
import { ToolCard } from "@/components/tools/tool-card";

export const metadata: Metadata = {
  title: "副本解謎工具 | Genbu",
  description: "160 迷霧九宮格、175 北斗七星、180 神武禁地互動解題器。",
};

export default function ToolsHubPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <header className="mb-8">
        <h1 className="font-heading text-3xl font-bold">副本解謎工具</h1>
        <p className="text-muted-foreground mt-2 text-sm">
          三個互動式解題器，協助破解遊戲中的機關副本。
        </p>
      </header>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <ToolCard
          href="/tools/160"
          title="160 副本"
          subtitle="迷霧九宮格"
          description="輸入總和與兩間關閉房間，推算其餘 7 間的水晶數。"
        />
        <ToolCard
          href="/tools/175"
          title="175 副本"
          subtitle="北斗七星"
          description="輸入數字（1~127）即時計算七顆星的開關狀態。"
        />
        <ToolCard
          href="/tools/180"
          title="180 副本"
          subtitle="神武禁地"
          description="輸入總和與左上中（封印）數字，列出所有魔三角形解。"
        />
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Create the tools 404**

Create `src/app/tools/not-found.tsx`:

```tsx
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function ToolsNotFound() {
  return (
    <div className="mx-auto max-w-xl px-4 py-16 text-center">
      <h1 className="font-heading text-2xl font-bold">找不到這個工具</h1>
      <p className="text-muted-foreground mt-2 text-sm">目前只支援 160 / 175 / 180 三個副本。</p>
      <Link href="/tools" className={cn(buttonVariants({ variant: "default" }), "mt-6")}>
        回到工具列表
      </Link>
    </div>
  );
}
```

- [ ] **Step 5: Verify dev server renders**

Run:
```bash
npm run dev
```

Visit http://localhost:3000/tools — confirm 3 cards render, nav has "工具" entry, clicking a card shows 404 for 160/175/180 (pages not built yet, expected). Visit http://localhost:3000/tools/abc — not-found should render.

Kill the dev server.

- [ ] **Step 6: Typecheck + lint + test**

Run in parallel:
```bash
npm run typecheck
npm run lint
npm test
```

Expected: all green.

- [ ] **Step 7: Commit**

```bash
git add src/components/layout/navbar.tsx src/components/tools/tool-card.tsx src/app/tools/page.tsx src/app/tools/not-found.tsx
git commit -m "feat(phase4): /tools hub + navbar link + tools 404"
```

---

## Task 5: Inline alert helper

Minimal destructive-styled alert div used by all three solver UIs for error display. Built here once.

**Files:**
- Create: `src/components/tools/inline-alert.tsx`

- [ ] **Step 1: Create the alert component**

Create `src/components/tools/inline-alert.tsx`:

```tsx
import type { ReactNode } from "react";

export function InlineAlert({ children }: { children: ReactNode }) {
  return (
    <div
      role="alert"
      className="border-destructive/40 bg-destructive/10 text-destructive rounded-md border px-3 py-2 text-sm"
    >
      {children}
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run:
```bash
npm run typecheck
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/tools/inline-alert.tsx
git commit -m "feat(phase4): inline-alert shared by solver UIs"
```

---

## Task 6: 175 Seven-Star UI

Two-way bound: number input ↔ 7 star toggles.

**Files:**
- Create: `src/components/tools/seven-star-solver.tsx`
- Create: `src/app/tools/175/page.tsx`

- [ ] **Step 1: Create the solver component**

Create `src/components/tools/seven-star-solver.tsx`:

```tsx
"use client";

import { useState } from "react";
import { Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  solveSevenStar,
  sevenStarToNumber,
  type SevenStarState,
} from "@/lib/solvers/seven-star";
import { InlineAlert } from "./inline-alert";

function isValid(n: number) {
  return Number.isInteger(n) && n >= 1 && n <= 127;
}

export function SevenStarSolver() {
  const [states, setStates] = useState<SevenStarState>(() => solveSevenStar(1));
  const [raw, setRaw] = useState("1");

  const n = sevenStarToNumber(states);
  const parsed = Number(raw);
  const rawInvalid = raw.trim() !== "" && !isValid(parsed);

  function handleNumberChange(v: string) {
    setRaw(v);
    const parsedV = Number(v);
    if (isValid(parsedV)) setStates(solveSevenStar(parsedV));
  }

  function toggleStar(i: number) {
    const next = states.map((s, idx) => (idx === i ? !s : s)) as unknown as SevenStarState;
    setStates(next);
    setRaw(String(sevenStarToNumber(next)));
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <label className="text-sm font-medium">輸入數字（1~127）</label>
        <Input
          type="number"
          inputMode="numeric"
          min={1}
          max={127}
          value={raw}
          onChange={(e) => handleNumberChange(e.target.value)}
          className="max-w-xs"
        />
        {rawInvalid && <InlineAlert>數字須介於 1~127 且為整數</InlineAlert>}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {states.map((on, i) => (
          <Button
            key={i}
            variant="ghost"
            size="lg"
            onClick={() => toggleStar(i)}
            aria-label={`星 ${i + 1} ${on ? "開" : "關"}`}
            className="flex h-16 w-16 flex-col gap-1 p-1"
          >
            <Star
              className={on ? "h-8 w-8 fill-amber-400 text-amber-400" : "text-muted-foreground h-8 w-8"}
            />
            <span className="text-xs">星{i + 1}</span>
          </Button>
        ))}
      </div>

      <div className="text-muted-foreground font-mono text-sm">
        二進位（星 1..7）: {states.map((s) => (s ? "1" : "0")).join(" ")}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create the page**

Create `src/app/tools/175/page.tsx`:

```tsx
import type { Metadata } from "next";
import { SevenStarSolver } from "@/components/tools/seven-star-solver";

export const metadata: Metadata = {
  title: "175 北斗七星 | Genbu",
  description: "北斗七星開關解題器。",
};

export default function SevenStarPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <header className="mb-6">
        <h1 className="font-heading text-3xl font-bold">175 副本 — 北斗七星</h1>
        <p className="text-muted-foreground mt-2 text-sm">
          輸入大機關給的數字（1~127），即時顯示每顆星的開關狀態。也可直接點擊星星切換開關。
        </p>
      </header>
      <SevenStarSolver />
    </div>
  );
}
```

- [ ] **Step 3: Verify in browser**

Run:
```bash
npm run dev
```

Visit http://localhost:3000/tools/175. Test: type `85` → stars light pattern `1 0 1 0 1 0 1`; click star 1 (turn off) → number becomes 84; type `128` → inline error; type `0` → inline error.

Kill the dev server.

- [ ] **Step 4: Typecheck + lint**

Run in parallel:
```bash
npm run typecheck
npm run lint
```

Expected: green.

- [ ] **Step 5: Commit**

```bash
git add src/components/tools/seven-star-solver.tsx src/app/tools/175/page.tsx
git commit -m "feat(phase4): 175 seven-star UI with two-way binding"
```

---

## Task 7: 160 Forest-Matrix UI

3×3 grid of cells. Sum picker (12/15). Click cell → number-pad popover.

**Files:**
- Create: `src/components/tools/number-pad-popover.tsx`
- Create: `src/components/tools/forest-matrix-solver.tsx`
- Create: `src/app/tools/160/page.tsx`

- [ ] **Step 1: Create number-pad-popover**

Create `src/components/tools/number-pad-popover.tsx`:

```tsx
"use client";

import { useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";

type Props = {
  value: number | null;
  disabled?: boolean;
  trigger: React.ReactNode;
  onPick: (n: number | null) => void;
};

export function NumberPadPopover({ value, disabled, trigger, onPick }: Props) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild disabled={disabled}>
        {trigger}
      </PopoverTrigger>
      <PopoverContent className="w-auto p-2">
        <div className="grid grid-cols-3 gap-1">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
            <Button
              key={n}
              variant={value === n ? "default" : "outline"}
              size="sm"
              className="h-11 w-11 text-base"
              onClick={() => {
                onPick(n);
                setOpen(false);
              }}
            >
              {n}
            </Button>
          ))}
          <Button
            variant="ghost"
            size="sm"
            className="col-span-3 h-9"
            onClick={() => {
              onPick(null);
              setOpen(false);
            }}
          >
            清除
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
```

- [ ] **Step 2: Create forest-matrix-solver**

Create `src/components/tools/forest-matrix-solver.tsx`:

```tsx
"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  ROOM_NAMES,
  solveForestMatrix,
  type RoomName,
  type ForestMatrixResult,
} from "@/lib/solvers/forest-matrix";
import { NumberPadPopover } from "./number-pad-popover";
import { InlineAlert } from "./inline-alert";

type Inputs = Record<RoomName, number | null>;

const EMPTY: Inputs = {
  魁: null, 晶: null, 阜: null,
  寶: null, 帝: null, 彤: null,
  牡: null, 蒼: null, 岡: null,
};

const REASON_MESSAGE: Record<
  Exclude<ForestMatrixResult, { ok: true }>["reason"],
  string
> = {
  invalid_sum: "總和必須是 12 或 15",
  invalid_value: "水晶數必須是 1~9 的整數",
  same_room: "兩間房間不能重複",
  center_known: "帝之間由總和自動決定，不能當作關閉的房間",
  redundant_pair: "這兩間互為對稱（通過帝之間的同一條線），無法唯一求解",
  no_valid_solution: "這組輸入無合法解（推算出的格子超出 1~9）",
};

export function ForestMatrixSolver() {
  const [sum, setSum] = useState<12 | 15>(15);
  const [inputs, setInputs] = useState<Inputs>(EMPTY);

  const known = useMemo(
    () =>
      ROOM_NAMES.filter((r) => r !== "帝" && inputs[r] !== null).map((r) => ({
        room: r,
        value: inputs[r] as number,
      })),
    [inputs],
  );

  const centerValue = sum / 3;
  const [result, setResult] = useState<ForestMatrixResult | null>(null);

  function setRoom(r: RoomName, v: number | null) {
    setInputs((prev) => ({ ...prev, [r]: v }));
    setResult(null); // invalidate previous result on any change
  }

  function onSolve() {
    if (known.length !== 2) return;
    setResult(
      solveForestMatrix({
        sum,
        known: [known[0], known[1]],
      }),
    );
  }

  function onClear() {
    setInputs(EMPTY);
    setResult(null);
  }

  const solved = result?.ok ? result.cells : null;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <span className="text-sm font-medium">總和</span>
        {[12, 15].map((n) => (
          <Button
            key={n}
            variant={sum === n ? "default" : "outline"}
            size="sm"
            onClick={() => {
              setSum(n as 12 | 15);
              setResult(null);
            }}
          >
            {n}
          </Button>
        ))}
        <span className="text-muted-foreground ml-2 text-sm">
          帝 = {centerValue}
        </span>
      </div>

      <div className="mx-auto grid w-fit grid-cols-3 gap-2">
        {ROOM_NAMES.map((room) => {
          const isCenter = room === "帝";
          const input = inputs[room];
          const solvedValue = solved ? solved[room] : null;
          const display = isCenter
            ? centerValue
            : input !== null
              ? input
              : solvedValue;
          const isDerived = solved !== null && input === null && !isCenter;

          const cellClasses = cn(
            "flex h-20 w-20 flex-col items-center justify-center rounded-md border text-center transition-colors",
            "sm:h-24 sm:w-24",
            isCenter && "bg-muted/60 border-border/60",
            !isCenter && display === null && "bg-card hover:bg-muted/40",
            !isCenter && display !== null && !isDerived && "bg-card",
            isDerived && "bg-emerald-500/15 border-emerald-500/40 text-emerald-900 dark:text-emerald-200",
          );

          const trigger = (
            <button type="button" className={cellClasses}>
              <span className="text-muted-foreground text-xs">{room}</span>
              <span className="font-heading text-2xl">
                {display ?? "—"}
              </span>
            </button>
          );

          if (isCenter) {
            return (
              <div key={room} className={cellClasses}>
                <span className="text-muted-foreground text-xs">{room}</span>
                <span className="font-heading text-2xl">{centerValue}</span>
              </div>
            );
          }

          return (
            <NumberPadPopover
              key={room}
              value={input}
              trigger={trigger}
              onPick={(v) => setRoom(room, v)}
            />
          );
        })}
      </div>

      <div className="flex items-center gap-2">
        <Button disabled={known.length !== 2} onClick={onSolve}>
          解題
        </Button>
        <Button variant="outline" onClick={onClear}>
          清除
        </Button>
        <span className="text-muted-foreground text-xs">
          已填 {known.length} / 2 間關閉房間
        </span>
      </div>

      {result && !result.ok && <InlineAlert>{REASON_MESSAGE[result.reason]}</InlineAlert>}
    </div>
  );
}
```

- [ ] **Step 3: Create the page**

Create `src/app/tools/160/page.tsx`:

```tsx
import type { Metadata } from "next";
import { ForestMatrixSolver } from "@/components/tools/forest-matrix-solver";

export const metadata: Metadata = {
  title: "160 迷霧九宮格 | Genbu",
  description: "迷霧九宮格九宮格魔方解題器。",
};

export default function ForestMatrixPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <header className="mb-6">
        <h1 className="font-heading text-3xl font-bold">160 副本 — 迷霧九宮格</h1>
        <p className="text-muted-foreground mt-2 text-sm">
          選擇總和（12 或 15），點擊兩間關閉的房間輸入 NPC 給的水晶數，點「解題」即可推算其餘 7 間。
        </p>
      </header>
      <ForestMatrixSolver />
    </div>
  );
}
```

- [ ] **Step 4: Verify in browser**

Run:
```bash
npm run dev
```

Visit http://localhost:3000/tools/160. Cases to test manually:
1. Sum=15, 魁=4, 岡=6 → solve → Lo Shu `4 9 2 / 3 5 7 / 8 1 6` with derived cells green.
2. Sum=15, 魁=4, 岡=4 → solve → error "互為對稱".
3. Sum=12, 魁=1, 阜=1 → solve → error "無合法解".
4. 清除 → all cells reset, 帝 still shows sum/3.

Kill dev server.

- [ ] **Step 5: Typecheck + lint**

Run in parallel:
```bash
npm run typecheck
npm run lint
```

Expected: green.

- [ ] **Step 6: Commit**

```bash
git add src/components/tools/number-pad-popover.tsx src/components/tools/forest-matrix-solver.tsx src/app/tools/160/page.tsx
git commit -m "feat(phase4): 160 forest-matrix UI with number-pad popover"
```

---

## Task 8: 180 Magic-Triangle UI

Form (sum + leak), compute button, solution carousel with SVG triangle rendering.

**Files:**
- Create: `src/components/tools/magic-triangle-svg.tsx`
- Create: `src/components/tools/god-quest-solver.tsx`
- Create: `src/app/tools/180/page.tsx`

- [ ] **Step 1: Create the SVG triangle renderer**

Create `src/components/tools/magic-triangle-svg.tsx`:

```tsx
import type { TriangleSolution } from "@/lib/solvers/god-quest";

type CellSpec = {
  cx: number;
  cy: number;
  value: number;
  highlight?: boolean;
};

export function MagicTriangleSvg({ solution }: { solution: TriangleSolution }) {
  // viewBox 420x420; triangle occupies 60..360 horizontal, 60..360 vertical
  const cells: CellSpec[] = [
    { cx: 210, cy: 60, value: solution.T },                 // T
    { cx: 160, cy: 150, value: solution.u1, highlight: true }, // u1 (leak)
    { cx: 260, cy: 150, value: solution.p1 },               // p1
    { cx: 110, cy: 240, value: solution.u2 },               // u2
    { cx: 310, cy: 240, value: solution.p2 },               // p2
    { cx: 60, cy: 360, value: solution.BL },                // BL
    { cx: 160, cy: 360, value: solution.m1 },               // m1
    { cx: 260, cy: 360, value: solution.m2 },               // m2
    { cx: 360, cy: 360, value: solution.BR },               // BR
  ];

  return (
    <svg
      viewBox="0 0 420 420"
      className="h-auto w-full max-w-[420px]"
      role="img"
      aria-label="魔三角形解答"
    >
      <polygon
        points="210,60 60,360 360,360"
        className="stroke-border/70 fill-none"
        strokeWidth={2}
      />
      {cells.map((c, i) => (
        <g key={i}>
          <circle
            cx={c.cx}
            cy={c.cy}
            r={26}
            className={
              c.highlight
                ? "fill-rose-500/15 stroke-rose-500"
                : "fill-card stroke-border"
            }
            strokeWidth={2}
          />
          <text
            x={c.cx}
            y={c.cy + 8}
            textAnchor="middle"
            className={
              c.highlight
                ? "fill-rose-600 dark:fill-rose-300 font-semibold"
                : "fill-foreground font-semibold"
            }
            fontSize={22}
          >
            {c.value}
          </text>
        </g>
      ))}
    </svg>
  );
}
```

- [ ] **Step 2: Create god-quest-solver**

Create `src/components/tools/god-quest-solver.tsx`:

```tsx
"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  solveMagicTriangle,
  type MagicTriangleResult,
} from "@/lib/solvers/god-quest";
import { InlineAlert } from "./inline-alert";
import { MagicTriangleSvg } from "./magic-triangle-svg";

const VALID_SUMS = [17, 18, 19, 20, 21, 22, 23] as const;

const REASON_MESSAGE: Record<
  Exclude<MagicTriangleResult, { ok: true }>["reason"],
  string
> = {
  invalid_sum: "總和必須在 17 ~ 23 之間",
  invalid_leak: "封印數字必須是 1 ~ 9 的整數",
  no_solution: "這組輸入沒有合法解",
};

export function GodQuestSolver() {
  const [sum, setSum] = useState<number>(19);
  const [leakInput, setLeakInput] = useState("1");
  const [result, setResult] = useState<MagicTriangleResult | null>(null);
  const [index, setIndex] = useState(0);

  function onSolve() {
    const leak = Number(leakInput);
    setResult(solveMagicTriangle(sum, leak));
    setIndex(0);
  }

  const solutions = result?.ok ? result.solutions : [];
  const current = solutions[index];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-4">
        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium">總和</label>
          <Select value={String(sum)} onValueChange={(v) => setSum(Number(v))}>
            <SelectTrigger className="w-28">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {VALID_SUMS.map((n) => (
                <SelectItem key={n} value={String(n)}>
                  {n}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium">封印數字（左上中）</label>
          <Input
            type="number"
            inputMode="numeric"
            min={1}
            max={9}
            value={leakInput}
            onChange={(e) => setLeakInput(e.target.value)}
            className="w-28"
          />
        </div>
        <Button onClick={onSolve}>計算</Button>
      </div>

      {result && !result.ok && <InlineAlert>{REASON_MESSAGE[result.reason]}</InlineAlert>}

      {result?.ok && current && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">
              共 {solutions.length} 組解 — 第 {index + 1} 組
            </span>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="icon"
                disabled={index === 0}
                onClick={() => setIndex((i) => Math.max(0, i - 1))}
                aria-label="上一組"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                disabled={index >= solutions.length - 1}
                onClick={() => setIndex((i) => Math.min(solutions.length - 1, i + 1))}
                aria-label="下一組"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="flex justify-center">
            <MagicTriangleSvg solution={current} />
          </div>

          <div className="text-muted-foreground text-center text-sm">
            左邊 = {current.T + current.u1 + current.u2 + current.BL}
            ｜ 右邊 = {current.T + current.p1 + current.p2 + current.BR}
            ｜ 底邊 = {current.BL + current.m1 + current.m2 + current.BR}
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Create the page**

Create `src/app/tools/180/page.tsx`:

```tsx
import type { Metadata } from "next";
import { GodQuestSolver } from "@/components/tools/god-quest-solver";

export const metadata: Metadata = {
  title: "180 神武禁地 | Genbu",
  description: "神武禁地魔三角形解題器。",
};

export default function GodQuestPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <header className="mb-6">
        <h1 className="font-heading text-3xl font-bold">180 副本 — 神武禁地</h1>
        <p className="text-muted-foreground mt-2 text-sm">
          9 格魔三角形，每邊 4 格總和相同，1~9 各用一次，封印數字固定在左上中。輸入總和與封印數字，列出所有合法解。
        </p>
      </header>
      <GodQuestSolver />
    </div>
  );
}
```

- [ ] **Step 4: Verify in browser**

Run:
```bash
npm run dev
```

Visit http://localhost:3000/tools/180. Cases:
1. Sum=19, leak=1 → should return ≥1 solution; first solution's 3 side sums all = 19; u₁ cell highlighted rose.
2. Prev/next navigation disables correctly at ends.
3. Sum=16 can't be picked (only 17..23 in dropdown). Sum=19, leak=`0` → inline error.
4. Known no-solution case: try Sum=17, leak=9 — either shows solutions or "無合法解".

Kill dev server.

- [ ] **Step 5: Typecheck + lint**

Run in parallel:
```bash
npm run typecheck
npm run lint
```

Expected: green.

- [ ] **Step 6: Commit**

```bash
git add src/components/tools/magic-triangle-svg.tsx src/components/tools/god-quest-solver.tsx src/app/tools/180/page.tsx
git commit -m "feat(phase4): 180 magic-triangle UI with SVG renderer + carousel"
```

---

## Task 9: Final verification

Full-suite run + manual mobile viewport check.

- [ ] **Step 1: Run all checks**

Run in parallel:
```bash
npm run typecheck
npm run lint
npm test
npm run build
```

Expected: all green. `next build` confirms all pages pre-render without runtime errors.

- [ ] **Step 2: Mobile viewport manual QA**

Run:
```bash
npm run dev
```

Open DevTools, switch to mobile (iPhone 14 or similar, 390×844). Walk through:
- `/tools` — cards stack to 1 column on small width.
- `/tools/175` — 7 stars wrap to 2 rows if needed; all tap targets ≥ 44px.
- `/tools/160` — 3×3 grid fits screen; number-pad popover buttons easily tappable.
- `/tools/180` — triangle SVG scales to width; prev/next buttons reachable.

Kill dev server.

- [ ] **Step 3: Final commit if any polish tweaks needed**

Only if visual issues were found in Step 2.

```bash
git add -u
git commit -m "feat(phase4): mobile polish"
```

- [ ] **Step 4: Push branch**

```bash
git push -u origin phase-4-dungeon-tools
```

Expected: branch published; PR can be opened at the returned URL.
