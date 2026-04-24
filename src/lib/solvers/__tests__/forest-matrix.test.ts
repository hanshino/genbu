import { describe, it, expect } from "vitest";
import { solveForestMatrix, ROOM_NAMES, type RoomName } from "../forest-matrix";

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

  it("inputs that force a cell out of 1..9 → no_valid_solution", () => {
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
