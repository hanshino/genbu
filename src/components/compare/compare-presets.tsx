"use client";

import type { Item, ItemRand } from "@/lib/types/item";
import { presets, expectedRandom, scoreWithShared } from "@/lib/scoring";
import { heatmapCell } from "@/lib/utils";

interface Props {
  items: Item[];
  randsByItem: Map<number, ItemRand[]>;
}

export function ComparePresets({ items, randsByItem }: Props) {
  if (items.length === 0) return null;

  const expectedByItem = items.map((it) => expectedRandom(randsByItem.get(it.id) ?? []));
  const rows = presets.map((p) => ({
    preset: p,
    scores: items.map((it, i) => scoreWithShared(it, expectedByItem[i], p.weights)),
  }));

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
            const span = max - min;
            return (
              <tr key={r.preset.id} className="border-t border-border/40">
                <td className="px-2 py-1.5 text-muted-foreground">{r.preset.label}</td>
                {r.scores.map((s, i) => (
                  <td
                    key={items[i].id}
                    style={heatmapCell(s, min, max)}
                    className={
                      "px-2 py-1.5 text-right font-mono " +
                      (s === max && span > 0
                        ? "font-semibold text-primary"
                        : s === min && span > 0
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
