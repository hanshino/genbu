import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SearchDialog, SearchTrigger, useSearchHotkey } from "../search-command";
import type { SearchResult } from "@/lib/search-types";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

const RESULT: SearchResult = {
  query: "血風",
  total: 3,
  groups: [
    {
      type: "item",
      label: "道具",
      total: 2,
      hits: [
        { type: "item", id: "11", name: "血風刃", href: "/items/11", meta: "刀 · #11" },
        { type: "item", id: "12", name: "血風刃", href: "/items/12", meta: "刀 · #12" },
      ],
    },
  ],
};

const fetchMock = vi.fn();

function Harness() {
  const [open, setOpen] = useState(false);
  useSearchHotkey(() => setOpen(true));
  return (
    <>
      <input aria-label="其他輸入框" />
      <SearchTrigger onOpen={() => setOpen(true)} />
      <SearchDialog open={open} onOpenChange={setOpen} />
    </>
  );
}

describe("SearchCommand", () => {
  beforeEach(() => {
    push.mockReset();
    fetchMock.mockReset();
    fetchMock.mockResolvedValue({ ok: true, json: async () => RESULT });
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("按 / 開啟面板並聚焦輸入框，打字後直接列出結果", async () => {
    const user = userEvent.setup({ delay: null });
    render(<Harness />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    await user.keyboard("/");
    const input = await screen.findByRole("combobox", { name: "搜尋全站" });
    await waitFor(() => expect(input).toHaveFocus());

    await user.type(input, "血風");
    const options = await screen.findAllByRole("option", { name: /血風刃/ });
    expect(options[0]).toHaveAttribute("href", "/items/11");
    expect(screen.getByText("刀 · #12")).toBeInTheDocument();
  });

  it("Ctrl+K 開啟；在其他輸入框裡打 / 不會開啟", async () => {
    const user = userEvent.setup({ delay: null });
    render(<Harness />);

    await user.click(screen.getByRole("textbox", { name: "其他輸入框" }));
    await user.keyboard("/");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    await user.keyboard("{Control>}k{/Control}");
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
  });

  it("點觸發鈕開啟，Enter 送出導到完整搜尋頁並關閉面板", async () => {
    const user = userEvent.setup({ delay: null });
    render(<Harness />);

    await user.click(screen.getByRole("button", { name: "搜尋" }));
    const input = await screen.findByRole("combobox", { name: "搜尋全站" });
    await user.type(input, "血風{Enter}");

    expect(push).toHaveBeenCalledWith("/search?q=%E8%A1%80%E9%A2%A8");
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });
});
