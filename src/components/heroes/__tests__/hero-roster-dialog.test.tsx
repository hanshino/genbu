import { describe, it, expect } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { HeroRosterDialog } from "../hero-roster-dialog";
import type { HeroSummary } from "@/lib/types/hero";

const heroes: HeroSummary[] = [
  { id: 1, groupId: "1", name: "甲英雄", starUp: 100, combinationCount: 1 },
  { id: 2, groupId: "1", name: "乙英雄", starUp: 100, combinationCount: 1 },
  { id: 3, groupId: "2", name: "丙英雄", starUp: 100, combinationCount: 0 },
];

function Harness() {
  const [selected, setSelected] = useState<Set<number>>(new Set());
  return (
    <>
      <span data-testid="selected">{[...selected].sort((a, b) => a - b).join(",")}</span>
      <HeroRosterDialog
        open
        onOpenChange={() => {}}
        heroes={heroes}
        mainHeroId={1}
        selectedIds={selected}
        onChange={setSelected}
      />
    </>
  );
}

describe("HeroRosterDialog", () => {
  it("主英雄的勾選格被鎖定且標示自動保留，人數已含主英雄", () => {
    render(<Harness />);
    // base-ui Checkbox 是帶 role 的 span，鎖定狀態走 aria-disabled 而非原生 disabled
    const mainBox = screen.getByRole("checkbox", { name: /甲英雄/ });
    expect(mainBox).toHaveAttribute("aria-disabled", "true");
    expect(mainBox).toHaveAttribute("aria-checked", "true");
    expect(screen.getByText("主英雄 · 自動保留")).toBeInTheDocument();
    // 尚未勾選任何 companion，但主英雄自動計入 → 1 / 3
    expect(screen.getByText("1")).toBeInTheDocument();
  });

  it("勾選 companion 會回報到上層 state", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole("checkbox", { name: /乙英雄/ }));
    await waitFor(() => expect(screen.getByTestId("selected")).toHaveTextContent("2"));
  });

  it("搜尋可用名稱或編號過濾，查無時顯示提示", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const search = screen.getByRole("searchbox", { name: "搜尋英雄名稱或編號" });

    await user.type(search, "丙");
    await waitFor(() => expect(screen.queryByText("乙英雄")).not.toBeInTheDocument());
    expect(screen.getByText("丙英雄")).toBeInTheDocument();

    await user.clear(search);
    await user.type(search, "3");
    await waitFor(() => expect(screen.getByText("丙英雄")).toBeInTheDocument());

    await user.clear(search);
    await user.type(search, "查無此人");
    await waitFor(() =>
      expect(screen.getByText(/找不到符合「查無此人」的英雄/)).toBeInTheDocument(),
    );
  });

  it("全選會納入所有英雄，清除不會讓主英雄消失", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole("button", { name: "全選" }));
    await waitFor(() => expect(screen.getByTestId("selected")).toHaveTextContent("1,2,3"));

    await user.click(screen.getByRole("button", { name: "清除" }));
    await waitFor(() => expect(screen.getByTestId("selected")).toHaveTextContent(""));
    // 清除後主英雄仍鎖定勾選，不會被移出可使用範圍
    const mainBox = screen.getByRole("checkbox", { name: /甲英雄/ });
    expect(mainBox).toHaveAttribute("aria-disabled", "true");
    expect(mainBox).toHaveAttribute("aria-checked", "true");
  });
});
