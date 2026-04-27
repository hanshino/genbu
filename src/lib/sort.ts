export type SortDir = "asc" | "desc";

export function parseSortDir(raw: string | undefined): SortDir | undefined {
  return raw === "asc" || raw === "desc" ? raw : undefined;
}

interface BuildOrderByOptions {
  allowlist: Record<string, string>;
  sortBy: string | undefined;
  sortDir: SortDir | undefined;
  defaultOrderBy: string;
  idColumn: string;
  extraTiebreak?: string;
}

// Allowlist gates `sortBy`; unmapped values fall back to `defaultOrderBy`.
// The id-column branch skips a redundant `ORDER BY <id>, <id>` pair.
export function buildOrderBy(opts: BuildOrderByOptions): string {
  const { allowlist, sortBy, sortDir, defaultOrderBy, idColumn, extraTiebreak } = opts;
  const sortCol = sortBy ? (allowlist[sortBy] ?? null) : null;
  if (!sortCol) return `ORDER BY ${defaultOrderBy}`;
  const dir = sortDir === "desc" ? "DESC" : "ASC";
  const tail = extraTiebreak ? `, ${extraTiebreak}` : "";
  if (sortCol === idColumn) return `ORDER BY ${idColumn} ${dir}${tail}`;
  return `ORDER BY ${sortCol} ${dir}, ${idColumn} ASC${tail}`;
}
