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
  MaterialLink,
  MaterialList,
  equipmentSideMaterialKind,
} from "@/components/compounds/material-link";
import { OutputCell } from "@/components/compounds/output-cell";
import type { CompoundUse } from "@/lib/queries/compound";

/**
 * 共用配方表：用於 group detail 頁與其他需要完整呈現 compound row 的場景。
 * 比 EquipmentEnhancementsSection 表格多顯示「副材料 / 失敗回收 / 金錢」欄。
 */
export function CompoundRecipeTable({ recipes }: { recipes: CompoundUse[] }) {
  if (recipes.length === 0) return null;
  return (
    <div className="rounded-lg border border-border/60 overflow-x-auto">
      <Table className="table-fixed">
        <TableHeader>
          <TableRow>
            <TableHead className="w-[220px]">配方</TableHead>
            <TableHead className="text-right w-[48px]">等級</TableHead>
            <TableHead className="w-[130px]">主材料</TableHead>
            <TableHead className="w-[150px]">副材料</TableHead>
            <TableHead className="w-[180px]">產出</TableHead>
            <TableHead className="w-[100px]">失敗回收</TableHead>
            <TableHead className="text-right w-[80px]">金錢</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {recipes.map((u) => {
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
                <TableCell className="text-xs align-top whitespace-normal break-words">
                  {u.coreMaterial ? (
                    <MaterialLink m={u.coreMaterial} />
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell className="text-xs align-top whitespace-normal break-words">
                  <MaterialList
                    materials={u.sideMaterials}
                    resolveKind={isEquipment ? equipmentSideMaterialKind : "real"}
                  />
                </TableCell>
                <TableCell className="text-xs align-top whitespace-normal break-words">
                  <OutputCell outputs={u.outputs} />
                </TableCell>
                <TableCell className="text-xs align-top whitespace-normal break-words">
                  {u.failItem ? (
                    <MaterialLink m={u.failItem} />
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell className="text-right align-top font-mono text-xs">
                  {formatMoney(u.money)}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
