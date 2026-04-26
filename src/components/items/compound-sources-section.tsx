import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatMoney, formatProb } from "@/lib/format/compound";
import {
  MaterialLink,
  MaterialList,
} from "@/components/compounds/material-link";
import { groupCompoundsByGroupName } from "@/lib/compound-grouping";
import { getCompoundSourcesForItem } from "@/lib/queries/compound";

export function CompoundSourcesSection({ itemId }: { itemId: number }) {
  const sources = getCompoundSourcesForItem(itemId);
  if (sources.length === 0) return null;

  const groupBlocks = groupCompoundsByGroupName(sources);

  return (
    <section className="space-y-3">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-lg font-medium">煉化來源</h2>
        <span className="text-xs text-muted-foreground">
          可由以下配方煉化取得 · {sources.length} 條配方
        </span>
      </div>

      <div className="space-y-4">
        {groupBlocks.map(([groupName, items]) => (
          <div key={groupName} className="space-y-2">
            <div className="flex items-center gap-2">
              <Badge variant="outline">{groupName}</Badge>
              <span className="text-xs text-muted-foreground">{items.length} 條</span>
            </div>

            <div className="rounded-lg border border-border/60 overflow-x-auto">
              <Table className="table-fixed">
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[170px]">配方</TableHead>
                    <TableHead className="text-right w-[48px]">等級</TableHead>
                    <TableHead className="w-[130px]">主材料</TableHead>
                    <TableHead className="w-[140px]">副材料</TableHead>
                    <TableHead className="text-right w-[72px]">金錢</TableHead>
                    <TableHead className="text-right w-[64px]">機率</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((u) => {
                    // 找出此配方產出本物品那一筆 output 的機率（取最高值，正常情況只有一筆）
                    const output = u.outputs.find((o) => o.itemId === itemId);
                    const prob = output?.prob ?? 0;
                    // ORNAMENT 還原配方中，主材料 id=1 是「目標裝備自身」placeholder
                    const coreKind: "self" | "real" =
                      u.coreMaterial?.id === 1 ? "self" : "real";
                    return (
                      <TableRow key={u.id}>
                        <TableCell className="text-sm align-top whitespace-normal break-words">
                          <div>{u.name ?? `#${u.id}`}</div>
                          {u.help && (
                            <div
                              className="line-clamp-2 text-xs text-muted-foreground"
                              title={u.help}
                            >
                              {u.help}
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="text-right align-top font-mono text-xs">
                          {u.level ?? "—"}
                        </TableCell>
                        <TableCell className="text-xs align-top whitespace-normal break-words">
                          {u.coreMaterial ? (
                            <MaterialLink m={u.coreMaterial} kind={coreKind} />
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-xs align-top whitespace-normal break-words">
                          <MaterialList materials={u.sideMaterials} />
                        </TableCell>
                        <TableCell className="text-right align-top font-mono text-xs">
                          {formatMoney(u.money)}
                        </TableCell>
                        <TableCell className="text-right align-top font-mono text-xs">
                          {formatProb(prob)}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </div>
        ))}
      </div>

      <p className="text-xs text-muted-foreground">
        機率以單次嘗試計算；同一條配方所有可能產出（含未產出）的機率合計為 100%。
      </p>
    </section>
  );
}
