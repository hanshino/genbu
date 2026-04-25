# Phase 4 — Dungeon Puzzle Tools Design

**Date:** 2026-04-25
**Status:** Approved for implementation planning
**Supersedes:** `docs/plans/phase4.md` (which contains a mistaken geometry for 180)

## Overview

Implement three interactive puzzle solvers for the 160 / 175 / 180 dungeons, upgrading the LINE Bot's text-only flow to visual interactive UI. All computation is client-side; no API layer.

The original planning document (`docs/plans/phase4.md`) captures most of the UX intent correctly, but this spec supersedes it on three points:

1. **160 algorithm** — replace the LINE Bot's iterative constraint propagation with a closed-form linear-algebra solve.
2. **180 geometry** — correct the geometry from "3×3 magic square" to **9-cell magic triangle**.
3. **180 algorithm** — replace the buggy enumeration (with its `results.length <= 1` bailout) with a clean corner-triple + side-pair enumeration that returns all valid solutions.

---

## 1. Puzzle Tools Hub (`/tools`)

Entry page with three cards:

```
┌──────────────────────────────────────────────────┐
│ 副本解謎工具                                      │
│                                                    │
│ ┌──────────┐ ┌──────────┐ ┌──────────┐          │
│ │ 160      │ │ 175      │ │ 180      │          │
│ │ 迷霧九宮格│ │ 北斗七星  │ │ 神武禁地  │          │
│ │          │ │          │ │          │          │
│ │ 魔方解題器│ │ 七星計算器│ │ 魔三角解題│          │
│ └──────────┘ └──────────┘ └──────────┘          │
└──────────────────────────────────────────────────┘
```

`/tools/not-found.tsx` handles `/tools/<bad-slug>` with a friendly 404.

---

## 2. 160 迷霧九宮格 (Forest Matrix) — `/tools/160`

### 2.1 Geometry & Rules

3×3 grid with rooms named 魁/晶/阜/寶/帝/彤/牡/蒼/岡 at positions 0..8:

```
魁(0) │ 晶(1) │ 阜(2)
──────┼───────┼──────
寶(3) │ 帝(4) │ 彤(5)
──────┼───────┼──────
牡(6) │ 蒼(7) │ 岡(8)
```

- Each cell holds a value in **1~9 (repeats allowed)**.
- All 3 rows, 3 columns, and 2 diagonals must sum to `sum`.
- **`sum ∈ {12, 15}`** (hidden game rule, always one of these two).
- 帝 (center, x₄) is auto-fixed to `sum/3`.
- The player gets 2 "closed" rooms (name + value) from an NPC and must derive the other 7.

### 2.2 Algorithm — Closed-form linear-algebra solve

**Core identity:** in a 3×3 magic square with magic sum S and center c = S/3, the four lines through the center give four symmetric pairs each summing to 2c:

- (x₀, x₈), (x₂, x₆) — diagonals
- (x₁, x₇) — middle column
- (x₃, x₅) — middle row

Parameterising by **a = x₀, b = x₂**, all nine cells follow from three scalars (a, b, c):

| Cell | Formula     |
| ---- | ----------- |
| x₀   | a           |
| x₁   | 3c − a − b  |
| x₂   | b           |
| x₃   | c + b − a   |
| x₄   | c           |
| x₅   | c + a − b   |
| x₆   | 2c − b      |
| x₇   | a + b − c   |
| x₈   | 2c − a      |

**Solve procedure** (given `sum` and two known cells (pᵢ, vᵢ), (pⱼ, vⱼ)):

1. Validate: `sum ∈ {12,15}`; room names resolve to indices 0..8; values are integers in 1~9; the two knowns are not the same room; neither known is 帝 (center is auto-derived — allowing it as a "closed room" would reduce the 2 inputs to effectively 1 and leave infinite solutions).
2. Look up the linear expansion of each cell position as `(α·a + β·b + γ·c)`, precomputed from the table above. E.g., x₃ expands to `(-1, 1, 1)`.
3. Build a 2×2 linear system for unknowns (a, b) using the two known cells:

   ```
   [α_i  β_i]   [a]   [v_i − γ_i·c]
   [α_j  β_j] · [b] = [v_j − γ_j·c]
   ```

4. Compute determinant `D = α_i·β_j − β_i·α_j`:
   - `D = 0` → the two knowns are a symmetric pair (or both the center); return `{ ok: false, reason: 'redundant_pair' }` with friendly message "這兩間房間互為對稱，無法唯一求解".
   - Otherwise solve for (a, b) via Cramer's rule.
5. Apply the 9 formulas to compute all cells.
6. Validate every cell is an integer in 1~9. If not → `{ ok: false, reason: 'no_valid_solution' }`.

