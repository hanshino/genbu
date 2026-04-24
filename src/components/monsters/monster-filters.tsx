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
import { Checkbox } from "@/components/ui/checkbox";
import { monsterTypeLabel } from "@/lib/constants/monster-type";
import { FILTER_ALL } from "@/lib/constants/filters";

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
  const [type, setType] = useState(initialType || FILTER_ALL);
  const [elemental, setElemental] = useState(initialElemental || FILTER_ALL);
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
    if (next.type && next.type !== FILTER_ALL) params.set("type", next.type);
    else params.delete("type");
    if (next.elemental && next.elemental !== FILTER_ALL) params.set("elemental", next.elemental);
    else params.delete("elemental");
    if (next.hasDrop) params.set("hasDrop", "1");
    else params.delete("hasDrop");
    if (next.isNormal) params.set("isNormal", "1");
    else params.delete("isNormal");
    params.delete("page");
    const nextQs = params.toString();
    const currentQs = new URLSearchParams(searchParams.toString());
    currentQs.delete("page");
    if (currentQs.toString() === nextQs) return;
    startTransition(() => {
      router.push(`/monsters${nextQs ? `?${nextQs}` : ""}`);
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-3 sm:flex-row">
        <Input
          placeholder="搜尋怪物名稱或編號..."
          aria-label="搜尋怪物名稱或編號"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          inputMode="search"
          className="sm:max-w-xs"
        />
        <Select
          value={type}
          onValueChange={(v) => {
            const nextType = v ?? FILTER_ALL;
            setType(nextType);
            pushState({ search, type: nextType, elemental, hasDrop, isNormal });
          }}
        >
          <SelectTrigger className="sm:w-[160px]">
            <SelectValue>
              {(v: unknown) =>
                v == null || v === FILTER_ALL ? "全部類型" : monsterTypeLabel(Number(v))
              }
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={FILTER_ALL}>全部類型</SelectItem>
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
            const nextElemental = v ?? FILTER_ALL;
            setElemental(nextElemental);
            pushState({ search, type, elemental: nextElemental, hasDrop, isNormal });
          }}
        >
          <SelectTrigger className="sm:w-[140px]">
            <SelectValue>
              {(v: unknown) => (v == null || v === FILTER_ALL ? "全部屬性" : String(v))}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={FILTER_ALL}>全部屬性</SelectItem>
            {availableElementals.map((e) => (
              <SelectItem key={e} value={e}>
                {e}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
        <label className="inline-flex min-h-11 cursor-pointer select-none items-center gap-2 py-1">
          <Checkbox
            checked={hasDrop}
            onCheckedChange={(checked) => {
              const nextHasDrop = checked === true;
              setHasDrop(nextHasDrop);
              pushState({ search, type, elemental, hasDrop: nextHasDrop, isNormal });
            }}
          />
          <span>僅顯示有掉落</span>
        </label>
        <label className="inline-flex min-h-11 cursor-pointer select-none items-center gap-2 py-1">
          <Checkbox
            checked={isNormal}
            onCheckedChange={(checked) => {
              const nextIsNormal = checked === true;
              setIsNormal(nextIsNormal);
              pushState({ search, type, elemental, hasDrop, isNormal: nextIsNormal });
            }}
          />
          <span>僅顯示一般怪 (▲ / ●)</span>
        </label>
      </div>
    </div>
  );
}
