"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { monsterTypeLabel } from "@/lib/constants/monster-type";

const ALL = "__all__";

export function MonsterFilters({
  initialSearch,
  initialType,
  initialElemental,
  initialHasDrop,
  initialIsNormal,
  availableTypes,
  availableElementals,
}: {
  initialSearch: string;
  initialType: string;
  initialElemental: string;
  initialHasDrop: boolean;
  initialIsNormal: boolean;
  availableTypes: number[];
  availableElementals: string[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [search, setSearch] = useState(initialSearch);
  const [type, setType] = useState(initialType || ALL);
  const [elemental, setElemental] = useState(initialElemental || ALL);
  const [hasDrop, setHasDrop] = useState(initialHasDrop);
  const [isNormal, setIsNormal] = useState(initialIsNormal);
  const [, startTransition] = useTransition();

  useEffect(() => {
    const handle = setTimeout(() => {
      pushState({ search, type, elemental, hasDrop, isNormal });
    }, 300);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  function pushState(next: {
    search: string;
    type: string;
    elemental: string;
    hasDrop: boolean;
    isNormal: boolean;
  }) {
    const params = new URLSearchParams(searchParams.toString());
    if (next.search.trim()) params.set("search", next.search.trim());
    else params.delete("search");
    if (next.type && next.type !== ALL) params.set("type", next.type);
    else params.delete("type");
    if (next.elemental && next.elemental !== ALL) params.set("elemental", next.elemental);
    else params.delete("elemental");
    if (next.hasDrop) params.set("hasDrop", "1");
    else params.delete("hasDrop");
    if (next.isNormal) params.set("isNormal", "1");
    else params.delete("isNormal");
    params.delete("page");
    startTransition(() => {
      router.push(`/monsters${params.size > 0 ? `?${params.toString()}` : ""}`);
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-3 sm:flex-row">
        <Input
          placeholder="搜尋怪物名稱或編號..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          inputMode="search"
          className="sm:max-w-xs"
        />
        <Select
          value={type}
          onValueChange={(v) => {
            const nextType = v ?? ALL;
            setType(nextType);
            pushState({ search, type: nextType, elemental, hasDrop, isNormal });
          }}
        >
          <SelectTrigger className="sm:w-[160px]">
            <SelectValue placeholder="全部類型" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>全部類型</SelectItem>
            {availableTypes.map((t) => (
              <SelectItem key={t} value={String(t)}>
                {monsterTypeLabel(t)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={elemental}
          onValueChange={(v) => {
            const nextElemental = v ?? ALL;
            setElemental(nextElemental);
            pushState({ search, type, elemental: nextElemental, hasDrop, isNormal });
          }}
        >
          <SelectTrigger className="sm:w-[140px]">
            <SelectValue placeholder="全部屬性" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>全部屬性</SelectItem>
            {availableElementals.map((e) => (
              <SelectItem key={e} value={e}>
                {e}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-wrap items-center gap-4 text-sm">
        <label className="flex cursor-pointer select-none items-center gap-2">
          <input
            type="checkbox"
            checked={hasDrop}
            onChange={(e) => {
              const nextHasDrop = e.target.checked;
              setHasDrop(nextHasDrop);
              pushState({ search, type, elemental, hasDrop: nextHasDrop, isNormal });
            }}
            className="size-4 rounded border-border accent-primary"
          />
          <span>僅顯示有掉落</span>
        </label>
        <label className="flex cursor-pointer select-none items-center gap-2">
          <input
            type="checkbox"
            checked={isNormal}
            onChange={(e) => {
              const nextIsNormal = e.target.checked;
              setIsNormal(nextIsNormal);
              pushState({ search, type, elemental, hasDrop, isNormal: nextIsNormal });
            }}
            className="size-4 rounded border-border accent-primary"
          />
          <span>僅顯示一般怪 (▲ / ●)</span>
        </label>
      </div>
    </div>
  );
}
