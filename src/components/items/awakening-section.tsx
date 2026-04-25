import { ChevronDownIcon, InfoIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { computeCumulative } from "@/lib/awakening-cost";
import { getAwakeningPath } from "@/lib/queries/awakening";
import type { Item } from "@/lib/types/item";
import { cn } from "@/lib/utils";

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

const RISK_BANDS = [
  { min: 0.5, tone: "", label: null },
  { min: 0.2, tone: "text-chart-4", label: "中風險" },
  { min: 0, tone: "text-primary", label: "高風險" },
] as const;

type RiskBand = (typeof RISK_BANDS)[number];

function getProbRisk(p: number): RiskBand {
  return RISK_BANDS.find((b) => p >= b.min) ?? RISK_BANDS[RISK_BANDS.length - 1];
}

export function AwakeningSection({ item }: { item: Item }) {
  const path = getAwakeningPath(item);
  if (!path) return null;

  const cumulative = computeCumulative(path.stages);
  const bonusColumns = path.stages[0]?.bonuses ?? [];

  const lastRow = cumulative[cumulative.length - 1];
  const maxExpected =
    lastRow && Number.isFinite(lastRow.cumulativeExpected) ? lastRow.cumulativeExpected : 0;

  return (
    <section className="space-y-3">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-lg font-medium">覺醒升階</h2>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span>覺醒類別</span>
          <Badge variant="outline" className="font-mono">
            {path.prefix}
          </Badge>
        </div>
      </div>

      <div className="rounded-lg border border-border/60 overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[70px]">階段</TableHead>
              {bonusColumns.map((b) => (
                <TableHead key={b.bonusType} className="text-right">
                  {b.label}
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
              const bonusByType = new Map(row.bonuses.map((b) => [b.bonusType, b.value]));
              const isMilestone = MILESTONE_STAGES.has(row.stage);
              const risk = getProbRisk(row.stageProb);
              const expectedFinite = Number.isFinite(row.cumulativeExpected);
              const showBar = expectedFinite && maxExpected > 0;
              const expectedPct = showBar
                ? Math.min(100, (row.cumulativeExpected / maxExpected) * 100)
                : 0;

              return (
                <TableRow key={row.stage} className={cn(isMilestone && "font-medium")}>
                  <TableCell
                    className={cn(
                      "font-mono",
                      isMilestone && "border-l-2 border-l-primary/70",
                    )}
                  >
                    +{row.stage}
                  </TableCell>
                  {bonusColumns.map((b) => (
                    <TableCell key={b.bonusType} className="text-right font-mono">
                      {bonusByType.has(b.bonusType) ? `+${bonusByType.get(b.bonusType)}` : "—"}
                    </TableCell>
                  ))}
                  <TableCell className="text-right font-mono text-xs">
                    {formatMoney(row.stageMoney)}
                  </TableCell>
                  <TableCell className="text-xs">
                    {row.materialName}×{row.materialAmount}
                  </TableCell>
                  <TableCell className={cn("text-right font-mono text-xs", risk.tone)}>
                    {formatProb(row.stageProb)}
                    {risk.label && <span className="sr-only">（{risk.label}）</span>}
                  </TableCell>
                  <TableCell className="relative text-right font-mono text-xs">
                    <div>{formatMoney(row.cumulativeBest)}</div>
                    <div className="text-muted-foreground">
                      {expectedFinite
                        ? `期望 ≈ ${formatMoney(row.cumulativeExpected)}`
                        : "期望 —"}
                    </div>
                    {showBar && (
                      <div
                        className="pointer-events-none absolute inset-x-0 bottom-0 h-0.5 bg-primary/40"
                        style={{ width: `${expectedPct}%` }}
                        aria-hidden
                      />
                    )}
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

      <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
        <InfoIcon className="mt-0.5 size-3 shrink-0" aria-hidden />
        <span>
          屬性欄為該階獨立加值，非累計總值。累積金錢「期望」欄假設失敗不掉階；+18~+20
          實際成本更高，可用退階防護令避免。
        </span>
      </p>

      <details className="group rounded-lg border border-border/60 bg-card px-4 py-3 text-sm">
        <summary className="flex cursor-pointer list-none select-none items-center justify-between gap-2 font-medium transition-colors hover:text-foreground/80 [&::-webkit-details-marker]:hidden">
          <span>覺醒機制速查</span>
          <ChevronDownIcon
            className="size-4 text-muted-foreground transition-transform group-open:rotate-180"
            aria-hidden
          />
        </summary>
        <ul className="mt-3 list-disc space-y-1 pl-5 text-muted-foreground">
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
    </section>
  );
}
