"use client";

import { useCallback, useEffect, useState } from "react";
import {
  createDefaultCharacter,
  duplicateCharacter,
  parseCharacter,
  parseCharacterStore,
} from "@/lib/stat-character";
import type { CharacterStore, CharacterV1 } from "@/lib/types/stat-sim";

const STORAGE_KEY = "genbu.characters";
type StorageError = null | "corrupt" | "unknown-version" | "storage-failed";

function defaultStore(): CharacterStore {
  const character = createDefaultCharacter();
  return { version: 1, activeCharacterId: character.id, characters: [character] };
}

export function useCharacters() {
  // 空清單是 SSR／首次 client render 的一致快照；載入後才產生角色 id。
  const [store, setStore] = useState<CharacterStore>({
    version: 1,
    activeCharacterId: null,
    characters: [],
  });
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<StorageError>(null);
  const [saveFailed, setSaveFailed] = useState(false);

  useEffect(() => {
    let next = defaultStore();
    let loadError: StorageError = null;
    let raw: string | null;
    try {
      raw = window.localStorage.getItem(STORAGE_KEY);
    } catch {
      loadError = "storage-failed";
      raw = null;
    }
    if (raw !== null) {
      try {
        const parsed = parseCharacterStore(JSON.parse(raw));
        if (parsed.ok) next = parsed.store;
        else loadError = parsed.reason;
      } catch {
        loadError = "corrupt";
      }
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional SSR-safe hydration from localStorage
    setStore(next);
    setError(loadError);
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded || error !== null) return; // 保留無法載入的原始存檔，直到使用者明確重設。
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
      // eslint-disable-next-line react-hooks/set-state-in-effect -- report persistence success/failure without discarding in-memory edits
      setSaveFailed(false);
    } catch {
      setSaveFailed(true);
    }
  }, [loaded, store, error]);

  const create = useCallback(
    (name?: string) => {
      if (!loaded) return;
      const character = createDefaultCharacter(name);
      setStore((previous) => ({
        ...previous,
        activeCharacterId: character.id,
        characters: [...previous.characters, character],
      }));
      return character.id;
    },
    [loaded],
  );

  const duplicate = useCallback(
    (id: string) => {
      if (!loaded) return;
      setStore((previous) => {
        const original = previous.characters.find((character) => character.id === id);
        if (!original) return previous;
        const character = duplicateCharacter(original);
        return {
          ...previous,
          activeCharacterId: character.id,
          characters: [...previous.characters, character],
        };
      });
    },
    [loaded],
  );

  const addImported = useCallback(
    (character: CharacterV1) => {
      if (!loaded) return;
      const parsed = parseCharacter(character);
      if (!parsed.ok) throw new Error("匯入角色資料不合法");
      setStore((previous) => {
        if (previous.characters.some((existing) => existing.id === parsed.character.id)) {
          throw new Error("匯入角色 id 重複");
        }
        return {
          ...previous,
          activeCharacterId: parsed.character.id,
          characters: [...previous.characters, parsed.character],
        };
      });
      return parsed.character.id;
    },
    [loaded],
  );

  const update = useCallback(
    (id: string, updater: (character: CharacterV1) => CharacterV1) => {
      if (!loaded) return;
      setStore((previous) => ({
        ...previous,
        characters: previous.characters.map((character) => {
          if (character.id !== id) return character;
          const next = updater(JSON.parse(JSON.stringify(character)) as CharacterV1);
          const parsed = parseCharacter(next);
          if (!parsed.ok || next.id !== id) throw new Error("角色更新資料不合法");
          return parsed.character;
        }),
      }));
    },
    [loaded],
  );

  const rename = useCallback(
    (id: string, name: string) => {
      update(id, (character) => ({ ...character, name }));
    },
    [update],
  );

  const remove = useCallback(
    (id: string) => {
      if (!loaded) return;
      setStore((previous) => {
        const characters = previous.characters.filter((character) => character.id !== id);
        return {
          ...previous,
          characters,
          activeCharacterId:
            previous.activeCharacterId === id
              ? (characters[0]?.id ?? null)
              : previous.activeCharacterId,
        };
      });
    },
    [loaded],
  );

  const select = useCallback(
    (id: string) => {
      if (!loaded) return;
      setStore((previous) =>
        previous.characters.some((character) => character.id === id)
          ? { ...previous, activeCharacterId: id }
          : previous,
      );
    },
    [loaded],
  );

  const resetCorrupt = useCallback(() => {
    if (!loaded || error === null) return;
    setStore(defaultStore());
    setError(null);
  }, [loaded, error]);

  return {
    loaded,
    store,
    active: store.characters.find((character) => character.id === store.activeCharacterId) ?? null,
    error,
    saveFailed,
    create,
    addImported,
    duplicate,
    rename,
    remove,
    select,
    update,
    resetCorrupt,
  };
}
