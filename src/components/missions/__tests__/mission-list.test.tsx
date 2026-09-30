import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MissionList } from "../mission-list";
import type { MissionGroupStats, MissionListItem } from "@/lib/types/mission";

// Next 的 useSearchParams 會跟著 history.replaceState 更新；測試裡直接讀 jsdom 的 location。
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

const missions: MissionListItem[] = [
  {
    id: 1,
    name: "少林入門",
    groupId: 1,
    cycleTime: null,
    stepCount: 2,
    minLevel: 10,
    factions: ["少林"],
    hasReward: true,
  },
  {
    id: 2,
    name: "武當入門",
    groupId: 1,
    cycleTime: null,
    stepCount: 2,
    minLevel: 30,
    factions: ["武當"],
  },
  { id: 3, name: "限時討伐", groupId: 2, cycleTime: null, stepCount: 1, timed: true },
];
const groups: MissionGroupStats[] = [
  { groupId: 1, count: 2, cycleCount: 0 },
  { groupId: 2, count: 1, cycleCount: 0 },
];

const realReplace = window.history.replaceState.bind(window.history);
let replaceSpy: ReturnType<typeof vi.spyOn>;
let pushSpy: ReturnType<typeof vi.spyOn>;

function setUrl(url: string) {
  realReplace(null, "", url);
}
function renderList() {
  return render(<MissionList missions={missions} groups={groups} />);
}
const searchBox = () => screen.getByPlaceholderText("搜尋任務名稱或 ID…");
const lastUrl = () => replaceSpy.mock.calls.at(-1)?.[2] as string | undefined;
const shown = () =>
  screen
    .queryAllByRole("link", { name: /^#\d+/ })
    .map((a) => a.getAttribute("href"))
    .filter((h) => !h?.startsWith("#"));

beforeEach(() => {
  vi.useFakeTimers();
  setUrl("/missions");
  replaceSpy = vi.spyOn(window.history, "replaceState");
  pushSpy = vi.spyOn(window.history, "pushState");
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("MissionList 篩選 ↔ URL", () => {
  it("由 URL 還原所有篩選，掛載時不回寫 URL", () => {
    setUrl("/missions?q=入門&faction=少林&min=5&max=20&reward=1");
    renderList();
    expect(searchBox()).toHaveValue("入門");
    expect(screen.getByLabelText("需求等級下限")).toHaveValue(5);
    expect(screen.getByLabelText("需求等級上限")).toHaveValue(20);
    expect(screen.getByRole("checkbox", { name: "有獎勵" })).toBeChecked();
    expect(shown()).toEqual(["/missions/1"]);
    act(() => vi.advanceTimersByTime(1000));
    expect(replaceSpy).not.toHaveBeenCalled();
  });

  it("文字 / 等級輸入立即 replace（不 push、不等計時器），保留無關 query 與 hash", () => {
    setUrl("/missions?utm=x#g-2");
    renderList();
    fireEvent.change(searchBox(), { target: { value: "限時" } });
    expect(shown()).toEqual(["/missions/3"]);
    expect(lastUrl()).toBe(`/missions?utm=x&q=${encodeURIComponent("限時")}#g-2`);
    fireEvent.change(screen.getByLabelText("需求等級上限"), { target: { value: "5" } });
    expect(lastUrl()).toBe(`/missions?utm=x&q=${encodeURIComponent("限時")}&max=5#g-2`);
    expect(pushSpy).not.toHaveBeenCalled();
  });

  it("勾選立即寫入；取消勾選 = 預設值，從 URL 移除", () => {
    renderList();
    const timed = screen.getByRole("checkbox", { name: "限時任務" });
    fireEvent.click(timed);
    expect(lastUrl()).toBe("/missions?timed=1");
    fireEvent.click(timed);
    expect(lastUrl()).toBe("/missions");
    expect(pushSpy).not.toHaveBeenCalled();
  });

  it("清除篩選保留搜尋字", () => {
    setUrl("/missions?q=入門&reward=1&min=5");
    renderList();
    fireEvent.click(screen.getByRole("button", { name: "清除篩選" }));
    expect(lastUrl()).toBe(`/missions?q=${encodeURIComponent("入門")}`);
    expect(searchBox()).toHaveValue("入門");
    expect(screen.getByLabelText("需求等級下限")).toHaveValue(null);
  });

  it("非法參數安全忽略", () => {
    setUrl("/missions?faction=不存在&min=abc&reward=yes&timed=0");
    renderList();
    expect(shown()).toHaveLength(3);
    expect(screen.queryByRole("button", { name: "清除篩選" })).toBeNull();
    expect(screen.getByRole("checkbox", { name: "有獎勵" })).not.toBeChecked();
  });

  it("外部 URL 變動（back/forward）同步 controls 與結果", () => {
    const { rerender } = renderList();
    expect(shown()).toHaveLength(3);
    setUrl("/missions?q=2");
    rerender(<MissionList missions={missions} groups={groups} />);
    expect(searchBox()).toHaveValue("2");
    expect(shown()).toEqual(["/missions/2"]); // 純數字 = 精確 ID
  });

  it("輸入後立刻點詳情：導頁前已寫入，之後不會把詳情頁 replace 回列表", () => {
    renderList();
    fireEvent.change(searchBox(), { target: { value: "入門" } });
    fireEvent.click(screen.getByRole("link", { name: /少林入門/ }));
    expect(lastUrl()).toBe(`/missions?q=${encodeURIComponent("入門")}`);
    const calls = replaceSpy.mock.calls.length;
    window.history.pushState(null, "", "/missions/1"); // 模擬 Link 導頁
    act(() => vi.advanceTimersByTime(1000));
    expect(replaceSpy.mock.calls.length).toBe(calls);
  });

  it("離開列表後不會有延遲寫入改到別頁", () => {
    renderList();
    fireEvent.change(searchBox(), { target: { value: "入門" } });
    setUrl("/missions/9");
    replaceSpy.mockClear();
    act(() => vi.advanceTimersByTime(1000));
    expect(replaceSpy).not.toHaveBeenCalled();
  });

  it("IME 組字中不寫 URL，組字結束後才以完整文字寫入", () => {
    renderList();
    const input = searchBox();
    fireEvent.compositionStart(input);
    fireEvent.change(input, { target: { value: "ㄖㄨˋ" } });
    act(() => vi.advanceTimersByTime(1000));
    expect(replaceSpy).not.toHaveBeenCalled();
    fireEvent.change(input, { target: { value: "入" } }); // Chrome：最後一次 input 仍在組字中
    fireEvent.compositionEnd(input);
    expect(lastUrl()).toBe(`/missions?q=${encodeURIComponent("入")}`);
    expect(input).toHaveValue("入");
  });

  it("組字中按 Back（popstate）：丟棄未寫入的組字，controls 跟著目的 URL", () => {
    setUrl("/missions?q=a");
    window.history.pushState(null, "", "/missions?q=a#g-1");
    renderList();
    const input = searchBox();
    fireEvent.compositionStart(input);
    fireEvent.change(input, { target: { value: "aㄖ" } });
    setUrl("/missions?q=a"); // 模擬 traverse 後的 URL（同 query、不同 hash）
    act(() => {
      window.dispatchEvent(new PopStateEvent("popstate"));
    });
    fireEvent.compositionEnd(input);
    expect(input).toHaveValue("a");
    expect(window.location.search + window.location.hash).toBe("?q=a");
  });
});
