import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";

const nav = vi.hoisted(() => ({ push: vi.fn(), search: "" }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: nav.push }),
  usePathname: () => "/market",
  useSearchParams: () => new URLSearchParams(nav.search),
}));

import { MarketFilters } from "@/components/market/market-filters";

function ui(initialQuery: string) {
  return (
    <MarketFilters initialQuery={initialQuery} group="" groups={[]} placeholder="搜尋道具名稱" />
  );
}

beforeEach(() => {
  vi.useFakeTimers();
  nav.push.mockClear();
  nav.search = "";
});
afterEach(() => vi.useRealTimers());

describe("MarketFilters 搜尋框", () => {
  it("網址的 q 被外部改掉（瀏覽器上一頁）時，輸入框跟著變", () => {
    nav.search = "q=%E5%8A%8D";
    const { rerender } = render(ui("劍"));
    const input = screen.getByRole("searchbox");
    expect(input).toHaveValue("劍");

    nav.search = "";
    rerender(ui(""));
    expect(input).toHaveValue("");
    act(() => vi.advanceTimersByTime(500));
    expect(nav.push).not.toHaveBeenCalled();
  });

  it("自己打字推上網址後，網址落地不會把輸入框蓋回舊值", () => {
    const { rerender } = render(ui(""));
    const input = screen.getByRole("searchbox");

    fireEvent.change(input, { target: { value: "a" } });
    act(() => vi.advanceTimersByTime(300));
    expect(nav.push).toHaveBeenLastCalledWith("/market?q=a");

    // 網址 q=a 還沒落地時，使用者又打了一個字。
    fireEvent.change(input, { target: { value: "ab" } });
    nav.search = "q=a";
    rerender(ui("a"));
    expect(input).toHaveValue("ab");

    act(() => vi.advanceTimersByTime(300));
    expect(nav.push).toHaveBeenLastCalledWith("/market?q=ab");
    nav.search = "q=ab";
    rerender(ui("ab"));
    expect(input).toHaveValue("ab");
  });
});
