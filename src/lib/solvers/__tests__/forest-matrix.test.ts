import { describe, it, expect } from "vitest";
import { solveForestMatrix, ROOM_NAMES, GRID_LAYOUT } from "../forest-matrix";

const ok = (r: ReturnType<typeof solveForestMatrix>) => {
  if (!r.ok) throw new Error("expected ok result, got " + r.reason);
  return r.cells;
};

describe("solveForestMatrix — happy path", () => {
  it("sum=15, (魁=4, 阜=2) → classic Lo Shu", () => {
    const cells = ok(
      solveForestMatrix({
        sum: 15,
        known: [
          { room: "魁", value: 4 },
          { room: "阜", value: 2 },
        ],
      }),
    );
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

  it("sum=12, (魁=3, 阜=5) → verified in spec worked example", () => {
    const cells = ok(
      solveForestMatrix({
        sum: 12,
        known: [
          { room: "魁", value: 3 },
          { room: "阜", value: 5 },
        ],
      }),
    );
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
          { room: "阜", value: 2 },
        ],
      }),
    );
    const grid = [
      [cells.魁, cells.晶, cells.阜],
      [cells.寶, cells.帝, cells.彤],
      [cells.牡, cells.蒼, cells.岡],
    ];
    for (const row of grid) expect(row.reduce((a, b) => a + b, 0)).toBe(15);
    for (let c = 0; c < 3; c++) {
      expect(grid[0][c] + grid[1][c] + grid[2][c]).toBe(15);
    }
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
    const r = solveForestMatrix({
      sum: 15,
      known: [
        { room: "魁", value: 4 },
        { room: "岡", value: 4 },
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
        { room: "岡", value: 7 },
      ],
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("redundant_pair");
  });

  it("inputs that force a cell out of 0..9 → no_valid_solution", () => {
    const r = solveForestMatrix({
      sum: 12,
      known: [
        { room: "魁", value: 1 },
        { room: "阜", value: 9 },
      ],
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("no_valid_solution");
  });

  it("sum=12, (晶=6, 阜=5) → 彤=0 is a legal board, not no_valid_solution", () => {
    const cells = ok(
      solveForestMatrix({
        sum: 12,
        known: [
          { room: "晶", value: 6 },
          { room: "阜", value: 5 },
        ],
      }),
    );
    expect(cells.彤).toBe(0);
    const grid = [
      [cells.魁, cells.寶, cells.牡],
      [cells.晶, cells.帝, cells.蒼],
      [cells.阜, cells.彤, cells.岡],
    ];
    for (const row of grid) expect(row.reduce((a, b) => a + b, 0)).toBe(12);
    for (let c = 0; c < 3; c++) {
      expect(grid[0][c] + grid[1][c] + grid[2][c]).toBe(12);
    }
    expect(grid[0][0] + grid[1][1] + grid[2][2]).toBe(12);
    expect(grid[0][2] + grid[1][1] + grid[2][0]).toBe(12);
  });
});

describe("GRID_LAYOUT — visual 九宮格 placement (九鼎 directions)", () => {
  it("matches the in-game layout: rows 魁寶牡 / 晶帝蒼 / 阜彤岡", () => {
    // Reported by a player and corroborated by the historical 九鼎 directions
    // (中=帝, 北=寶, 東=蒼, 南=彤, 西=晶, 東北=牡, 東南=岡, 西南=阜, 西北=魁).
    expect([...GRID_LAYOUT]).toEqual([
      "魁", "寶", "牡",
      "晶", "帝", "蒼",
      "阜", "彤", "岡",
    ]);
  });

  it("keeps 帝 in the centre cell", () => {
    expect(GRID_LAYOUT[4]).toBe("帝");
  });

  it("contains exactly the nine rooms (a permutation of ROOM_NAMES)", () => {
    expect([...GRID_LAYOUT].sort()).toEqual([...ROOM_NAMES].sort());
  });

  it("is the transpose of the solver's internal ROOM_NAMES order", () => {
    // ROOM_NAMES row-major = 魁晶阜 / 寶帝彤 / 牡蒼岡; its transpose is GRID_LAYOUT.
    const transpose = [0, 3, 6, 1, 4, 7, 2, 5, 8].map((i) => ROOM_NAMES[i]);
    expect([...GRID_LAYOUT]).toEqual(transpose);
  });

  it("renders a valid magic square in display order (every row/col/diagonal = sum)", () => {
    const cells = ok(
      solveForestMatrix({
        sum: 15,
        known: [
          { room: "魁", value: 4 },
          { room: "阜", value: 2 },
        ],
      }),
    );
    const g = GRID_LAYOUT.map((r) => cells[r]);
    const grid = [
      [g[0], g[1], g[2]],
      [g[3], g[4], g[5]],
      [g[6], g[7], g[8]],
    ];
    for (const row of grid) expect(row.reduce((a, b) => a + b, 0)).toBe(15);
    for (let col = 0; col < 3; col++) {
      expect(grid[0][col] + grid[1][col] + grid[2][col]).toBe(15);
    }
    expect(grid[0][0] + grid[1][1] + grid[2][2]).toBe(15);
    expect(grid[0][2] + grid[1][1] + grid[2][0]).toBe(15);
  });
});
