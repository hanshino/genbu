"use client";

import { useCallback, useEffect, useState } from "react";
import type { Weights } from "@/lib/scoring";

const STORAGE_KEY = "genbu.ranking.customPresets";

export interface CustomPreset {
  id: string;             // generated: `${Date.now()}-${crypto.random}` or name-based
  name: string;
  type: string;           // 座騎 | 背飾 | ...
  weights: Weights;
}

function read(): CustomPreset[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (p): p is CustomPreset =>
        typeof p === "object" && p !== null &&
        typeof (p as CustomPreset).id === "string" &&
        typeof (p as CustomPreset).name === "string" &&
        typeof (p as CustomPreset).type === "string" &&
        typeof (p as CustomPreset).weights === "object"
    );
  } catch {
    return [];
  }
}

function write(list: CustomPreset[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch {
    /* noop */
  }
}

export function useCustomPresets() {
  const [presets, setPresets] = useState<CustomPreset[]>([]);

  useEffect(() => setPresets(read()), []);

  const save = useCallback((preset: Omit<CustomPreset, "id">) => {
    setPresets((prev) => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const next = [...prev, { ...preset, id }];
      write(next);
      return next;
    });
  }, []);

  const remove = useCallback((id: string) => {
    setPresets((prev) => {
      const next = prev.filter((p) => p.id !== id);
      write(next);
      return next;
    });
  }, []);

  return { presets, save, remove };
}
