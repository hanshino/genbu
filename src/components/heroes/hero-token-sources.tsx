import Link from "next/link";
import { ScrollTextIcon } from "lucide-react";
import { ItemIcon } from "@/components/common/item-icon";
import { Badge } from "@/components/ui/badge";
import { getItemIconMap } from "@/lib/queries/images";
import type { HeroTokenSource } from "@/lib/types/mission-logic";

export function HeroTokenSources({ sources }: { sources: HeroTokenSource[] }) {
  const iconMap = getItemIconMap(sources.filter((s) => s.kind === "box").map((s) => s.id));

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-medium">符令來源</h2>
        {sources.length > 0 && (
          <span className="text-xs text-muted-foreground">{sources.length} 筆</span>
        )}
      </div>

      {sources.length === 0 ? (
        <p className="rounded-lg border border-border/60 bg-card px-4 py-6 text-sm text-muted-foreground">
          資料中沒有找到會給這位英雄符令的禮盒或任務。
        </p>
      ) : (
        <ul className="divide-y divide-border/60 overflow-hidden rounded-lg border border-border/60 bg-card">
          {sources.map((s) => {
            const isBox = s.kind === "box";
            const href = isBox ? `/items/${s.id}` : `/missions/${s.id}`;
            const label = s.name ?? (isBox ? `道具 #${s.id}` : `任務 #${s.id}`);
            return (
              <li key={`${s.kind}-${s.id}-${s.choicePath ?? ""}`}>
                <Link
                  href={href}
                  className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                >
                  {isBox ? (
                    <ItemIcon image={iconMap.get(s.id)} alt={label} />
                  ) : (
                    <span
                      className="inline-flex size-8 shrink-0 items-center justify-center rounded-md border border-border/60 bg-muted/30 text-muted-foreground"
                      aria-hidden
                    >
                      <ScrollTextIcon className="size-4" />
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline gap-x-2">
                      <span className="font-medium">{label}</span>
                      <span className="font-mono text-xs text-muted-foreground">#{s.id}</span>
                    </div>
                    {s.choicePath && (
                      <p className="truncate text-xs text-muted-foreground" title={s.choicePath}>
                        選項：{s.choicePath}
                      </p>
                    )}
                  </div>
                  <Badge variant="outline" className="shrink-0 font-normal">
                    {isBox ? "禮盒" : "任務"}
                  </Badge>
                  {s.qty != null && (
                    <span className="w-12 shrink-0 text-right font-mono text-sm tabular-nums">
                      ×{s.qty.toLocaleString()}
                    </span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      <p className="text-xs leading-relaxed text-muted-foreground">
        來源整理自禮盒內容與任務獎勵（不含 GM 指令）。有「選項」的禮盒需在開啟時選到該選項才會給符令。
      </p>
    </section>
  );
}
