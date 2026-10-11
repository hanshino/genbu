"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ArrowRightIcon, SearchIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Autocomplete,
  AutocompleteCollection,
  AutocompleteContent,
  AutocompleteEmpty,
  AutocompleteGroup,
  AutocompleteInput,
  AutocompleteItem,
  AutocompleteLabel,
  AutocompleteList,
  AutocompleteSeparator,
} from "@/components/ui/autocomplete";
import type { SearchResult } from "@/lib/search-types";
import { cn } from "@/lib/utils";

const DEBOUNCE_MS = 200;
const PER_TYPE = 3;

interface Row {
  key: string;
  name: string;
  href: string;
  meta?: string;
  snippet?: string;
  /** 「查看全部」那一列 */
  all?: boolean;
}

interface RowGroup {
  value: string;
  label: string | null;
  items: Row[];
}

function toRowGroups(result: SearchResult): RowGroup[] {
  if (result.total === 0) return [];
  const groups: RowGroup[] = result.groups.map((g) => ({
    value: g.type,
    label: g.label,
    items: g.hits.map((h) => ({
      key: `${h.type}:${h.id}`,
      name: h.name,
      href: h.href,
      meta: h.meta,
      snippet: h.snippet,
    })),
  }));
  groups.push({
    value: "__all",
    label: null,
    items: [
      {
        key: "__all",
        name: `查看「${result.query}」全部 ${result.total.toLocaleString()} 筆結果`,
        href: `/search?q=${encodeURIComponent(result.query)}`,
        all: true,
      },
    ],
  });
  return groups;
}

export function GlobalSearch({
  defaultValue = "",
  className,
}: {
  defaultValue?: string;
  className?: string;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [query, setQuery] = useState(defaultValue);
  // 注音等組字期間 Autocomplete 不會回報輸入值，組字結束才觸發，所以不用另外處理 IME。
  // 使用者真的打字之後才查詢；/search 頁帶著 defaultValue 進來時不重複打 API，也不自動展開。
  const [dirty, setDirty] = useState(false);
  const [open, setOpen] = useState(false);
  const [result, setResult] = useState<SearchResult | null>(null);

  const trimmed = query.trim();

  useEffect(() => {
    if (!dirty || !trimmed) return;
    const controller = new AbortController();
    const handle = setTimeout(() => {
      fetch(`/api/search?q=${encodeURIComponent(trimmed)}&limit=${PER_TYPE}`, {
        signal: controller.signal,
      })
        .then((res) => (res.ok ? (res.json() as Promise<SearchResult>) : null))
        .then((data) => {
          if (data) setResult(data);
        })
        .catch(() => {
          // 中斷或網路失敗都不打擾使用者，按 Enter 仍可到完整搜尋頁。
        });
    }, DEBOUNCE_MS);
    return () => {
      clearTimeout(handle);
      controller.abort();
    };
  }, [dirty, trimmed]);

  // 輸入清空就收起，不用等舊結果被清掉。
  const active = trimmed ? result : null;
  const rows = active ? toRowGroups(active) : [];

  return (
    <form
      ref={formRef}
      action="/search"
      role="search"
      className={cn("flex w-full max-w-md gap-2", className)}
    >
      <Autocomplete
        name="q"
        mode="none"
        items={rows}
        value={query}
        onValueChange={(v) => {
          setQuery(v);
          setDirty(true);
        }}
        open={open && active !== null}
        onOpenChange={setOpen}
        itemToStringValue={(row: Row) => row.name}
      >
        <AutocompleteInput
          type="text"
          inputMode="search"
          enterKeyHint="search"
          placeholder="搜尋道具、技能、怪物、頁面…"
          aria-label="搜尋全站"
          className="h-9 flex-1"
          showClear
        />
        <AutocompleteContent anchor={formRef}>
          <AutocompleteEmpty>找不到「{trimmed}」相關結果</AutocompleteEmpty>
          <AutocompleteList>
            {(group: RowGroup) => (
              <div key={group.value}>
                {group.label === null && <AutocompleteSeparator />}
                <AutocompleteGroup items={group.items}>
                  {group.label !== null && <AutocompleteLabel>{group.label}</AutocompleteLabel>}
                  <AutocompleteCollection>
                    {(row: Row) => (
                      <AutocompleteItem
                        key={row.key}
                        value={row}
                        render={<Link href={row.href} prefetch={false} />}
                        onClick={() => setOpen(false)}
                      >
                        {row.all ? (
                          <>
                            <span className="min-w-0 flex-1 truncate text-muted-foreground">
                              {row.name}
                            </span>
                            <ArrowRightIcon aria-hidden />
                          </>
                        ) : (
                          <>
                            <span className="min-w-0 flex-1 pl-2">
                              <span className="block truncate">{row.name}</span>
                              {row.snippet && (
                                <span className="block truncate text-xs text-muted-foreground">
                                  {row.snippet}
                                </span>
                              )}
                            </span>
                            {row.meta && (
                              <span className="max-w-[40%] shrink-0 truncate text-xs text-muted-foreground">
                                {row.meta}
                              </span>
                            )}
                          </>
                        )}
                      </AutocompleteItem>
                    )}
                  </AutocompleteCollection>
                </AutocompleteGroup>
              </div>
            )}
          </AutocompleteList>
        </AutocompleteContent>
      </Autocomplete>
      <Button type="submit" size="lg">
        <SearchIcon aria-hidden />
        搜尋
      </Button>
    </form>
  );
}
