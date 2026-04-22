"use client";

import type { Item } from "@/lib/types/item";
import { itemAttributeNames, displayableAttributeKeys } from "@/lib/constants/i18n";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

interface Props {
  items: Item[];
}

export function CompareMatrix({ items }: Props) {
  const rows = displayableAttributeKeys
    .map((key) => {
      const values = items.map((it) => {
        const v = (it as unknown as Record<string, number | null>)[key];
        return typeof v === "number" ? v : 0;
      });
      return { key, label: itemAttributeNames[key] ?? key, values };
    })
    .filter((r) => r.values.some((v) => v !== 0));

  if (items.length === 0) return null;

  return (
    <div className="overflow-hidden rounded-lg border border-border/60">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[6rem]">屬性</TableHead>
            {items.map((it) => (
              <TableHead key={it.id} className="text-right">
                {it.name}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => {
            const max = Math.max(...r.values);
            const span = max - Math.min(...r.values);
            return (
              <TableRow key={r.key} className="odd:bg-muted/15">
                <TableCell className="text-muted-foreground">{r.label}</TableCell>
                {r.values.map((v, i) => {
                  const isWinner = v === max && v > 0 && span > 0;
                  return (
                    <TableCell
                      key={items[i].id}
                      className={cn(
                        "text-right font-mono tabular-nums",
                        isWinner
                          ? "font-semibold text-primary"
                          : v === 0
                          ? "text-muted-foreground/50"
                          : "text-foreground/80"
                      )}
                    >
                      {v === 0 ? "—" : v}
                    </TableCell>
                  );
                })}
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
