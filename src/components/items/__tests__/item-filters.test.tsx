import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ItemFilters } from "../item-filters";

const { routerPush } = vi.hoisted(() => ({ routerPush: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: routerPush }),
  useSearchParams: () => new URLSearchParams(),
}));

function renderFilters() {
  return render(<ItemFilters initialSearch="" initialType="" />);
}

function advanceDebounce() {
  act(() => {
    vi.advanceTimersByTime(301);
  });
}

describe("ItemFilters 的 IME 搜尋 debounce", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    routerPush.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("組字期間不 push，組字結束後以完整文字補送", () => {
    renderFilters();
    const input = screen.getByPlaceholderText("搜尋道具名稱或編號...");

    fireEvent.compositionStart(input);
    fireEvent.change(input, { target: { value: "ㄐ" } });
    advanceDebounce();
    expect(routerPush).not.toHaveBeenCalled();

    fireEvent.compositionEnd(input);
    fireEvent.change(input, { target: { value: "機" } });
    advanceDebounce();

    expect(routerPush).toHaveBeenCalledTimes(1);
    expect(routerPush).toHaveBeenCalledWith("/items?search=%E6%A9%9F");
  });

  it("一般非 IME 輸入仍會正常 push", () => {
    renderFilters();
    const input = screen.getByPlaceholderText("搜尋道具名稱或編號...");

    fireEvent.change(input, { target: { value: "sword" } });
    advanceDebounce();

    expect(routerPush).toHaveBeenCalledWith("/items?search=sword");
  });
});
