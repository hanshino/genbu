"use client";

import { useCallback, useSyncExternalStore } from "react";
import { readTwdRate, writeTwdRate } from "@/lib/market-price";

/**
 * 台幣匯率（1 台幣 = N 銀兩）只存在玩家自己的瀏覽器。
 *
 * 用 useSyncExternalStore 而不是 useEffect 補讀：SSR 快照固定是 null，
 * 掛載後 React 自己會用 client 快照重繪，不會有 hydration 落差。
 */
type Listener = () => void;
const listeners = new Set<Listener>();
let snapshot: number | null = null;

function subscribe(listener: Listener): () => void {
  if (listeners.size === 0) snapshot = readTwdRate();
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): number | null {
  return snapshot;
}

function getServerSnapshot(): number | null {
  return null;
}

export function useTwdRate(): [number | null, (silverPerTwd: number) => void] {
  const rate = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const setRate = useCallback((silverPerTwd: number) => {
    snapshot = silverPerTwd;
    writeTwdRate(silverPerTwd);
    for (const listener of listeners) listener();
  }, []);

  return [rate, setRate];
}
