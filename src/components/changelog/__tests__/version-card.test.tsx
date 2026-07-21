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
  });
});