**Complexity:** O(1). No iteration, no magic `count < 5`.

### 2.3 Fixes vs. LINE Bot's implementation

- ❌→✅ Drops the "iterate up to 5 times" heuristic.
- ❌→✅ Drops the hand-coded per-cell `check` arrays (9 cells × 2–3 pairs each) — replaced by the 9 formulas above.
- ❌→✅ Adds consistency validation: inconsistent inputs return a clear error instead of a partial/wrong result.
- ❌→✅ Symmetric-pair detection is structural (`D == 0`), not positional (`order + order == 8`).
- ❌→✅ The "全等特例" (both knowns = c → fill all) is no longer special; it falls out of `a = b = c`.

### 2.4 UI

- 3×3 grid of cells rendered via shadcn-styled `Card`/`Button` primitives.
- `sum` chosen via radio/segment (`12` / `15`). Changing it auto-updates 帝's displayed value.
- Click a cell → shadcn `Popover` with a 1–9 number pad (touch-friendly, ≥44px targets).
- 帝 is non-interactive (auto-shows `sum/3`); user selects 2 of the other 8 cells as the closed rooms.
- "解題" button enables once exactly 2 non-center cells are filled.
- Result rendering:
  - Known cells: default `bg-card`.
  - Derived cells: `bg-emerald-500/20` + emerald text (use Tailwind theme, not arbitrary colours).
  - Center (帝): auto-filled, styled as derived.
- "清除" button resets.
- Errors (invalid range, symmetric pair, no solution) rendered inline above the grid via shadcn `Alert` in destructive variant.

---

## 3. 175 北斗七星 (Seven Star) — `/tools/175`

### 3.1 Geometry & Rules

