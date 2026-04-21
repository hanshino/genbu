"use client";

import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "genbu.compareTray";
const MAX_ITEMS = 5;

function readStorage(): number[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((n): n is number => typeof n === "number");
  } catch {
    return [];
  }
}

function writeStorage(ids: number[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
  } catch {
    /* private mode or quota exceeded — fall back to memory-only */
  }
}

export interface CompareTray {
  ids: number[];
  isFull: boolean;
  has: (id: number) => boolean;
  add: (id: number) => void;
  remove: (id: number) => void;
  clear: () => void;
}

export function useCompareTray(): CompareTray {
  const [ids, setIds] = useState<number[]>([]);

  useEffect(() => {
    setIds(readStorage());
  }, []);

  const commit = useCallback((next: number[]) => {
    setIds(next);
    writeStorage(next);
  }, []);

  const add = useCallback(
    (id: number) => {
      setIds((prev) => {
        if (prev.includes(id) || prev.length >= MAX_ITEMS) return prev;
        const next = [...prev, id];
        writeStorage(next);
        return next;
      });
    },
    []
  );

  const remove = useCallback(
    (id: number) => {
      setIds((prev) => {
        const next = prev.filter((x) => x !== id);
        writeStorage(next);
        return next;
      });
    },
    []
  );

  const clear = useCallback(() => commit([]), [commit]);
  const has = useCallback((id: number) => ids.includes(id), [ids]);

  return { ids, isFull: ids.length >= MAX_ITEMS, has, add, remove, clear };
}

export { MAX_ITEMS as COMPARE_TRAY_MAX };
