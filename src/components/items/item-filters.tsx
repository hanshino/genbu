"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { itemTypeGroups } from "@/lib/constants/item-types";
import { track } from "@/lib/analytics/track";

const ALL_TYPES = "__all__";

export function ItemFilters({
  initialSearch,
  initialType,
}: {
  initialSearch: string;
  initialType: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [search, setSearch] = useState(initialSearch);
  const [type, setType] = useState(initialType || ALL_TYPES);
  const [, startTransition] = useTransition();

  // Debounce search updates to URL
  useEffect(() => {
    const handle = setTimeout(() => {
      pushState({ search, type });
    }, 300);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  function pushState(next: { search: string; type: string }) {
    const params = new URLSearchParams(searchParams.toString());
    if (next.search.trim()) params.set("search", next.search.trim());
    else params.delete("search");
    if (next.type && next.type !== ALL_TYPES) params.set("type", next.type);
    else params.delete("type");
    params.delete("page");
    startTransition(() => {
      router.push(`/items${params.size > 0 ? `?${params.toString()}` : ""}`);
    });
    const query = next.search.trim();
    const hasFilter = !!next.type && next.type !== ALL_TYPES;
    if (query.length > 0 || hasFilter) {
      track("search_submit", {
        scope: "items",
        query_len: query.length,
        has_filter: hasFilter,
      });
    }
  }

  return (
    <div className="flex flex-col gap-3 sm:flex-row">
      <Input
        placeholder="搜尋道具名稱或編號..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        inputMode="search"
        className="sm:max-w-xs"
      />
      <Select
        value={type}
        onValueChange={(v) => {
          const nextType = v ?? ALL_TYPES;
          setType(nextType);
          pushState({ search, type: nextType });
        }}
      >
        <SelectTrigger className="sm:w-[220px]">
          <SelectValue>
            {(v: unknown) => (v == null || v === ALL_TYPES ? "全部類別" : String(v))}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL_TYPES}>全部類別</SelectItem>
          {itemTypeGroups.map((group) => (
            <SelectGroup key={group.id}>
              <SelectLabel>{group.label}</SelectLabel>
              {group.types.map((t) => (
                <SelectItem key={t} value={t}>
                  {t}
                </SelectItem>
              ))}
            </SelectGroup>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