7 binary switches (開 / 關). Number `n ∈ 1..127` maps to 7 bits; displayed **left-to-right as star 1..7**, with **star 1 = LSB**, star 7 = MSB (matches LINE Bot's `.reverse()` display order).

### 3.2 Algorithm

Pure bit ops — nothing to optimise:

```ts
function solveSevenStar(n: number): boolean[] {
  // index 0 = star 1 (LSB). length 7.
  return Array.from({ length: 7 }, (_, i) => ((n >> i) & 1) === 1);
}

function sevenStarToNumber(states: boolean[]): number {
  return states.reduce((acc, on, i) => acc | ((on ? 1 : 0) << i), 0);
}
```

### 3.3 UI — two-way binding

- Number input (`inputmode="numeric"`, 1–127) — typing updates all 7 stars live.
- 7 star toggles (using `lucide-react` `Star` icon, `Button` variant `ghost`) — clicking a star flips it and the number updates live.
- Invalid number (out of range, non-integer) → shadcn `Alert` destructive variant; stars freeze at last valid state.
- Star colour: 開 = `text-amber-400 fill-amber-400`, 關 = `text-muted-foreground`.
- Binary display under the stars (`font-mono`).

---

## 4. 180 神武禁地 (Magic Triangle) — `/tools/180`

### 4.1 Geometry — 9-cell magic triangle (NOT a 3×3 grid)

This is where the original `docs/plans/phase4.md` is wrong. Verified against the LINE Bot's actual output: the puzzle is a triangle, not a square.

Layout and position indices:

```
            T (0)
           /     \
        u₁(1)   p₁(7)
         /         \
       u₂(2)      p₂(8)
       /             \
    BL(3)──m₁(4)──m₂(5)──BR(6)
```

- 3 corners: **T** (top), **BL** (bottom-left), **BR** (bottom-right)
- 6 middles, 2 per side: u₁/u₂ (left side), p₁/p₂ (right side), m₁/m₂ (bottom)
- Each corner is counted on 2 sides; each middle on 1 side
- **All 9 cells must use digits 1–9, each exactly once**
- **Each side (4 cells) sums to `sum`**

### 4.2 Rules

- **`sum ∈ {17, 18, 19, 20, 21, 22, 23}`** (derived: corners_sum = 3·sum − 45 must be achievable by 3 distinct 1–9 digits, i.e. 6..24).
- **`leak`** is the game's NPC hint: a fixed digit placed at **u₁** (upper-left middle). `leak ∈ 1..9`.
- Player enters `sum` and `leak`; solver returns all valid configurations.

### 4.3 Algorithm — Enumerate corner triples + side pairs

**Core identity:** summing all three side-sums counts each corner twice and each middle once:

```
3·sum = (T + u₁ + u₂ + BL) + (BL + m₁ + m₂ + BR) + (BR + p₂ + p₁ + T)
      = 45 + (T + BL + BR)
```

So **corners_sum = 3·sum − 45**.

**Procedure:**

1. **Enumerate corner permutations.** For each ordered triple (T, BL, BR) with T + BL + BR = 3·sum − 45, all distinct, all in 1..9, all ≠ leak:
   - (Enumerate unordered triples then try all 6 orderings — corners are geometrically distinct positions, so different orderings yield different configurations.)
2. **Derive u₂.** Left side constraint: T + leak + u₂ + BL = sum → u₂ = sum − T − BL − leak. Skip if u₂ ∉ 1..9, = leak, or ∈ {T, BL, BR}.
3. **Enumerate right-side middle pair (p₁, p₂).** Right side: T + p₁ + p₂ + BR = sum → p₁ + p₂ = sum − T − BR. Enumerate ordered pairs (p₁, p₂) from digits not yet used (global pool minus {T, BL, BR, leak, u₂}), with p₁ ≠ p₂, p₁ + p₂ matching the constraint.
4. **Derive bottom pair (m₁, m₂).** Bottom: BL + m₁ + m₂ + BR = sum → m₁ + m₂ = sum − BL − BR. Enumerate ordered pairs from the remaining pool (after removing p₁, p₂).
5. Each complete assignment is one solution. Collect all.
6. If the collected list is empty → `{ ok: false, reason: 'no_solution' }` with message "這組輸入無合法解".

**Notes on why this beats the LINE Bot algorithm:**

- ❌→✅ `results.length <= 1` bailout is gone (it discards legitimate single-solution inputs).
- ❌→✅ `find()` short-circuiting is gone (it missed alternate middle-pair assignments).
- ❌→✅ Corner-permutation loop is explicit (6 orderings) instead of an implicit `i=0,1,2` rotation inside a single ordering, which conflated ordered vs. unordered in a confusing way.
- ❌→✅ Returns **all** solutions for the UI to render (per user requirement).

**Complexity:** O(triples × perms × pair_options). Corner triples summing to T ∈ [6,24] with digits 1–9 are ≤ ~20. × 6 permutations × ≤ ~4 pair options × ≤ ~2 pair options = a few hundred iterations in the worst case. Sub-millisecond.

### 4.4 UI

- Inputs: `sum` (shadcn `Select` with options 17..23) and `leak` (number input 1..9) in a form.
- "計算" button submits; validation errors rendered via `Alert` destructive.
- Results area:
  - Header: "找到 N 組解" (or "無合法解").
  - If N ≥ 1: paginated / carousel display — one solution at a time with prev/next buttons (shadcn `Button` + `lucide-react` chevrons). Minimises layout shift on small screens.
  - Each solution rendered as a triangle:
    - **SVG-based** for crisp rendering at any size.
    - Cells rendered as rounded rectangles with digits centred.
    - **u₁ (leak position)** highlighted with `stroke-rose-500` + `fill-rose-500/10` + digit in rose.
    - Other cells use default card styling.
  - Side sums shown below the triangle (e.g., "左=19 ｜ 右=19 ｜ 底=19") for at-a-glance verification.

---

## 5. Page Structure

```
src/app/tools/
├── page.tsx          # Hub (3 cards + description)
├── not-found.tsx     # /tools/<bad> 404
├── 160/page.tsx      # Client Component
├── 175/page.tsx      # Client Component
└── 180/page.tsx      # Client Component
```

All puzzle pages use `"use client"`. No server-side DB calls needed; computation is local.

Navbar (`src/components/layout/navbar.tsx`) gains a `/tools` link alongside 道具 / 技能 / 怪物.

---

## 6. Components

```
src/components/tools/
├── tool-card.tsx                 # Hub entry card
├── puzzle-cell.tsx               # Shared single-cell component (input/solved/fixed/error states)
├── number-pad-popover.tsx        # 1–9 selection popover (shadcn Popover), used by 160
├── forest-matrix-solver.tsx      # 160 — 3x3 grid UI + state
├── seven-star-solver.tsx         # 175 — number input + 7 stars
├── god-quest-solver.tsx          # 180 — form + solution carousel
└── magic-triangle-svg.tsx        # 180 — SVG triangle renderer
```

**Design note:** 180 does NOT share the 3×3 grid component with 160. The original plan proposed a shared `puzzle-grid` element; this is rejected because the geometries differ (3×3 square vs. 9-cell triangle) and forcing a common abstraction hurts clarity.

**shadcn-first:** per project convention, all visual primitives (Card, Button, Select, Alert, Popover) come from `src/components/ui/`. No hand-rolled markup for buttons, alerts, or popovers. Icons from `lucide-react` only (no Unicode glyphs, no emojis).

---

## 7. Algorithm Module

```
src/lib/solvers/
├── forest-matrix.ts    # 160
├── seven-star.ts       # 175
├── god-quest.ts        # 180 (magic-triangle)
└── __tests__/
    ├── forest-matrix.test.ts
    ├── seven-star.test.ts
    └── god-quest.test.ts
```

Pure functions with no React dependencies. Each module exports its solver plus the typed result.

### 7.1 Types

```ts
// forest-matrix.ts
export type RoomName = '魁' | '晶' | '阜' | '寶' | '帝' | '彤' | '牡' | '蒼' | '岡';

export type ForestMatrixInput = {
  sum: 12 | 15;
  known: [
    { room: RoomName; value: number },
    { room: RoomName; value: number },
  ];
};

export type ForestMatrixResult =
  | { ok: true; cells: Record<RoomName, number> }
  | { ok: false; reason: 'invalid_sum' | 'invalid_value' | 'same_room' | 'center_known' | 'redundant_pair' | 'no_valid_solution' };

export function solveForestMatrix(input: ForestMatrixInput): ForestMatrixResult;

// seven-star.ts
export type SevenStarState = readonly [boolean, boolean, boolean, boolean, boolean, boolean, boolean];

export function solveSevenStar(n: number): SevenStarState;
export function sevenStarToNumber(states: SevenStarState): number;

// god-quest.ts
export type TriangleSolution = {
  T: number; BL: number; BR: number;
  u1: number; u2: number;  // u1 === leak
  p1: number; p2: number;
  m1: number; m2: number;
};

export type MagicTriangleResult =
  | { ok: true; solutions: TriangleSolution[] }
  | { ok: false; reason: 'invalid_sum' | 'invalid_leak' | 'no_solution' };

export function solveMagicTriangle(sum: number, leak: number): MagicTriangleResult;
```

### 7.2 Testing

Each solver has unit tests covering:

**forest-matrix.test.ts**
- `sum=15, (魁,4), (岡,6)` → full Lo Shu
- `sum=12, (魁,3), (岡,5)` → verified expected grid (from the worked example in this spec)
- `sum=15, (魁,2), (岡,8)` → redundant_pair error
- `sum=15, (帝,5), (魁,4)` → `center_known` error (帝 cannot be one of the 2 closed rooms, regardless of whether its value matches sum/3). The UI prevents this path anyway — 帝 is not a clickable cell.
- Out-of-range values (0, 10) → `invalid_value`.
- Same-room twice → `same_room`.

**seven-star.test.ts**
- `solveSevenStar(0)` is out-of-range in UI but solver itself: `(0)` → `[false]*7`; UI layer validates 1..127.
- `solveSevenStar(85)` → 85 = 0b1010101 → `[true, false, true, false, true, false, true]` (star 1 = LSB).
- Round-trip: `sevenStarToNumber(solveSevenStar(n)) === n` for all n ∈ 1..127.

**god-quest.test.ts**
- `solveMagicTriangle(19, 1)` → ≥ 1 solution; every solution passes independent side-sum verification and uses digits 1–9 exactly once with u₁ === 1.
- `solveMagicTriangle(17, 9)` → at least one solution or explicit `no_solution`.
- `solveMagicTriangle(16, 1)` → `invalid_sum` (out of 17..23).
- `solveMagicTriangle(19, 10)` → `invalid_leak`.
- Deduplication: no identical 9-tuple appears twice in `solutions`.

---

## 8. Mobile Responsiveness

- 160 grid: cells `min(72px, 22vw)` square; number-pad popover sized for thumb tap.
- 175 stars: flex row with `gap-2`, wrap to 2 rows ≤ 360px width.
- 180 triangle SVG: `viewBox` with `preserveAspectRatio`; width `min(420px, 92vw)`.
- All number inputs use `inputmode="numeric"`.
- Tap targets ≥ 44×44 px everywhere.

---

## 9. Implementation Order

1. **Solvers + tests** (`src/lib/solvers/*`) — pure logic, fully testable before any UI.
2. **Shared tool primitives** — `puzzle-cell.tsx`, `number-pad-popover.tsx`, navbar link, `/tools/page.tsx` hub, `/tools/not-found.tsx`.
3. **175 solver UI** — simplest, builds confidence with the cell/button patterns.
4. **160 solver UI** — medium complexity.
5. **180 solver UI** — triangle SVG + carousel.
6. **Mobile polish pass** — verify tap targets, viewport behaviour across all three.

Each stage ends with `npm run lint` and `npm test` green before moving on.

---

## 10. Out of Scope

- No backend / API layer — all three solvers run purely client-side.
- No persistence of puzzle state across sessions.
- No "save/share" of a solved puzzle.
- No analytics or user tracking.
- No multi-language support (zh-tw only, matching project convention).
