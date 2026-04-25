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
      expect(s.u1).toBe(1);
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
