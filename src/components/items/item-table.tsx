import Link from "next/link";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { SortableHead, type SortContext } from "@/components/common/sortable-head";
import { ItemIcon } from "@/components/common/item-icon";
import { EmptyResult } from "@/components/common/empty-result";
import type { Item } from "@/lib/types/item";
import type { EntityImage } from "@/lib/queries/images";
import { ITEM_TYPE_LABELS } from "@/lib/constants/item-types";

interface ItemTableProps {
  items: Item[];
  sort: SortContext;
  iconMap: Map<number, EntityImage>;
  search?: string;
  unfilteredTotal?: number;
}

export function ItemTable({ items, sort, iconMap, search = "", unfilteredTotal }: ItemTableProps) {
  if (items.length === 0) {
    return (
      <EmptyResult
        noun="道具"
        search={search}
        unfilteredTotal={unfilteredTotal}
        basePath="/items"
      />
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-border/60">
      <Table className="min-w-[640px]">
        <TableHeader>
          <TableRow>
            <SortableHead column="id" label="編號" className="w-[90px]" sort={sort} />
            <TableHead>名稱</TableHead>
            <TableHead className="w-[140px]">類型</TableHead>
            <SortableHead column="level" label="等級" className="w-[70px]" right sort={sort} />
            <SortableHead column="weight" label="重量" className="w-[70px]" right sort={sort} />
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item) => (
            <TableRow key={item.id}>
              <TableCell className="font-mono text-xs text-muted-foreground">{item.id}</TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  <ItemIcon image={iconMap.get(item.id) ?? null} alt={item.name} className="size-7" />
                  <div className="min-w-0">
                    <Link href={`/items/${item.id}`} className="font-medium hover:underline">
                      {item.name}
                    </Link>
                    {item.note && (
                      <span className="ml-2 text-xs text-muted-foreground">{item.note}</span>
                    )}
                  </div>
                </div>
              </TableCell>
              <TableCell>
                {item.type ? (
                  <Badge variant="secondary" className="font-normal">
                    {ITEM_TYPE_LABELS[item.type] ?? item.type}
                  </Badge>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </TableCell>
              <TableCell className="text-right">{item.level}</TableCell>
              <TableCell className="text-right">{item.weight}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
