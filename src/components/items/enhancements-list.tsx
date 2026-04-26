"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronRightIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsiblePanel,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  formatBonusRange,
  formatProb,
  formatProbRange,
} from "@/lib/format/compound";
import { cn } from "@/lib/utils";
import type { CompoundUse } from "@/lib/queries/compound";

export type EnhancementSortMode = "prob" | "bonus";

export interface BonusBucket {
  label: string;
  uses: CompoundUse[];
  minBonus: number;
  maxBonus: number;
  minProb: number;
  maxProb: number;
}

function compareByProb(a: CompoundUse, b: CompoundUse): number {
  const pa = a.outputs[0]?.prob ?? 0;
  const pb = b.outputs[0]?.prob ?? 0;
  if (pa !== pb) return pb - pa;
  return (b.level ?? 0) - (a.level ?? 0);
}

function compareByBonus(a: CompoundUse, b: CompoundUse): number {
  const ma = a.outputs[0]?.max ?? -Infinity;
  const mb = b.outputs[0]?.max ?? -Infinity;
  if (ma !== mb) return mb - ma;
  // 加值同分時，二鍵：機率 desc → 等級 desc
  return compareByProb(a, b);
}

function BucketRow({
  bucket,
  sort,
}: {
  bucket: BonusBucket;
  sort: EnhancementSortMode;
}) {
  const sortedUses = useMemo(() => {
    const cmp = sort === "bonus" ? compareByBonus : compareByProb;
    return [...bucket.uses].sort(cmp);
  }, [bucket.uses, sort]);

  return (
    <Collapsible className="rounded-lg border border-border/60 bg-card">
      <CollapsibleTrigger className="group flex w-full items-center gap-3 rounded-lg px-4 py-3 hover:bg-muted/50">
        <ChevronRightIcon
          className="size-4 shrink-0 text-muted-foreground transition-transform group-data-[panel-open]:rotate-90"
          aria-hidden
        />
        <span className="shrink-0 text-sm font-medium">{bucket.label}</span>
        <span className="shrink-0 font-mono text-sm text-foreground/80">
          {formatBonusRange(bucket.minBonus, bucket.maxBonus)}
        </span>
        <span className="ml-auto shrink-0 text-xs text-muted-foreground">
          {bucket.uses.length} 條 · {formatProbRange(bucket.minProb, bucket.maxProb)}
        </span>
      </CollapsibleTrigger>
      <CollapsiblePanel>
        <div className="overflow-x-auto border-t border-border/60">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[200px]">配方</TableHead>
                <TableHead className="text-right w-[56px]">等級</TableHead>
                <TableHead className="w-[160px]">核心材料</TableHead>
                <TableHead
                  className={cn(
                    "text-right w-[64px]",
                    sort === "bonus" && "text-foreground",
                  )}
                >
                  加值
                </TableHead>
                <TableHead
                  className={cn(
                    "text-right w-[72px]",
                    sort === "prob" && "text-foreground",
                  )}
                >
                  機率
                </TableHead>
                <TableHead className="w-[120px]">來源</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedUses.map((u) => {
                const main = u.outputs[0];
                return (
                  <TableRow key={u.id}>
                    <TableCell className="text-sm align-top">
                      <div className="truncate" title={u.name ?? undefined}>
                        {u.name ?? `#${u.id}`}
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs">
                      {u.level ?? "—"}
                    </TableCell>
                    <TableCell className="text-xs">
                      {u.coreMaterial ? (
                        <Link
                          href={`/items/${u.coreMaterial.id}`}
                          className="underline-offset-2 hover:underline"
                        >
                          {u.coreMaterial.name}
                        </Link>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs">
                      {main && main.min != null && main.max != null
                        ? main.min === main.max
                          ? `+${main.max}`
                          : `+${main.min}~+${main.max}`
                        : "—"}
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs">
                      {main ? formatProb(main.prob) : "—"}
                    </TableCell>
                    <TableCell className="text-xs">
                      {u.groupName && (
                        <Badge variant="outline" className="font-normal">
                          {u.groupName}
                        </Badge>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </CollapsiblePanel>
    </Collapsible>
  );
}

interface SortToggleProps {
  value: EnhancementSortMode;
  onChange: (next: EnhancementSortMode) => void;
}

function SortToggle({ value, onChange }: SortToggleProps) {
  const baseBtn =
    "rounded-sm px-2.5 py-1 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
  const activeBtn = "bg-background text-foreground shadow-sm";
  const inactiveBtn = "text-muted-foreground hover:text-foreground";

  return (
    <div
      role="group"
      aria-label="排序方式"
      className="inline-flex items-center rounded-md border border-border/60 bg-muted p-0.5 text-xs"
    >
      <button
        type="button"
        onClick={() => onChange("prob")}
        aria-pressed={value === "prob"}
        className={cn(baseBtn, value === "prob" ? activeBtn : inactiveBtn)}
      >
        依機率
      </button>
      <button
        type="button"
        onClick={() => onChange("bonus")}
        aria-pressed={value === "bonus"}
        className={cn(baseBtn, value === "bonus" ? activeBtn : inactiveBtn)}
      >
        依加值
      </button>
    </div>
  );
}

export function EnhancementsList({ buckets }: { buckets: BonusBucket[] }) {
  const [sort, setSort] = useState<EnhancementSortMode>("bonus");

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <SortToggle value={sort} onChange={setSort} />
      </div>
      <div className="space-y-2">
        {buckets.map((b) => (
          <BucketRow key={b.label} bucket={b} sort={sort} />
        ))}
      </div>
    </div>
  );
}
