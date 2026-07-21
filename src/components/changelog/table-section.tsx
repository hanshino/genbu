"use client";

import Link from "next/link";
import { ChevronDownIcon } from "lucide-react";
import { Collapsible, CollapsibleTrigger, CollapsiblePanel } from "@/components/ui/collapsible";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { FieldChange, SystematicChange } from "@/lib/changelog/types";

export interface RowView {
  idParts: string[];
  name?: string;
  href?: string;
  desc?: string;
}
export interface ChangedRowView extends RowView {
  fields: FieldChange[];
}
export interface TableSectionData {
  table: string;
  label: string;
  tier: "rich" | "count";
  counts: { added: number; changed: number; removed: number };
  structural?: { addedColumns: string[]; removedColumns: string[] };
  systematic?: SystematicChange[];
  noIdentity?: boolean;
  rebuilt?: boolean;
  added?: RowView[];
  removed?: RowView[];
  changed?: ChangedRowView[];
  addedTruncated?: number;
  removedTruncated?: number;
  changedTruncated?: number;
}

function rowLabel(r: RowView): string {
  return r.name ?? r.idParts.join(" / ");
}

function RowLink({ r }: { r: RowView }) {
  if (r.href) {
    return (
      <Link href={r.href} className="text-primary hover:underline">
        {rowLabel(r)}
      </Link>
    );
  }
  return <span>{rowLabel(r)}</span>;
}

export function TableSection({ data }: { data: TableSectionData }) {
  const { counts } = data;
  return (
    <Collapsible className="border-border/60 rounded-md border">
      <CollapsibleTrigger className="hover:bg-muted/50 group flex items-center justify-between gap-2 rounded-md px-3 py-2">
        <span className="text-sm font-medium">{data.label}</span>
        <span className="text-muted-foreground flex items-center gap-2 text-xs">
          <span>{`+${counts.added} ~${counts.changed} −${counts.removed}`}</span>
          <ChevronDownIcon
            className="size-4 transition-transform group-data-[panel-open]:rotate-180"
            aria-hidden
          />
        </span>
      </CollapsibleTrigger>
      <CollapsiblePanel>
        <div className="space-y-3 px-3 pb-3 text-sm">
          {data.rebuilt ? (
            <p className="text-muted-foreground text-xs">
              {`整表重建（識別不穩定，+${counts.added} / −${counts.removed}）`}
            </p>
          ) : null}

          {data.structural ? (
            <p className="text-muted-foreground text-xs">
              {"資料結構調整："}
              {data.structural.addedColumns.length
                ? `新增欄位 ${data.structural.addedColumns.join("、")} `
                : ""}
              {data.structural.removedColumns.length
                ? `移除欄位 ${data.structural.removedColumns.join("、")}`
                : ""}
            </p>
          ) : null}

          {data.systematic?.map((s) => (
            <p key={s.col} className="text-muted-foreground text-xs">
              {`${s.label} 全表 ${s.from}→${s.to}（建置調整，${s.count} 筆）`}
            </p>
          ))}

          {data.added?.length ? (
            <div>
              <p className="mb-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">新增</p>
              <ul className="flex flex-wrap gap-x-3 gap-y-1">
                {data.added.map((r, i) => (
                  <li key={`a-${i}`} className={r.desc ? "w-full" : undefined}>
                    <RowLink r={r} />
                    {r.desc ? (
                      <span className="text-muted-foreground ml-2 text-xs">{r.desc}</span>
                    ) : null}
                  </li>
                ))}
              </ul>
              {data.addedTruncated ? (
                <p className="text-muted-foreground mt-1 text-xs">{`另有 ${data.addedTruncated} 筆未列出`}</p>
              ) : null}
            </div>
          ) : null}

          {data.removed?.length ? (
            <div>
              <p className="mb-1 text-xs font-medium text-red-600 dark:text-red-400">下架</p>
              <ul className="flex flex-wrap gap-x-3 gap-y-1">
                {data.removed.map((r, i) => (
                  <li key={`r-${i}`}>
                    <RowLink r={r} />
                  </li>
                ))}
              </ul>
              {data.removedTruncated ? (
                <p className="text-muted-foreground mt-1 text-xs">{`另有 ${data.removedTruncated} 筆未列出`}</p>
              ) : null}
            </div>
          ) : null}

          {data.changed?.length ? (
            <div className="space-y-2">
              <p className="text-xs font-medium text-amber-600 dark:text-amber-400">變更</p>
              {data.changed.map((r, i) => (
                <div key={`c-${i}`} className="border-border/40 rounded border p-2">
                  <p className="mb-1 font-medium">
                    <RowLink r={r} />
                  </p>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>欄位</TableHead>
                        <TableHead>原值</TableHead>
                        <TableHead>新值</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {r.fields.map((f) => (
                        <TableRow key={f.col}>
                          <TableCell>{f.label}</TableCell>
                          <TableCell className="text-muted-foreground">{f.from || "—"}</TableCell>
                          <TableCell>{f.to || "—"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ))}
              {data.changedTruncated ? (
                <p className="text-muted-foreground text-xs">{`另有 ${data.changedTruncated} 筆未列出`}</p>
              ) : null}
            </div>
          ) : null}
        </div>
      </CollapsiblePanel>
    </Collapsible>
  );
}
