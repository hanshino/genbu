"use client";

import { useCallback, useSyncExternalStore } from "react";
import { COMPARE_TRAY_MAX } from "@/lib/constants/compare";

const STORAGE_KEY = "genbu.compareTray";
const MAX_ITEMS = COMPARE_TRAY_MAX;

type Listener = () => void;
const listeners = new Set<Listener>();
let snapshot: number[] = [];
const SERVER_SNAPSHOT: number[] = [];

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

function setIds(next: number[]) {
  snapshot = next;
  writeStorage(next);
  for (const l of listeners) l();
}

function subscribe(listener: Listener): () => void {
  // When the first consumer subscribes, resync from localStorage so stale
  // in-memory state (e.g. between tests, or after all consumers unmount) is
  // replaced by the persisted source of truth.
  if (listeners.size === 0) snapshot = readStorage();
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): number[] {
  return snapshot;
}

function getServerSnapshot(): number[] {
  return SERVER_SNAPSHOT;
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
  const ids = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const add = useCallback((id: number) => {
    if (snapshot.includes(id) || snapshot.length >= MAX_ITEMS) return;
    setIds([...snapshot, id]);
  }, []);

  const remove = useCallback((id: number) => {
    if (!snapshot.includes(id)) return;
    setIds(snapshot.filter((x) => x !== id));
  }, []);

  const clear = useCallback(() => setIds([]), []);
  const has = useCallback((id: number) => ids.includes(id), [ids]);

  return { ids, isFull: ids.length >= MAX_ITEMS, has, add, remove, clear };
}

