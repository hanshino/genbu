"use client";

import { Fragment, useState, type ReactNode } from "react";
import { ChevronDownIcon, SearchIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

export interface MysteryTableRow {
  key: string;
  icon: ReactNode;
  name: ReactNode;
  qty: string;
  prob: string;
  rare: boolean;
  /** 搜尋比對用的純文字（道具名等）。 */
  search: string;
  /** 開出的道具本身也是寶箱時的內容（server 端預先渲染）。 */
  nested: ReactNode | null;
}

const SEARCH_THRESHOLD = 20;

/** 清單版的「顯示其餘 N 項」：children 為一串 li。 */
export function ShowMoreList({ children, limit = 10 }: { children: ReactNode[]; limit?: number }) {
  const [showAll, setShowAll] = useState(false);
  const hiddenCount = children.length - limit;
  return (
    <div className="space-y-2">
      <ul className="divide-y divide-border/60 rounded-lg border border-border/60 bg-card">
        {showAll ? children : children.slice(0, limit)}
      </ul>
      {hiddenCount > 0 && (
        <Button variant="ghost" size="sm" onClick={() => setShowAll((v) => !v)} className="text-muted-foreground">
          {showAll ? `收合，只看前 ${limit} 項` : `顯示其餘 ${hiddenCount} 項`}
          <ChevronDownIcon className={cn("transition-transform", showAll && "rotate-180")} aria-hidden />
        </Button>
      )}
    </div>
  );
}

/** 隨機寶箱內容表：預設只顯示前 limit 列，多時提供搜尋；寶箱列可展開內容。 */
export function MysteryTable({ rows, limit = 10 }: { rows: MysteryTableRow[]; limit?: number }) {
  const [showAll, setShowAll] = useState(false);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState<Set<string>>(() => new Set());

  const q = query.trim().toLowerCase();
  const visible = q
    ? rows.filter((r) => r.search.toLowerCase().includes(q))
    : showAll
      ? rows
      : rows.slice(0, limit);
  const hiddenCount = rows.length - limit;

  const toggle = (key: string) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  return (
    <div className="space-y-2">
      {rows.length > SEARCH_THRESHOLD && (
        <InputGroup className="max-w-xs">
          <InputGroupAddon>
            <SearchIcon aria-hidden />
          </InputGroupAddon>
          <InputGroupInput
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={`搜尋 ${rows.length} 個項目`}
            aria-label="搜尋寶箱內容"
          />
        </InputGroup>
      )}

      <div className="overflow-hidden rounded-lg border border-border/60 bg-card">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-10 pl-3">
                <span className="sr-only">圖示</span>
              </TableHead>
              <TableHead>名稱</TableHead>
              <TableHead className="text-right">數量</TableHead>
              <TableHead className="pr-3 text-right">機率</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visible.map((r) => {
              const isOpen = open.has(r.key);
              return (
                <Fragment key={r.key}>
                  <TableRow className={cn(isOpen && "border-b-0 bg-muted/30")}>
                    <TableCell className="pl-3">{r.icon}</TableCell>
                    <TableCell className="whitespace-normal">
                      <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-1">
                        {r.name}
                        {r.rare && (
                          <Badge variant="outline" className="font-normal text-muted-foreground">
                            稀有
                          </Badge>
                        )}
                        {r.nested && (
                          <Button
                            variant="outline"
                            size="xs"
                            aria-expanded={isOpen}
                            onClick={() => toggle(r.key)}
                            className="text-muted-foreground"
                          >
                            展開內容
                            <ChevronDownIcon
                              className={cn("transition-transform", isOpen && "rotate-180")}
                              aria-hidden
                            />
                          </Button>
                        )}
                      </span>
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs text-muted-foreground">{r.qty}</TableCell>
                    <TableCell className="pr-3 text-right font-mono tabular-nums">{r.prob}</TableCell>
                  </TableRow>
                  {isOpen && (
                    <TableRow className="hover:bg-transparent">
                      <TableCell colSpan={4} className="border-l-2 border-border bg-muted/20 py-2 pr-2 pl-6 whitespace-normal">
                        {r.nested}
                      </TableCell>
                    </TableRow>
                  )}
                </Fragment>
              );
            })}
            {visible.length === 0 && (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={4} className="py-6 text-center text-sm text-muted-foreground">
                  找不到符合「{query.trim()}」的項目
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {!q && hiddenCount > 0 && (
        <Button variant="ghost" size="sm" onClick={() => setShowAll((v) => !v)} className="text-muted-foreground">
          {showAll ? `收合，只看前 ${limit} 項` : `顯示其餘 ${hiddenCount} 項`}
          <ChevronDownIcon className={cn("transition-transform", showAll && "rotate-180")} aria-hidden />
        </Button>
      )}
    </div>
  );
}
