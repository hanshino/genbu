import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { Magic } from "@/lib/types/magic";
import { ItemIcon } from "@/components/common/item-icon";
import { pickMagicIcon, type EntityImage } from "@/lib/queries/images";

interface SkillLevelTableProps {
  rows: Magic[];
  levelIcons?: Map<number, EntityImage>;
}

// 欄位：只顯示「至少有一個 level 非 0/null」的欄位，避免滿屏空值。
const CANDIDATE_FIELDS: readonly { key: keyof Magic; label: string }[] = [
  { key: "spend_mp", label: "真氣消耗" },
  { key: "spend_hp", label: "體力消耗" },
  { key: "func_dmg", label: "傷害參數" },
  { key: "func_hit_p1", label: "命中率 (%)" },
  { key: "break_prob", label: "破招機率" },
  { key: "stun", label: "間隔(ms)" },
  { key: "time", label: "持續(ms)" },
  { key: "status_param", label: "效果參數" },
  { key: "status_prob", label: "狀態機率" },
  { key: "range", label: "距離" },
  { key: "hit_range", label: "命中範圍" },
  { key: "recharge_time", label: "施放(ms)" },
];

export function SkillLevelTable({ rows, levelIcons }: SkillLevelTableProps) {
  if (rows.length === 0) return null;

  // 只有各等級圖示不同時才多開一欄，否則每列都同一張圖沒意義。
  const iconOf = (level: number) => pickMagicIcon(levelIcons, level);
  const showIcons = new Set(rows.map((r) => iconOf(r.level)?.url)).size > 1;

  const visibleFields = CANDIDATE_FIELDS.filter(({ key }) =>
    rows.some((r) => {
      const v = r[key];
      return v != null && v !== 0;
    }),
  );

  return (
    <div className="overflow-hidden rounded-lg border border-border/60">
      <div className="border-b border-border/60 bg-card px-4 py-2 text-sm font-medium">
        全等級成長對照
      </div>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className={showIcons ? "w-[88px]" : "w-[60px]"}>Lv</TableHead>
              {visibleFields.map((f) => (
                <TableHead key={String(f.key)} className="text-right font-mono text-xs">
                  {f.label}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.level}>
                <TableCell className="font-mono">
                  {showIcons ? (
                    <span className="inline-flex items-center gap-2">
                      <ItemIcon image={iconOf(r.level)} alt="" className="size-6" />
                      {r.level}
                    </span>
                  ) : (
                    r.level
                  )}
                </TableCell>
                {visibleFields.map((f) => {
                  const v = r[f.key] as number | null;
                  return (
                    <TableCell key={String(f.key)} className="text-right font-mono tabular-nums">
                      {v == null || v === 0 ? (
                        <span className="text-muted-foreground">—</span>
                      ) : (
                        v.toLocaleString()
                      )}
                    </TableCell>
                  );
                })}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
