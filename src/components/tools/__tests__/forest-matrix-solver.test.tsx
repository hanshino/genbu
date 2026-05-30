import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { ForestMatrixSolver } from "../forest-matrix-solver";
import { GRID_LAYOUT, ROOM_NAMES } from "@/lib/solvers/forest-matrix";

describe("ForestMatrixSolver — rendered 九宮格 order", () => {
  it("paints the nine rooms in 九鼎 directional order 魁寶牡 / 晶帝蒼 / 阜彤岡", () => {
    // Regression guard for the reversed-grid report: the grid must follow
    // GRID_LAYOUT, not the solver's internal ROOM_NAMES order (which would
    // render the transpose 魁晶阜 / 寶帝彤 / 牡蒼岡).
    const { container } = render(<ForestMatrixSolver />);
    const grid = container.querySelector(".grid-cols-3");
    expect(grid).not.toBeNull();

    const rooms = new Set<string>(ROOM_NAMES);
    const rendered = Array.from(grid!.querySelectorAll("span"))
      .map((s) => s.textContent ?? "")
      .filter((t) => rooms.has(t));

    expect(rendered).toEqual([...GRID_LAYOUT]);
  });
});
