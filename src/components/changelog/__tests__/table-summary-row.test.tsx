import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { TableSummaryRow } from "../table-summary-row";

describe("TableSummaryRow", () => {
  it("顯示標籤、計數、note", () => {
    render(<TableSummaryRow label="道具" counts={{ added: 3, changed: 5844, removed: 45 }} note="售價批量調整" />);
    expect(screen.getByText("道具")).toBeInTheDocument();
    expect(screen.getByText("+3 ~5844 −45")).toBeInTheDocument();
    expect(screen.getByText("售價批量調整")).toBeInTheDocument();
  });
});
