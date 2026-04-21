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
import type { Item } from "@/lib/types/item";

export function ItemTable({ items }: { items: Item[] }) {
  if (items.length === 0) {
    return (
      <div className="rounded-lg border border-border/60 bg-card px-6 py-12 text-center text-muted-foreground">
        找不到符合條件的道具
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border/60 overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[90px]">編號</TableHead>
            <TableHead>名稱</TableHead>
            <TableHead className="w-[140px]">類型</TableHead>
            <TableHead className="w-[70px] text-right">等級</TableHead>
            <TableHead className="w-[70px] text-right">重量</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item) => (
            <TableRow key={item.id}>
              <TableCell className="font-mono text-xs text-muted-foreground">
                {item.id}
              </TableCell>
              <TableCell>
                <Link
                  href={`/items/${item.id}`}
                  className="font-medium hover:underline"
                >
                  {item.name}
                </Link>
                {item.note && (
                  <span className="ml-2 text-xs text-muted-foreground">
                    {item.note}
                  </span>
                )}
              </TableCell>
              <TableCell>
                {item.type ? (
                  <Badge variant="secondary" className="font-normal">
                    {item.type}
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
