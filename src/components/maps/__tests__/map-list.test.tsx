import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MapList } from "../map-list";
import type { StageGroupStats, StageListItem } from "@/lib/types/stage";

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(window.location.search),
}));
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest} onClick={(e) => e.preventDefault()}>
      {children}
    </a>
  ),
}));

const stages: StageListItem[] = [
  { id: 1, kind: "stage", name: "洛陽", groupId: 1, flags: [], inboundCount: 0 },
  { id: 12, kind: "stage", name: "長安", groupId: 1, flags: [], inboundCount: 0 },
];
const groups: StageGroupStats[] = [{ groupId: 1, count: 2, preview: "洛陽、長安" }];

const realReplace = window.history.replaceState.bind(window.history);
let replaceSpy: ReturnType<typeof vi.spyOn>;

const searchBox = () => screen.getByPlaceholderText("搜尋地圖名稱或 ID…");
const shown = () =>
  screen
    .queryAllByRole("link", { name: /^#\d+/ })
    .map((a) => a.getAttribute("href"))
    .filter((h) => !h?.startsWith("#"));

beforeEach(() => {
  vi.useFakeTimers();
  realReplace(null, "", "/maps");
  replaceSpy = vi.spyOn(window.history, "replaceState");
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("MapList 搜尋 ↔ URL", () => {
  it("由 URL 還原搜尋，掛載不回寫", () => {
    realReplace(null, "", "/maps?q=長安");
    render(<MapList stages={stages} groups={groups} />);
    expect(searchBox()).toHaveValue("長安");
    expect(shown()).toEqual(["/maps/12"]);
    act(() => vi.advanceTimersByTime(1000));
    expect(replaceSpy).not.toHaveBeenCalled();
  });

  it("每次輸入立即 replace（不 push、不等計時器），清空時移除 q 並保留其他 query/hash", () => {
    realReplace(null, "", "/maps?ref=a#g-1");
    const push = vi.spyOn(window.history, "pushState");
    render(<MapList stages={stages} groups={groups} />);
    fireEvent.change(searchBox(), { target: { value: "1" } });
    expect(shown()).toEqual(["/maps/1"]);
    // 立即寫入：reload 的目標 URL 在導航開始時就決定，任何延遲寫入都會被 reload 吃掉
    expect(window.location.pathname + window.location.search + window.location.hash).toBe(
      "/maps?ref=a&q=1#g-1",
    );
    fireEvent.change(searchBox(), { target: { value: " " } });
    expect(replaceSpy.mock.calls.at(-1)?.[2]).toBe("/maps?ref=a#g-1");
    expect(push).not.toHaveBeenCalled();
  });

  it("外部 URL 變動同步輸入框與結果", () => {
    const { rerender } = render(<MapList stages={stages} groups={groups} />);
    realReplace(null, "", "/maps?q=洛");
    rerender(<MapList stages={stages} groups={groups} />);
    expect(searchBox()).toHaveValue("洛");
    expect(shown()).toEqual(["/maps/1"]);
  });

  it("點詳情前已寫入搜尋字", () => {
    render(<MapList stages={stages} groups={groups} />);
    fireEvent.change(searchBox(), { target: { value: "長" } });
    fireEvent.click(screen.getByRole("link", { name: /^#12/ }));
    expect(replaceSpy.mock.calls.at(-1)?.[2]).toBe(`/maps?q=${encodeURIComponent("長")}`);
  });

  it("#錨點 entry 輸入後立刻 Back：不覆寫上一個 entry，forward 還原", async () => {
    vi.useRealTimers();
    const popstate = () =>
      new Promise<void>((r) => window.addEventListener("popstate", () => r(), { once: true }));
    realReplace(null, "", "/maps?ref=a");
    window.history.pushState(null, "", "/maps?ref=a#g-1"); // 點分組 chip 產生的 entry
    render(<MapList stages={stages} groups={groups} />);
    fireEvent.change(searchBox(), { target: { value: "洛" } });

    const back = popstate();
    window.history.back();
    await act(() => back);
    await act(() => new Promise((r) => setTimeout(r, 400))); // 舊版 debounce 會在此時覆寫
    expect(window.location.search + window.location.hash).toBe("?ref=a");
    expect(searchBox()).toHaveValue("");
    expect(shown()).toHaveLength(2);

    const fwd = popstate();
    window.history.forward();
    await act(() => fwd);
    expect(window.location.search + window.location.hash).toBe(
      `?ref=a&q=${encodeURIComponent("洛")}#g-1`,
    );
    expect(searchBox()).toHaveValue("洛");
    expect(shown()).toEqual(["/maps/1"]);
  });
});
