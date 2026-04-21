"use client";

import type { Item, ItemRand } from "@/lib/types/item";
import { presets, scoreItem } from "@/lib/scoring";

interface Props {
  items: Item[];
  randsByItem: Map<number, ItemRand[]>;
}

export function ComparePresets({ items, randsByItem }: Props) {
  if (items.length === 0) return null;

  const rows = presets.map((p) => {
    const scores = items.map((it) =>
      scoreItem(it, randsByItem.get(it.id) ?? [], p.weights).score
    );
    return { preset: p, scores };
  });

  return (
    <div className="overflow-x-auto rounded-md border border-border/60">
      <table className="w-full text-sm">
        <thead className="bg-muted/40">
          <tr>
            <th className="px-2 py-1.5 text-left">流派</th>
            {items.map((it) => (
              <th key={it.id} className="px-2 py-1.5 text-right">
                {it.name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const max = Math.max(...r.scores);
            const min = Math.min(...r.scores);
            return (
              <tr key={r.preset.id} className="border-t border-border/40">
                <td className="px-2 py-1.5 text-muted-foreground">{r.preset.label}</td>
                {r.scores.map((s, i) => (
                  <td
                    key={items[i].id}
                    className={
                      "px-2 py-1.5 text-right font-mono " +
                      (s === max && max !== min
                        ? "bg-primary/10 font-semibold text-primary"
                        : s === min && max !== min
                        ? "text-muted-foreground"
                        : "")
                    }
                  >
                    {Math.round(s)}
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
