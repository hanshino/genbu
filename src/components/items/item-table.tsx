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
import { isUnidentifiedNote } from "@/lib/item-note";
import { EmptyResult } from "@/components/common/empty-result";
import type { Item } from "@/lib/types/item";
import type { EntityImage } from "@/lib/queries/images";
import { ITEM_TYPE_LABELS } from "@/lib/constants/item-types";
import { ITEM_COLUMNS, type ItemColumnKey } from "@/lib/constants/item-columns";
import { NumericCell, STICKY_ID_COL, stickyNameCol } from "@/components/common/column-cells";
import { cn } from "@/lib/utils";

interface ItemTableProps {
  items: Item[];
  sort: SortContext;
  iconMap: Map<number, EntityImage>;
  search?: string;
  unfilteredTotal?: number;
  columns: readonly ItemColumnKey[];
}

export function ItemTable({
  items,
  sort,
  iconMap,
  search = "",
  unfilteredTotal,
  columns,
}: ItemTableProps) {
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

  const show = new Set(columns);
  const numericCols = ITEM_COLUMNS.numeric.filter((c) => show.has(c.key));
  const nameCol = stickyNameCol(show.has("id"));

  return (
    <div className="overflow-x-auto rounded-lg border border-border/60">
      <Table>
        <TableHeader>
          <TableRow className="group/row">
            {show.has("id") && (
              <SortableHead column="id" label="編號" className={STICKY_ID_COL} sort={sort} />
            )}
            <TableHead className={nameCol}>名稱</TableHead>
            {show.has("type") && <TableHead className="w-[140px]">類型</TableHead>}
            {show.has("level") && (
              <SortableHead column="level" label="等級" className="w-[70px]" right sort={sort} />
            )}
            {show.has("weight") && (
              <SortableHead column="weight" label="重量" className="w-[70px]" right sort={sort} />
            )}
            {numericCols.map((c) => (
              <SortableHead key={c.key} column={c.key} label={c.label} right sort={sort} />
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item) => (
            <TableRow key={item.id} className="group/row">
              {show.has("id") && (
                <TableCell className={cn("font-mono text-xs text-muted-foreground", STICKY_ID_COL)}>
                  {item.id}
                </TableCell>
              )}
              <TableCell className={nameCol}>
                <div className="flex items-center gap-2">
                  <ItemIcon image={iconMap.get(item.id) ?? null} alt={item.name} className="size-7" />
                  <div className="min-w-0">
                    <Link href={`/items/${item.id}`} className="font-medium hover:underline">
                      {item.name}
                    </Link>
                    {item.note && !isUnidentifiedNote(item.note) && (
                      <span className="ml-2 text-xs text-muted-foreground">{item.note}</span>
                    )}
                  </div>
                </div>
              </TableCell>
              {show.has("type") && (
                <TableCell>
                  {item.type ? (
                    <Badge variant="secondary" className="font-normal">
                      {ITEM_TYPE_LABELS[item.type] ?? item.type}
                    </Badge>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
              )}
              {show.has("level") && <TableCell className="text-right">{item.level}</TableCell>}
              {show.has("weight") && <TableCell className="text-right">{item.weight}</TableCell>}
              {numericCols.map((c) => (
                // 0 = 沒有這項數值（見 item-columns.ts）
                <NumericCell key={c.key} value={item[c.field] || null} />
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
