import { SparklesIcon } from "lucide-react";

// 無對應 shadcn callout primitive，hand-roll 並比照鄰近 shadcn 視覺詞彙（CLAUDE.md §5）。
export function Highlights({ items }: { items: string[] }) {
  if (!items.length) return null;
  return (
    <div className="border-border/60 bg-muted/30 rounded-lg border p-3">
      <p className="mb-2 flex items-center gap-1.5 text-sm font-medium">
        <SparklesIcon className="text-primary size-4" aria-hidden />
        本版重點
      </p>
      <ul className="space-y-1.5">
        {items.map((h, i) => (
          <li key={i} className="text-sm leading-relaxed">
            {h}
          </li>
        ))}
      </ul>
    </div>
  );
}
