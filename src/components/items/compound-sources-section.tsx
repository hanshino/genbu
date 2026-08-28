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
import { collectCompoundItemIds, groupCompoundsByGroupName } from "@/lib/compound-grouping";
import type { CompoundUse } from "@/lib/queries/compound";
import { getItemIconMap } from "@/lib/queries/images";
import { ItemSubSection } from "@/components/items/item-section-group";

export function CompoundSourcesSection({
  itemId,
  sources,
}: {
  itemId: number;
  sources: CompoundUse[];
}) {
  if (sources.length === 0) return null;

  const groupBlocks = groupCompoundsByGroupName(sources);
  const iconMap = getItemIconMap(collectCompoundItemIds(sources));

  return (
    <ItemSubSection
      title="煉化取得"
      summary={`${sources.length} 條配方可產出此道具`}
      footer="機率以單次嘗試計算；同一條配方所有可能產出（含未產出）的機率合計為 100%。材料名稱可點入查看各自的取得方式。"
    >
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
                            <MaterialLink
                              m={u.coreMaterial}
                              kind={coreKind}
                              image={iconMap.get(u.coreMaterial.id) ?? null}
                            />
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-xs align-top whitespace-normal break-words">
                          <MaterialList materials={u.sideMaterials} iconMap={iconMap} />
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
    </ItemSubSection>
  );
}
