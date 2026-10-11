import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GlobalSearch } from "../global-search";
import type { SearchResult } from "@/lib/search-types";

const RESULT: SearchResult = {
  query: "大還",
  total: 23,
  groups: [
    {
      type: "item",
      label: "道具",
      total: 12,
      hits: [
        { type: "item", id: "1", name: "大還丹", href: "/items/1", meta: "恢復類" },
        { type: "item", id: "2", name: "大還丹(綁)", href: "/items/2", meta: "恢復類" },
      ],
    },
    {
      type: "mission",
      label: "任務",
      total: 1,
      hits: [{ type: "mission", id: "9", name: "大還丹的秘密", href: "/missions/9" }],
    },
  ],
};

const fetchMock = vi.fn();

async function typeInto(input: HTMLElement, value: string) {
  // 要用 user-event：Autocomplete 只在有 inputType 的輸入事件才展開，fireEvent.change 不帶。
  const user = userEvent.setup({ delay: null });
  await user.type(input, value);
}

describe("GlobalSearch", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    fetchMock.mockResolvedValue({ ok: true, json: async () => RESULT });
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("無 JS 也能送出：form action 與 input name", () => {
    render(<GlobalSearch />);
    const input = screen.getByRole("combobox");
    expect(input).toHaveAttribute("name", "q");
    expect(input.closest("form")).toHaveAttribute("action", "/search");
  });

  it("debounce 後才查詢，並依類型分組顯示結果與全部結果連結", async () => {
    render(<GlobalSearch />);
    const input = screen.getByRole("combobox");

    await typeInto(input, "大還");
    expect(fetchMock).not.toHaveBeenCalled();

    await screen.findByText("道具");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe("/api/search?q=%E5%A4%A7%E9%82%84&limit=3");
    expect(await screen.findByText("道具")).toBeInTheDocument();
    expect(screen.getByText("任務")).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /大還丹的秘密/ })).toHaveAttribute(
      "href",
      "/missions/9",
    );
    expect(screen.getByRole("option", { name: /全部 23 筆結果/ })).toHaveAttribute(
      "href",
      "/search?q=%E5%A4%A7%E9%82%84",
    );
  });

  it("組字期間不查詢", async () => {
    render(<GlobalSearch />);
    const input = screen.getByRole("combobox");

    fireEvent.compositionStart(input);
    fireEvent.change(input, { target: { value: "ㄉ" } });
    await new Promise((r) => setTimeout(r, 300));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("帶 defaultValue 進來時不自動查詢", async () => {
    render(<GlobalSearch defaultValue="大還" />);
    await new Promise((r) => setTimeout(r, 400));
    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.getByRole("combobox")).toHaveValue("大還");
  });

  it("沒有結果時顯示提示且沒有選項", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ query: "zzz", total: 0, groups: [] }),
    });
    render(<GlobalSearch />);
    await typeInto(screen.getByRole("combobox"), "zzz");
    expect(await screen.findByText("找不到「zzz」相關結果")).toBeInTheDocument();
    expect(screen.queryAllByRole("option")).toHaveLength(0);
  });

  it("方向鍵可在建議間移動，包含最後的查看全部列", async () => {
    render(<GlobalSearch />);
    const input = screen.getByRole("combobox");
    await typeInto(input, "大還");
    await screen.findByText("道具");

    const user = userEvent.setup({ delay: null });
    await user.keyboard("{ArrowDown}");
    expect(screen.getByRole("option", { name: /^大還丹\s*恢復類$/ })).toHaveAttribute(
      "data-highlighted",
    );

    await user.keyboard("{ArrowDown}{ArrowDown}{ArrowDown}");
    expect(screen.getByRole("option", { name: /全部 23 筆結果/ })).toHaveAttribute(
      "data-highlighted",
    );
  });
});
