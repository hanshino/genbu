import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PROFILES } from "@/lib/changelog/config";
import type { ChangelogEntry, TableDiff, RowRef } from "@/lib/changelog/types";
import { SummaryBadges } from "./summary-badges";
import { TableSection, type TableSectionData } from "./table-section";

function toSectionData(td: TableDiff): TableSectionData {
  const route = PROFILES[td.table]?.detailRoute;
  const link = (r: { idParts: string[]; name?: string }) => ({
    idParts: r.idParts,
    name: r.name,
    href: route ? route(r.idParts) : undefined,
  });
  return {
    table: td.table,
    label: td.label,
    tier: td.tier,
    counts: td.counts,
    structural: td.structural,
    systematic: td.systematic,
    noIdentity: td.noIdentity,
    rebuilt: td.rebuilt,
    added: td.added?.map(link),
    removed: td.removed?.map(link),
    changed: td.changed?.map((c) => ({ ...link(c), fields: c.fields })),
    addedTruncated: td.addedTruncated,
    removedTruncated: td.removedTruncated,
    changedTruncated: td.changedTruncated,
  };
}

export function VersionCard({ entry }: { entry: ChangelogEntry }) {
  const tableLine = [
    entry.addedTables.length ? `新增資料表：${entry.addedTables.join("、")}` : "",
    entry.removedTables.length ? `移除資料表：${entry.removedTables.join("、")}` : "",
  ]
    .filter(Boolean)
    .join("　");

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center gap-2">
          <Badge>{`v${entry.version}`}</Badge>
          <span className="text-muted-foreground text-sm">{entry.date}</span>
        </div>
        <CardTitle className="sr-only">{`版本 ${entry.version}`}</CardTitle>
        {entry.note ? <p className="text-sm leading-relaxed">{entry.note}</p> : null}
        <SummaryBadges summary={entry.summary} />
      </CardHeader>
      <CardContent className="space-y-2">
        {tableLine ? <p className="text-muted-foreground text-xs">{tableLine}</p> : null}
        {entry.tables.map((t) => (
          <TableSection key={t.table} data={toSectionData(t)} />
        ))}
      </CardContent>
    </Card>
  );
}
