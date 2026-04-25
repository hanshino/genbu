import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getAwakeningPath } from "@/lib/queries/awakening";
import { computeCumulative } from "@/lib/awakening-cost";
import type { Item } from "@/lib/types/item";

const MILESTONE_STAGES = new Set([10, 15, 18, 20]);

function formatMoney(n: number): string {
  if (!Number.isFinite(n)) return "—";
  if (n >= 100_000_000) return `${(n / 100_000_000).toFixed(2)} 億`;
  if (n >= 10_000) return `${(n / 10_000).toFixed(1)} 萬`;
  return n.toLocaleString();
}

function formatProb(p: number): string {
  return `${(p * 100).toFixed(p < 0.1 ? 1 : 0)}%`;
}

function formatMaterials(map: Record<string, number>): string {
  return Object.entries(map)
    .map(([name, n]) => `${name}×${n}`)
    .join("、");
}

export function AwakeningSection({ item }: { item: Item }) {
  const path = getAwakeningPath(item);
  if (!path) return null;

  const cumulative = computeCumulative(path.stages);

  // 此 prefix 提供的所有 bonus types — 取 +1 那階即可（每階屬性集合相同）。
  const bonusTypes = path.stages[0]?.bonuses.map((b) => b.bonusType) ?? [];
  const bonusLabels = path.stages[0]?.bonuses.map((b) => b.label) ?? [];

  return (
    <section className="space-y-3">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-lg font-medium">覺醒升階</h2>
        <span className="text-xs text-muted-foreground">
          覺醒類別：<span className="font-mono">{path.prefix}</span>
        </span>
      </div>

      <div className="rounded-lg border border-border/60 overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[70px]">階段</TableHead>
              {bonusLabels.map((label) => (
                <TableHead key={label} className="text-right">
                  {label}
                </TableHead>
              ))}
              <TableHead className="text-right">此階金錢</TableHead>
              <TableHead>此階符</TableHead>
              <TableHead className="text-right">成功率</TableHead>
              <TableHead className="text-right">累積金錢</TableHead>
              <TableHead>累積符</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {cumulative.map((row) => {
              const stage = path.stages.find((s) => s.stage === row.stage)!;
              const bonusByType = new Map(stage.bonuses.map((b) => [b.bonusType, b.value]));
              const isMilestone = MILESTONE_STAGES.has(row.stage);
              return (
                <TableRow
                  key={row.stage}
                  className={isMilestone ? "bg-muted/50 font-medium" : undefined}
                >
                  <TableCell className="font-mono">+{row.stage}</TableCell>
                  {bonusTypes.map((t) => (
                    <TableCell key={t} className="text-right font-mono">
                      {bonusByType.has(t) ? `+${bonusByType.get(t)}` : "—"}
                    </TableCell>
                  ))}
                  <TableCell className="text-right font-mono text-xs">
                    {formatMoney(row.stageMoney)}
                  </TableCell>
                  <TableCell className="text-xs">
                    {row.materialName}×{row.materialAmount}
                  </TableCell>
                  <TableCell className="text-right font-mono text-xs">
                    {formatProb(row.stageProb)}
                  </TableCell>
                  <TableCell className="text-right font-mono text-xs">
                    <div>{formatMoney(row.cumulativeBest)}</div>
                    <div className="text-muted-foreground">
                      期 {formatMoney(row.cumulativeExpected)}
                    </div>
                  </TableCell>
                  <TableCell className="text-xs">
                    {formatMaterials(row.cumulativeMaterials)}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <details className="rounded-lg border border-border/60 bg-card px-4 py-3 text-sm">
        <summary className="cursor-pointer select-none font-medium">覺醒機制速查</summary>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-muted-foreground">
          <li>
            <strong>失敗保護：</strong>+1~+5 不毀裝；+11~+17 不掉階。
          </li>
          <li>
            <strong>掉階規則：</strong>+17 衝 +18 失敗會降回 +16；+18~+20 失敗依序掉階。
          </li>
          <li>
            <strong>退階防護令</strong>（商城）：+18 需 140 張、+19 需 170 張、+20 需 200 張。
            本表「累積金錢（期望）」<em>未計入</em>此成本。
          </li>
          <li>
            <strong>幸運值：</strong>突破失敗會累積幸運值，提升下次成功率，成功後重置。
          </li>
          <li>
            <strong>覺醒符煉化：</strong>七星以上覺醒符可由 3 張次階符煉化；超越覺醒符可由 3
            張突破覺醒符煉化。
          </li>
        </ul>
      </details>

      <p className="text-xs text-muted-foreground">
        累積金錢「期」欄假設失敗不掉階；+18~+20 實際成本更高，可用退階防護令避免。
      </p>
    </section>
  );
}
