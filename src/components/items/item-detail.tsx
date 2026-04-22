import { Badge } from "@/components/ui/badge";
import type { Item } from "@/lib/types/item";
import { displayableAttributeKeys, itemAttributeNames } from "@/lib/constants/i18n";

interface ItemDetailProps {
  item: Item;
  maxValues?: Record<string, number>;
}

export function ItemDetail({ item, maxValues }: ItemDetailProps) {
  const attributes = displayableAttributeKeys
    .map((key) => {
      const value = (item as unknown as Record<string, number | null>)[key];
      return { key, label: itemAttributeNames[key] ?? key, value };
    })
    .filter((row) => typeof row.value === "number" && row.value !== 0);

  return (
    <section className="space-y-6">
      <header className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">{item.name}</h1>
          {item.type && <Badge variant="secondary">{item.type}</Badge>}
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
          <span className="font-mono">#{item.id}</span>
          <span>等級 {item.level}</span>
          <span>重量 {item.weight}</span>
          {item.value > 0 && <span>販售價 {item.value}</span>}
          {item.durability > 0 && <span>耐久 {item.durability}</span>}
        </div>
        {item.note && (
          <p className="whitespace-pre-line text-sm text-muted-foreground">
            {item.note.replace(/\\n/g, "\n")}
          </p>
        )}
        {item.summary && (
          <p className="whitespace-pre-line text-sm leading-relaxed">
            {item.summary.replace(/\\n/g, "\n")}
          </p>
        )}
      </header>

      {attributes.length > 0 && (
        <div className="rounded-lg border border-border/60 bg-card">
          <div className="border-b border-border/60 px-4 py-2 text-sm font-medium">屬性</div>
          {maxValues ? (
            <div className="space-y-2 p-4">
              {attributes.map((row) => {
                const max = Math.max(1, maxValues[row.key] ?? 0);
                const pct = Math.max(0, Math.min(100, ((row.value ?? 0) / max) * 100));
                return (
                  <div
                    key={row.key}
                    className="grid grid-cols-[5rem_1fr_4.5rem] items-center gap-3"
                  >
                    <span className="text-xs text-muted-foreground">{row.label}</span>
                    <div
                      className="h-1.5 overflow-hidden rounded-full bg-muted"
                      role="meter"
                      aria-label={row.label}
                      aria-valuenow={row.value ?? 0}
                      aria-valuemin={0}
                      aria-valuemax={max}
                    >
                      <div
                        className="h-full bg-primary/70 transition-[width] motion-reduce:transition-none"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="font-mono text-right text-sm font-medium">
                      {(row.value ?? 0) > 0 ? `+${row.value}` : row.value}
                    </span>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-wrap gap-2 p-4">
              {attributes.map((row) => (
                <div
                  key={row.key}
                  className="flex flex-col items-center rounded-md border border-border/60 bg-muted/30 px-4 py-2.5 text-center"
                >
                  <span className="font-mono text-sm font-semibold">
                    {(row.value ?? 0) > 0 ? `+${row.value}` : row.value}
                  </span>
                  <span className="mt-0.5 text-xs text-muted-foreground">{row.label}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
