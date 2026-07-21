// summary 模式：一句話 + 計數，無展開（設計定案 a）。server component。
export function TableSummaryRow({
  label,
  counts,
  note,
}: {
  label: string;
  counts: { added: number; changed: number; removed: number };
  note?: string;
}) {
  return (
    <div className="border-border/60 rounded-md border px-3 py-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium">{label}</span>
        <span className="text-muted-foreground text-xs">
          {`+${counts.added} ~${counts.changed} −${counts.removed}`}
        </span>
      </div>
      {note ? <p className="text-muted-foreground mt-1 text-xs leading-relaxed">{note}</p> : null}
    </div>
  );
}
