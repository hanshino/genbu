import Link from "next/link";
import type { Metadata } from "next";
import { ChevronRightIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { COMPOUND_TYPE_LABELS, compoundTypeRank } from "@/lib/constants/compound";
import { getAllCompoundGroupsWithStats } from "@/lib/queries/compound";

export const metadata: Metadata = {
  title: "煉化配方 · 玄武",
  description: "瀏覽全部煉化群組與配方",
};

function formatLevelRange(min: number | null, max: number | null): string {
  if (min == null || max == null) return "—";
  if (min === max) return `Lv${min}`;
  return `Lv${min}~${max}`;
}

export default function CompoundsHubPage() {
  const stats = getAllCompoundGroupsWithStats();
  const nonEmpty = stats.filter((g) => g.count > 0);
  const totalRecipes = nonEmpty.reduce((s, g) => s + g.count, 0);

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-8">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">煉化配方</h1>
        <p className="text-sm text-muted-foreground">
          {nonEmpty.length} 個煉化群組 · 共 {totalRecipes.toLocaleString()} 條配方
        </p>
      </header>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {nonEmpty.map((g) => {
          const typeEntries = Object.entries(g.typeBreakdown).sort(
            ([a], [b]) => compoundTypeRank(a) - compoundTypeRank(b),
          );
          return (
            <Link
              key={g.id}
              href={`/compounds/${g.id}`}
              className="block transition-shadow hover:ring-2 hover:ring-ring/40 rounded-xl"
            >
              <Card size="sm" className="h-full">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <span>{g.name ?? `#${g.id}`}</span>
                    <ChevronRightIcon
                      className="ml-auto size-4 text-muted-foreground"
                      aria-hidden
                    />
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex items-baseline gap-2 text-sm">
                    <span className="font-mono">{g.count}</span>
                    <span className="text-xs text-muted-foreground">條配方</span>
                    <span className="ml-auto font-mono text-xs text-muted-foreground">
                      {formatLevelRange(g.minLevel, g.maxLevel)}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {typeEntries.map(([t, n]) => (
                      <Badge key={t} variant="outline" className="font-normal">
                        {COMPOUND_TYPE_LABELS[t] ?? t} × {n}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>

      <p className="text-xs text-muted-foreground">
        群組對應 COMPOUND.INI 的 [COMPGROUP] 區塊（GroupID）；點 Card 進入該群組的全部配方。
      </p>
    </div>
  );
}
