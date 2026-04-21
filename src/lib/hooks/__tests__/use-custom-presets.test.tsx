import { describe, it, expect, beforeEach } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useCustomPresets } from "../use-custom-presets";

beforeEach(() => window.localStorage.clear());

describe("useCustomPresets", () => {
  it("saves and removes entries", () => {
    const { result } = renderHook(() => useCustomPresets());
    act(() =>
      result.current.save({
        name: "My 外功",
        type: "座騎",
        weights: { str: 11, atk: 1 },
      })
    );
    expect(result.current.presets).toHaveLength(1);
    const { id } = result.current.presets[0];
    act(() => result.current.remove(id));
    expect(result.current.presets).toEqual([]);
  });

  it("gracefully handles corrupted storage", () => {
    window.localStorage.setItem("genbu.ranking.customPresets", "not json");
    const { result } = renderHook(() => useCustomPresets());
    expect(result.current.presets).toEqual([]);
  });
});
