"use client";

import type { Item } from "@/lib/types/item";
import { itemAttributeNames, displayableAttributeKeys } from "@/lib/constants/i18n";
import { heatmapCell } from "@/lib/utils";

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
    <div className="overflow-x-auto rounded-md border border-border/60">
      <table className="w-full text-sm">
        <thead className="bg-muted/40">
          <tr>
            <th className="px-2 py-1.5 text-left">屬性</th>
            {items.map((it) => (
              <th key={it.id} className="px-2 py-1.5 text-right">
                {it.name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const max = Math.max(...r.values);
            const min = Math.min(...r.values);
            const span = max - min;
            return (
              <tr key={r.key} className="border-t border-border/40">
                <td className="px-2 py-1.5 text-muted-foreground">{r.label}</td>
                {r.values.map((v, i) => (
                  <td
                    key={items[i].id}
                    style={heatmapCell(v, min, max)}
                    className={
                      "px-2 py-1.5 text-right font-mono " +
                      (v === max && v > 0 && span > 0
                        ? "font-semibold text-primary"
                        : "")
                    }
                  >
                    {v}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
