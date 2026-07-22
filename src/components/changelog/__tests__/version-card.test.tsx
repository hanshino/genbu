import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { VersionCard } from "../version-card";
import type { ChangelogEntry } from "@/lib/changelog/types";

const items = { table: "items", label: "道具", tier: "rich" as const, counts: { added: 3, changed: 5844, removed: 45 } };

describe("VersionCard", () => {
  it("有 ai：顯示本版重點；summary 表顯示 note、不出現逐列表格", () => {
    const entry: ChangelogEntry = {
      version: "7.2.5.9",
      date: "2026-07-22",
      summary: { added: 3, changed: 5844, removed: 45 },
      addedTables: [],
      removedTables: [],
      tables: [items],
      ai: {
        model: "claude-opus-4-8",
        highlights: ["端午活動上線"],
        tables: { items: { mode: "summary", note: "售價批量調整" } },
      },
    };
    render(<VersionCard entry={entry} />);
    expect(screen.getByText("本版重點")).toBeInTheDocument();
    expect(screen.getByText("端午活動上線")).toBeInTheDocument();
    expect(screen.getByText("售價批量調整")).toBeInTheDocument();
    expect(screen.queryByText("欄位")).not.toBeInTheDocument(); // summary 無逐列表格
    expect(screen.getByTestId("table-summary-row")).toBeInTheDocument(); // summary 分支確認
  });

  it("無 ai：不顯示本版重點，退回 detail（表標籤仍在）", () => {
    const entry: ChangelogEntry = {
      version: "7.2.5.9",
      date: "2026-07-22",
      summary: { added: 3, changed: 5844, removed: 45 },
      addedTables: [],
      removedTables: [],
      tables: [items],
    };
    render(<VersionCard entry={entry} />);
    expect(screen.queryByText("本版重點")).not.toBeInTheDocument();
    expect(screen.getByText("道具")).toBeInTheDocument();
    expect(screen.queryByTestId("table-summary-row")).not.toBeInTheDocument(); // detail 分支確認
  });

  it("新增資料表：顯示 zh-tw 標籤與列數", () => {
    const entry: ChangelogEntry = {
      version: "7.2.6.3",
      date: "2026-07-22",
      summary: { added: 0, changed: 0, removed: 0 },
      addedTables: [
        { table: "achievements", label: "成就", rows: 1266 },
        { table: "shops", label: "商店", rows: 89 },
      ],
      removedTables: [],
      tables: [],
    };
    render(<VersionCard entry={entry} />);
    const line = screen.getByText(/新增資料表/);
    expect(line).toHaveTextContent("成就（+1266）");
    expect(line).toHaveTextContent("商店（+89）");
  });
});
