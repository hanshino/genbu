import Link from "next/link";
import { formatProb, formatRange } from "@/lib/format/compound";
import type { CompoundOutput } from "@/lib/queries/compound";

/**
 * 配方產出欄共用渲染。
 * 物品產出 → ×qty；裝備加成 → +N（差異化以免誤讀）。
 * 在窄欄位下：label 可換行，機率與數量保持右側不縮小，必要時整列 wrap 到下一行。
 */
export function OutputCell({ outputs }: { outputs: CompoundOutput[] }) {
  if (outputs.length === 0) return <span className="text-muted-foreground">—</span>;
  return (
    <div className="space-y-0.5">
      {outputs.map((o, i) => {
        const range = formatRange(o.min, o.max);
        const valuePrefix = o.kind === "item" ? "×" : o.kind === "bonus" ? "+" : "";
        const showValue = o.kind === "item" ? range !== "" && range !== "0" : range !== "";

        const labelEl = o.itemId ? (
          <Link
            href={`/items/${o.itemId}`}
            className="min-w-0 break-words underline-offset-2 hover:underline"
          >
            {o.label}
          </Link>
        ) : (
          <span className="min-w-0 break-words">{o.label}</span>
        );
        return (
          <div
            key={`${o.rawType}-${i}`}
            className="flex flex-wrap items-baseline gap-x-1 gap-y-0"
          >
            {labelEl}
            {showValue && (
              <span className="shrink-0 font-mono text-muted-foreground">
                {valuePrefix}
                {range}
              </span>
            )}
            <span className="ml-auto shrink-0 font-mono text-muted-foreground">
              {formatProb(o.prob)}
            </span>
          </div>
        );
      })}
    </div>
  );
}
