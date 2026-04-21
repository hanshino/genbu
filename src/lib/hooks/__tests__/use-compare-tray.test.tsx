import { describe, it, expect, beforeEach } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useCompareTray, COMPARE_TRAY_MAX } from "../use-compare-tray";

beforeEach(() => window.localStorage.clear());

describe("useCompareTray", () => {
  it("starts empty", () => {
    const { result } = renderHook(() => useCompareTray());
    expect(result.current.ids).toEqual([]);
    expect(result.current.isFull).toBe(false);
  });

  it("adds, deduplicates, and removes", () => {
    const { result } = renderHook(() => useCompareTray());
    act(() => result.current.add(1));
    act(() => result.current.add(2));
    act(() => result.current.add(1)); // duplicate ignored
    expect(result.current.ids).toEqual([1, 2]);

    act(() => result.current.remove(1));
    expect(result.current.ids).toEqual([2]);
  });

  it("caps at MAX items", () => {
    const { result } = renderHook(() => useCompareTray());
    act(() => {
      for (let i = 0; i < COMPARE_TRAY_MAX + 3; i++) result.current.add(100 + i);
    });
    expect(result.current.ids).toHaveLength(COMPARE_TRAY_MAX);
    expect(result.current.isFull).toBe(true);
  });

  it("persists to localStorage", () => {
    const { result, unmount } = renderHook(() => useCompareTray());
    act(() => result.current.add(42));
    unmount();
    const { result: second } = renderHook(() => useCompareTray());
    // Wait one tick for useEffect to read storage.
    expect(second.current.ids).toEqual([42]);
  });
});
