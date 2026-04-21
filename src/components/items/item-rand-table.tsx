import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { ItemRand } from "@/lib/types/item";
import { itemAttributeNames } from "@/lib/constants/i18n";

export function ItemRandTable({ rands }: { rands: ItemRand[] }) {
  if (rands.length === 0) return null;

  const totalRate = rands.reduce((sum, r) => sum + r.rate, 0);

  return (
    <section className="space-y-2">
      <h2 className="text-lg font-medium">隨機屬性</h2>
      <div className="rounded-lg border border-border/60 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>屬性</TableHead>
              <TableHead className="w-[90px] text-right">最小</TableHead>
              <TableHead className="w-[90px] text-right">最大</TableHead>
              <TableHead className="w-[90px] text-right">機率</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rands.map((row, idx) => {
              const label = itemAttributeNames[row.attribute] ?? row.attribute;
              const probability = totalRate > 0 ? (row.rate / totalRate) * 100 : 0;
              return (
                <TableRow key={`${row.attribute}-${idx}`}>
                  <TableCell>{label}</TableCell>
                  <TableCell className="text-right font-mono">{row.min}</TableCell>
                  <TableCell className="text-right font-mono">{row.max}</TableCell>
                  <TableCell className="text-right font-mono">
                    {probability.toFixed(1)}%
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </section>
  );
}
