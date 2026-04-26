import Link from "next/link";

export interface MaterialEntry {
  id: number;
  name: string;
  amount: number | null;
}

/**
 * 配方裡會出現「假 id」當 placeholder：
 * - "slot-kind"：ITEM_COMPOUND_EQUIPMENT 副材料 id ∈ 1..5（武器/帽/衣/鞋/飾品類）
 * - "self"    ：ORNAMENT 配方主材料以 id=1 表示「目標裝備自身」
 * - "real"    ：真正的 item id，可連結到 /items/{id}
 */
export type MaterialKind = "slot-kind" | "self" | "real";

interface MaterialLinkProps {
  m: MaterialEntry;
  kind?: MaterialKind;
}

export function MaterialLink({ m, kind = "real" }: MaterialLinkProps) {
  const isPlaceholder = kind !== "real";
  return (
    <div className="flex flex-wrap items-baseline gap-x-1 gap-y-0">
      {isPlaceholder ? (
        <span className="text-muted-foreground italic">{m.name}</span>
      ) : (
        <Link
          href={`/items/${m.id}`}
          className="min-w-0 break-words underline-offset-2 hover:underline"
        >
          {m.name}
        </Link>
      )}
      {m.amount != null && (
        <span className="shrink-0 font-mono text-muted-foreground">×{m.amount}</span>
      )}
    </div>
  );
}

interface MaterialListProps {
  materials: MaterialEntry[];
  /**
   * 統一指定整列的判定方式，或用 function 逐筆判定。
   * 預設 "real"。
   */
  resolveKind?: MaterialKind | ((m: MaterialEntry) => MaterialKind);
}

export function MaterialList({ materials, resolveKind = "real" }: MaterialListProps) {
  if (materials.length === 0) return <span className="text-muted-foreground">—</span>;
  return (
    <div className="space-y-0.5">
      {materials.map((m) => {
        const kind = typeof resolveKind === "function" ? resolveKind(m) : resolveKind;
        return <MaterialLink key={m.id} m={m} kind={kind} />;
      })}
    </div>
  );
}

/** ITEM_COMPOUND_EQUIPMENT 配方專用：副材料 id ∈ 1..5 是裝備槽 placeholder。 */
export function equipmentSideMaterialKind(m: MaterialEntry): MaterialKind {
  return m.id >= 1 && m.id <= 5 ? "slot-kind" : "real";
}
