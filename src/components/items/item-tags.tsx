import { classify } from "@/lib/classifier";
import type { Item, ItemRand } from "@/lib/types/item";
import { Badge } from "@/components/ui/badge";

export interface ItemTagsProps {
  item: Item;
  rands?: readonly ItemRand[];
}

export function ItemTags({ item, rands = [] }: ItemTagsProps) {
  const tags = classify({ item, rands });
  if (tags.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1">
      {tags.map((t) => (
        <Badge key={t.id} variant="outline" title={t.description}>
          {t.label}
        </Badge>
      ))}
    </div>
  );
}
