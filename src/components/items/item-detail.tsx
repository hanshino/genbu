import { Badge } from "@/components/ui/badge";
import type { Item } from "@/lib/types/item";
import { displayableAttributeKeys, itemAttributeNames } from "@/lib/constants/i18n";

export function ItemDetail({ item }: { item: Item }) {
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
        {item.note && <p className="text-sm text-muted-foreground">{item.note}</p>}
        {item.summary && <p className="text-sm leading-relaxed">{item.summary}</p>}
      </header>

      {attributes.length > 0 && (
        <div className="rounded-lg border border-border/60 bg-card">
          <div className="border-b border-border/60 px-4 py-2 text-sm font-medium">屬性</div>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 p-4 sm:grid-cols-3 md:grid-cols-4">
            {attributes.map((row) => (
              <div key={row.key} className="flex items-baseline justify-between gap-2">
                <dt className="text-sm text-muted-foreground">{row.label}</dt>
                <dd className="font-mono text-sm font-medium">
                  {row.value! > 0 ? `+${row.value}` : row.value}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      )}
    </section>
  );
}
