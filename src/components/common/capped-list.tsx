"use client";

import { useId, useState, type ReactNode } from "react";
import { ChevronDownIcon, SearchIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { cn } from "@/lib/utils";

/**
 * 清單上限：所有列都在 server 端渲染進 HTML（搜尋引擎、Ctrl+F 都看得到），
 * 超過 limit 的列只用 CSS 藏起來，按鈕只切換這條 CSS。
 *
 * children 內要有一個容器標上 `data-cap-items`（ul / tbody / grid），它的直接子元素就是「列」。
 * 給了 searchNames 時，列要標 `data-search="名稱"`，搜尋同樣用 CSS 隱藏不符合的列。
 */
export function CappedList({
  total,
  limit = 10,
  unit = "筆",
  searchNames,
  searchPlaceholder,
  children,
}: {
  total: number;
  limit?: number;
  unit?: string;
  /** 有給才出現搜尋框；用來算「找不到」的提示。 */
  searchNames?: string[];
  searchPlaceholder?: string;
  children: ReactNode;
}) {
  const id = useId();
  const [showAll, setShowAll] = useState(false);
  const [query, setQuery] = useState("");
  const q = query.trim();
  const scope = `[data-cap="${id}"]`;
  // 只取自己這層的容器，不碰巢狀 CappedList 裡的列
  const items = `${scope} [data-cap-items]:not(${scope} [data-cap] [data-cap-items])>*`;

  let css = "";
  if (q) {
    const esc = q.replace(/["\\]/g, "\\$&").replace(/\n/g, " ");
    css = `${items}:not([data-search*="${esc}" i]){display:none}`;
  } else if (!showAll && total > limit) {
    // 最後一列可見的列拿掉分隔線，不然會和外框疊成兩條
    css = `${items}:nth-child(n+${limit + 1}){display:none}${items}:nth-child(${limit}){border-bottom-width:0}`;
  }
  const lower = q.toLowerCase();
  const noMatch = q !== "" && searchNames != null && !searchNames.some((n) => n.toLowerCase().includes(lower));

  return (
    <div data-cap={id} className="space-y-2">
      {css && <style>{css}</style>}
      {searchNames && (
        <InputGroup className="max-w-xs">
          <InputGroupAddon>
            <SearchIcon aria-hidden />
          </InputGroupAddon>
          <InputGroupInput
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={searchPlaceholder ?? `搜尋 ${total} ${unit}`}
            aria-label={searchPlaceholder ?? "搜尋名稱"}
          />
        </InputGroup>
      )}
      {children}
      {noMatch && <p className="text-sm text-muted-foreground">找不到符合「{q}」的項目</p>}
      {!q && total > limit && (
        <Button variant="ghost" size="sm" onClick={() => setShowAll((v) => !v)} className="text-muted-foreground">
          {showAll ? "收起" : `顯示全部 ${total.toLocaleString("zh-TW")} ${unit}`}
          <ChevronDownIcon className={cn("transition-transform", showAll && "rotate-180")} aria-hidden />
        </Button>
      )}
    </div>
  );
}

/** 清單版上限：children 為一串 li。 */
export function ShowMoreList({
  children,
  limit = 10,
  unit = "項",
}: {
  children: ReactNode[];
  limit?: number;
  unit?: string;
}) {
  return (
    <CappedList total={children.length} limit={limit} unit={unit}>
      <ul data-cap-items className="divide-y divide-border/60 rounded-lg border border-border/60 bg-card">
        {children}
      </ul>
    </CappedList>
  );
}
