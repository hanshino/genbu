import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, renderHook } from "@testing-library/react";
import { createElement, StrictMode } from "react";
import { renderToString } from "react-dom/server";
import { createDefaultCharacter } from "@/lib/stat-character";
import type { CharacterStore } from "@/lib/types/stat-sim";
import { useCharacters } from "../use-characters";

const KEY = "genbu.characters";
beforeEach(() => window.localStorage.clear());
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("useCharacters", () => {
  it("validates imported characters, appends and activates in a single update", () => {
    const { result } = renderHook(() => useCharacters());
    const original = result.current.active!;
    const imported = createDefaultCharacter("匯入角色");
    expect(() => result.current.addImported({ ...imported, sectId: 1 } as never)).toThrow("匯入角色資料不合法");
    expect(result.current.store.characters).toEqual([original]);
    act(() => { result.current.addImported(imported); });
    expect(result.current.store.characters).toEqual([original, imported]);
    expect(result.current.active?.id).toBe(imported.id);
    expect(JSON.parse(localStorage.getItem(KEY)!)).toEqual(result.current.store);
  });

  it("import does not overwrite a corrupted store", () => {
    localStorage.setItem(KEY, "broken");
    const { result } = renderHook(() => useCharacters());
    const imported = createDefaultCharacter("僅記憶體匯入");
    act(() => { result.current.addImported(imported); });
    expect(result.current.active?.id).toBe(imported.id);
    expect(result.current.store.characters).toHaveLength(2);
    expect(localStorage.getItem(KEY)).toBe("broken");
  });

  it("creates and persists one default character on the first visit", () => {
    const { result } = renderHook(() => useCharacters());
    expect(result.current.loaded).toBe(true);
    expect(result.current.error).toBeNull();
    expect(result.current.saveFailed).toBe(false);
    expect(result.current.store.characters).toHaveLength(1);
    expect(result.current.active?.level).toBe(1);
    expect(JSON.parse(window.localStorage.getItem(KEY)!)).toEqual(result.current.store);
  });

  it("does not access storage during SSR or write before the existing store is loaded", () => {
    const character = createDefaultCharacter("已存角色");
    character.attributes.str = 12;
    const saved: CharacterStore = {
      version: 1,
      activeCharacterId: character.id,
      characters: [character],
    };
    window.localStorage.setItem(KEY, JSON.stringify(saved));
    const read = vi.spyOn(Storage.prototype, "getItem");
    const write = vi.spyOn(Storage.prototype, "setItem");
    function ServerProbe() {
      const state = useCharacters();
      expect(state.loaded).toBe(false);
      expect(state.active).toBeNull();
      return null;
    }
    renderToString(createElement(ServerProbe));
    expect(read).not.toHaveBeenCalled();
    expect(write).not.toHaveBeenCalled();
    const renders: boolean[] = [];
    const { result } = renderHook(
      () => {
        const state = useCharacters();
        renders.push(state.loaded);
        if (!state.loaded) expect(write).not.toHaveBeenCalled();
        return state;
      },
      { wrapper: ({ children }) => createElement(StrictMode, null, children) },
    );
    expect(renders[0]).toBe(false);
    expect(result.current.store).toEqual(saved);
    expect(read.mock.invocationCallOrder[0]).toBeLessThan(write.mock.invocationCallOrder[0]);
    for (const [, value] of write.mock.calls) expect(JSON.parse(value)).toEqual(saved);
  });

  it("keeps edits isolated across characters, switches, and reloads", () => {
    const { result, unmount } = renderHook(() => useCharacters());
    const firstId = result.current.active!.id;
    act(() =>
      result.current.update(firstId, (c) => {
        c.attributes.str = 30;
        c.equipment.right = { itemId: 123, enhancementLevel: 5, manualBonuses: { atk: 20 } };
        c.passiveLevels[13] = 10;
        c.manual.hero.hp = 100;
        return c;
      }),
    );
    act(() => {
      result.current.create("第二隻");
    });
    const secondId = result.current.active!.id;
    expect(result.current.active!.attributes.str).toBe(1);
    expect(result.current.active!.equipment.right).toBeNull();
    act(() =>
      result.current.update(secondId, (c) => {
        c.attributes.pow = 25;
        c.passiveLevels[1151] = 3;
        return c;
      }),
    );
    act(() => result.current.select(firstId));
    expect(result.current.active!.attributes).toMatchObject({ str: 30, pow: 1 });
    expect(result.current.active!.passiveLevels).toEqual({ 13: 10 });
    act(() => result.current.select(secondId));
    expect(result.current.active!.attributes).toMatchObject({ str: 1, pow: 25 });
    expect(result.current.active!.passiveLevels).toEqual({ 1151: 3 });
    const expected = result.current.store;
    unmount();
    const { result: reloaded } = renderHook(() => useCharacters());
    expect(reloaded.current.store).toEqual(expected);
    expect(reloaded.current.active!.id).toBe(secondId);
    act(() => reloaded.current.select(firstId));
    expect(reloaded.current.active!.equipment.right?.manualBonuses).toEqual({ atk: 20 });
    expect(reloaded.current.active!.manual.hero).toEqual({ hp: 100 });
  });

  it("duplicates deeply, renames, and keeps selection valid after removals", () => {
    const { result } = renderHook(() => useCharacters());
    const originalId = result.current.active!.id;
    act(() => result.current.rename(originalId, "本尊"));
    act(() => result.current.duplicate(originalId));
    const copyId = result.current.active!.id;
    expect(copyId).not.toBe(originalId);
    expect(result.current.active!.name).toBe("本尊（副本）");
    act(() =>
      result.current.update(copyId, (c) => {
        c.attributes.str = 10;
        return c;
      }),
    );
    act(() => result.current.select(originalId));
    expect(result.current.active!.attributes.str).toBe(1);
    act(() => result.current.remove(copyId));
    expect(result.current.active!.id).toBe(originalId);
    act(() => {
      result.current.create("新角色");
    });
    const newId = result.current.active!.id;
    act(() => result.current.remove(newId));
    expect(result.current.active!.id).toBe(originalId);
    act(() => result.current.remove(originalId));
    expect(result.current.active).toBeNull();
    expect(result.current.store).toEqual({ version: 1, activeCharacterId: null, characters: [] });
  });

  it("ignores missing ids for duplicate, rename, remove, select and update", () => {
    const { result } = renderHook(() => useCharacters());
    const expected = result.current.store;
    const updater = vi.fn();
    act(() => {
      result.current.duplicate("missing");
      result.current.rename("missing", "不存在");
      result.current.remove("missing");
      result.current.select("missing");
      result.current.update("missing", updater);
    });
    expect(result.current.store).toEqual(expected);
    expect(updater).not.toHaveBeenCalled();
  });

  it.each([
    ["corrupt", "{invalid json"],
    ["corrupt", JSON.stringify({ version: 1, characters: [], activeCharacterId: "missing" })],
    ["unknown-version", JSON.stringify({ version: 2, futureData: "不要覆蓋" })],
  ] as const)("preserves %s storage until explicitly reset", (error, raw) => {
    window.localStorage.setItem(KEY, raw);
    const write = vi.spyOn(Storage.prototype, "setItem");
    const { result } = renderHook(() => useCharacters());
    expect(result.current.error).toBe(error);
    expect(result.current.loaded).toBe(true);
    expect(result.current.store.characters).toHaveLength(1);
    act(() => result.current.rename(result.current.active!.id, "僅記憶體"));
    act(() => {
      result.current.create("另一隻");
    });
    expect(result.current.store.characters).toHaveLength(2);
    expect(write).not.toHaveBeenCalled();
    expect(window.localStorage.getItem(KEY)).toBe(raw);
    act(() => result.current.resetCorrupt());
    expect(result.current.error).toBeNull();
    expect(result.current.store.characters).toHaveLength(1);
    expect(result.current.active!.name).toBe("新角色");
    expect(JSON.parse(window.localStorage.getItem(KEY)!)).toEqual(result.current.store);
  });

  it("reports a blocked storage read without overwriting inaccessible data", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("private mode");
    });
    const write = vi.spyOn(Storage.prototype, "setItem");
    const { result } = renderHook(() => useCharacters());
    expect(result.current.error).toBe("storage-failed");
    expect(result.current.store.characters).toHaveLength(1);
    expect(write).not.toHaveBeenCalled();
  });

  it.each([{ randomRolls: [{ attribute: "命中", value: "85" }] },
    { sockets: [{ recipeId: 10742, stat: "未知", value: 10 }] }])(
    "損壞的隨機／插槽資料不會被預設角色或後續編輯覆寫 %#", (bad) => {
      const character = createDefaultCharacter();
      const raw = JSON.stringify({ version: 1, activeCharacterId: character.id, characters: [{
        ...character, equipment: { ...character.equipment,
          cap: { itemId: 55216, enhancementLevel: 0, manualBonuses: {}, ...bad },
        },
      }] });
      window.localStorage.setItem(KEY, raw);
      const write = vi.spyOn(Storage.prototype, "setItem");
      const { result } = renderHook(() => useCharacters());
      expect(result.current.error).toBe("corrupt");
      act(() => result.current.rename(result.current.active!.id, "僅記憶體"));
      expect(write).not.toHaveBeenCalled();
      expect(window.localStorage.getItem(KEY)).toBe(raw);
    },
  );

  it("reports failed writes, retains edits in memory, and retries after another edit", () => {
    const write = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("quota exceeded", "QuotaExceededError");
    });
    const { result } = renderHook(() => useCharacters());
    expect(result.current.saveFailed).toBe(true);
    expect(result.current.error).toBeNull();
    const id = result.current.active!.id;
    act(() => result.current.rename(id, "保存失敗也保留"));
    expect(result.current.active!.name).toBe("保存失敗也保留");
    expect(result.current.saveFailed).toBe(true);
    write.mockRestore();
    act(() => result.current.rename(id, "再次保存"));
    expect(result.current.saveFailed).toBe(false);
    expect(JSON.parse(window.localStorage.getItem(KEY)!)).toEqual(result.current.store);
  });

  it("preserves a deliberately empty store across reloads", () => {
    const saved: CharacterStore = { version: 1, activeCharacterId: null, characters: [] };
    window.localStorage.setItem(KEY, JSON.stringify(saved));
    const { result } = renderHook(() => useCharacters());
    expect(result.current.store).toEqual(saved);
    expect(result.current.active).toBeNull();
  });
});
