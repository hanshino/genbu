import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatMoney } from "@/lib/format/compound";
import {
  MaterialList,
  equipmentSideMaterialKind,
} from "@/components/compounds/material-link";
import { OutputCell } from "@/components/compounds/output-cell";
import { collectCompoundItemIds, groupCompoundsByGroupName } from "@/lib/compound-grouping";
import type { CompoundUse } from "@/lib/queries/compound";
import { getItemIconMap } from "@/lib/queries/images";
import { ItemSubSection } from "@/components/items/item-section-group";

export function CompoundUsesSection({ uses }: { uses: CompoundUse[] }) {
  if (uses.length === 0) return null;

  const groupBlocks = groupCompoundsByGroupName(uses);
  const iconMap = getItemIconMap(collectCompoundItemIds(uses));

  return (
    <ItemSubSection
      title="煉化材料"
      summary={`可投入 ${uses.length} 條配方`}
      footer="此道具在這些配方中作為主材料被消耗。產出機率以單次嘗試計算；同一條配方所有可能產出（含未產出）的機率合計為 100%。裝備類煉化失敗會掉到「失敗回收」道具。"
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
                    <TableHead className="text-right w-[56px]">本物</TableHead>
                    <TableHead className="text-right w-[72px]">金錢</TableHead>
                    <TableHead className="w-[130px]">副材料</TableHead>
                    <TableHead className="w-[170px]">產出</TableHead>
                    <TableHead className="w-[100px]">失敗回收</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((u) => {
                    const isEquipment = u.type === "ITEM_COMPOUND_EQUIPMENT";
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
                        <TableCell className="text-right align-top font-mono text-xs">
                          ×{u.coreMaterial?.amount ?? "?"}
                        </TableCell>
                        <TableCell className="text-right align-top font-mono text-xs">
                          {formatMoney(u.money)}
                        </TableCell>
                        <TableCell className="text-xs align-top whitespace-normal break-words">
                          <MaterialList
                            materials={u.sideMaterials}
                            resolveKind={
                              isEquipment ? equipmentSideMaterialKind : "real"
                            }
                            iconMap={iconMap}
                          />
                        </TableCell>
                        <TableCell className="text-xs align-top whitespace-normal break-words">
                          <OutputCell outputs={u.outputs} iconMap={iconMap} />
                        </TableCell>
                        <TableCell className="text-xs align-top whitespace-normal break-words">
                          {u.failItem ? (
                            <MaterialList materials={[u.failItem]} iconMap={iconMap} />
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
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
