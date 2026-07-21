import type BetterSqlite3 from "better-sqlite3";
import type {
  DbDiff,
  TableDiff,
  TableProfile,
  DiffOptions,
  RowRef,
  RowChange,
  FieldChange,
  SystematicChange,
  ChangelogEntry,
  SurfacedField,
} from "./types";
import { EXCLUDE } from "./config";

type DB = BetterSqlite3.Database;
type Row = Record<string, unknown>;

const SEP = "\x01"; // identityKey 內部分隔符；不外洩到 JSON

const DEFAULTS: Required<DiffOptions> = {
  maxRowsPerTable: 200,
  maxStringLen: 120,
  systematicMinCount: 100,
  systematicCoverage: 0.9,
  systematicMaxDistinct: 3,
  rebuildRatio: 0.5,
  rebuildMinRows: 50,
};

const CORE_TABLES = new Set(["items", "magic", "monsters"]);

function listTables(db: DB): string[] {
  const rows = db
    .prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
    .all() as { name: string }[];
  return rows.map((r) => r.name).filter((n) => !EXCLUDE.has(n) && !n.startsWith("sqlite_"));
}

function schemaOf(db: DB, table: string): { names: string[]; pk: string[] } {
  const info = db.prepare(`PRAGMA table_info("${table}")`).all() as { name: string; pk: number }[];
  const names = info.map((c) => c.name);
  const pk = info
    .filter((c) => c.pk > 0)
    .sort((a, b) => a.pk - b.pk)
    .map((c) => c.name);
  return { names, pk };
}

function norm(v: unknown): string {
  return v === null || v === undefined ? "" : String(v);
}

function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max) + "…" : s;
}

function loadRows(db: DB, table: string): Row[] {
  return db.prepare(`SELECT * FROM "${table}"`).all() as Row[];
}

function rowRef(row: Row, identity: string[], profile: TableProfile | undefined, maxStringLen: number): RowRef {
  const ref: RowRef = { idParts: identity.map((c) => norm(row[c])) };
  const dn = profile?.displayName;
  if (dn && row[dn] != null && row[dn] !== "") ref.name = truncate(norm(row[dn]), maxStringLen);
  return ref;
}

// rich added/removed：把白名單欄的「現值」攤成 surfaced fields（供 AI digest / 詳情頁）。
function surfacedFields(
  row: Row,
  profile: TableProfile | undefined,
  identity: string[],
  maxStringLen: number,
): SurfacedField[] {
  if (!profile?.fields) return [];
  const out: SurfacedField[] = [];
  for (const [col, label] of Object.entries(profile.fields)) {
    if (identity.includes(col)) continue;
    const v = norm(row[col]);
    if (v === "") continue;
    out.push({ col, label, value: truncate(v, maxStringLen) });
  }
  return out;
}

function multisetDiff(oldRows: Row[], newRows: Row[], cols: string[]): { added: number; removed: number } {
  const hash = (r: Row) => cols.map((c) => norm(r[c])).join(SEP);
  const oldC = new Map<string, number>();
  for (const r of oldRows) {
    const k = hash(r);
    oldC.set(k, (oldC.get(k) ?? 0) + 1);
  }
  const newC = new Map<string, number>();
  for (const r of newRows) {
    const k = hash(r);
    newC.set(k, (newC.get(k) ?? 0) + 1);
  }
  let added = 0;
  let removed = 0;
  for (const [k, n] of newC) {
    const ol = oldC.get(k) ?? 0;
    if (n > ol) added += n - ol;
  }
  for (const [k, ol] of oldC) {
    const n = newC.get(k) ?? 0;
    if (ol > n) removed += ol - n;
  }
  return { added, removed };
}

function diffTable(
  oldDb: DB,
  newDb: DB,
  table: string,
  profile: TableProfile | undefined,
  o: Required<DiffOptions>,
): TableDiff {
  const label = profile?.label ?? table;
  const tier: "rich" | "count" = profile?.tier ?? "count";

  const oldSchema = schemaOf(oldDb, table);
  const newSchema = schemaOf(newDb, table);
  const oldColSet = new Set(oldSchema.names);
  const newColSet = new Set(newSchema.names);
  const addedColumns = newSchema.names.filter((c) => !oldColSet.has(c));
  const removedColumns = oldSchema.names.filter((c) => !newColSet.has(c));
  const sharedCols = newSchema.names.filter((c) => oldColSet.has(c));

  const td: TableDiff = { table, label, tier, counts: { added: 0, changed: 0, removed: 0 } };
  if (addedColumns.length || removedColumns.length) {
    td.structural = { addedColumns, removedColumns };
  }

  let identity = profile?.identity ?? [];
  if (identity.length === 0) identity = newSchema.pk;
  const identityUsable =
    identity.length > 0 && identity.every((c) => oldColSet.has(c) && newColSet.has(c));

  const oldRows = loadRows(oldDb, table);
  const newRows = loadRows(newDb, table);

  if (!identityUsable) {
    const { added, removed } = multisetDiff(oldRows, newRows, sharedCols);
    td.noIdentity = true;
    td.counts = { added, changed: 0, removed };
    return td;
  }

  const keyOf = (r: Row) => identity.map((c) => norm(r[c])).join(SEP);
  const oldMap = new Map<string, Row>();
  for (const r of oldRows) oldMap.set(keyOf(r), r);
  const newMap = new Map<string, Row>();
  for (const r of newRows) newMap.set(keyOf(r), r);

  const addedRows: Row[] = [];
  const removedRows: Row[] = [];
  for (const [k, r] of newMap) if (!oldMap.has(k)) addedRows.push(r);
  for (const [k, r] of oldMap) if (!newMap.has(k)) removedRows.push(r);

  // 整表重建防呆（兩層皆適用）
  const totalRows = Math.max(oldRows.length, newRows.length);
  if (totalRows >= o.rebuildMinRows && (addedRows.length + removedRows.length) / totalRows > o.rebuildRatio) {
    td.rebuilt = true;
    td.counts = { added: addedRows.length, changed: 0, removed: removedRows.length };
    return td;
  }

  const surfaced =
    tier === "rich" && profile?.fields
      ? sharedCols.filter((c) => c in profile.fields! && !identity.includes(c))
      : sharedCols.filter((c) => !identity.includes(c));

  const pairStats = new Map<string, Map<string, number>>();
  const raw: { row: Row; diffs: FieldChange[] }[] = [];
  let changedCount = 0;
  for (const [k, rn] of newMap) {
    const ro = oldMap.get(k);
    if (!ro) continue;
    const diffs: FieldChange[] = [];
    for (const c of surfaced) {
      const from = norm(ro[c]);
      const to = norm(rn[c]);
      if (from === to) continue;
      diffs.push({
        col: c,
        label: profile?.fields?.[c] ?? c,
        from: truncate(from, o.maxStringLen),
        to: truncate(to, o.maxStringLen),
      });
      if (tier === "rich") {
        const pk = `${from}${SEP}${to}`;
        let m = pairStats.get(c);
        if (!m) pairStats.set(c, (m = new Map()));
        m.set(pk, (m.get(pk) ?? 0) + 1);
      }
    }
    if (diffs.length) {
      changedCount++;
      if (tier === "rich") raw.push({ row: rn, diffs });
    }
  }

  // 計數層：只回計數，不列明細、不做系統性摺疊
  if (tier !== "rich") {
    td.counts = { added: addedRows.length, changed: changedCount, removed: removedRows.length };
    return td;
  }

  // 系統性摺疊
  const systematic = new Map<string, SystematicChange>();
  for (const [col, m] of pairStats) {
    const total = [...m.values()].reduce((a, b) => a + b, 0);
    if (total < o.systematicMinCount || m.size > o.systematicMaxDistinct) continue;
    const top = [...m.entries()].sort((a, b) => b[1] - a[1])[0];
    if (top[1] / total > o.systematicCoverage) {
      const sepIdx = top[0].indexOf(SEP);
      systematic.set(col, {
        col,
        label: profile?.fields?.[col] ?? col,
        from: truncate(top[0].slice(0, sepIdx), o.maxStringLen),
        to: truncate(top[0].slice(sepIdx + SEP.length), o.maxStringLen),
        count: top[1],
      });
    }
  }

  const changed: RowChange[] = [];
  for (const rc of raw) {
    const kept = rc.diffs.filter((d) => !systematic.has(d.col));
    if (kept.length) changed.push({ ...rowRef(rc.row, identity, profile, o.maxStringLen), fields: kept });
  }

  const attach = (r: Row): RowRef => {
    const ref = rowRef(r, identity, profile, o.maxStringLen);
    const f = surfacedFields(r, profile, identity, o.maxStringLen);
    if (f.length) ref.fields = f;
    return ref;
  };
  const added: RowRef[] = addedRows.map(attach);
  const removed: RowRef[] = removedRows.map(attach);

  td.counts = { added: added.length, changed: changed.length, removed: removed.length };
  if (systematic.size) td.systematic = [...systematic.values()];

  if (added.length > o.maxRowsPerTable) {
    td.added = added.slice(0, o.maxRowsPerTable);
    td.addedTruncated = added.length - o.maxRowsPerTable;
  } else if (added.length) td.added = added;

  if (removed.length > o.maxRowsPerTable) {
    td.removed = removed.slice(0, o.maxRowsPerTable);
    td.removedTruncated = removed.length - o.maxRowsPerTable;
  } else if (removed.length) td.removed = removed;

  if (changed.length > o.maxRowsPerTable) {
    td.changed = changed.slice(0, o.maxRowsPerTable);
    td.changedTruncated = changed.length - o.maxRowsPerTable;
  } else if (changed.length) td.changed = changed;

  return td;
}

function isEmpty(td: TableDiff): boolean {
  return (
    td.counts.added === 0 &&
    td.counts.changed === 0 &&
    td.counts.removed === 0 &&
    !td.structural &&
    !(td.systematic && td.systematic.length)
  );
}

function rank(td: TableDiff): number {
  if (td.tier === "rich") return CORE_TABLES.has(td.table) ? 0 : 1;
  return 2;
}

export function diffDatabases(
  oldDb: DB,
  newDb: DB,
  profiles: Record<string, TableProfile>,
  opts: DiffOptions = {},
): DbDiff {
  const o = { ...DEFAULTS, ...opts };
  const oldTables = new Set(listTables(oldDb));
  const newTables = new Set(listTables(newDb));
  const all = [...new Set([...oldTables, ...newTables])].sort();

  const addedTables = all.filter((t) => !oldTables.has(t) && newTables.has(t));
  const removedTables = all.filter((t) => oldTables.has(t) && !newTables.has(t));
  const both = all.filter((t) => oldTables.has(t) && newTables.has(t));

  const tables: TableDiff[] = [];
  for (const t of both) {
    const td = diffTable(oldDb, newDb, t, profiles[t], o);
    if (!isEmpty(td)) tables.push(td);
  }
  tables.sort((a, b) => rank(a) - rank(b) || a.table.localeCompare(b.table));

  const summary = tables.reduce(
    (acc, t) => ({
      added: acc.added + t.counts.added,
      changed: acc.changed + t.counts.changed,
      removed: acc.removed + t.counts.removed,
    }),
    { added: 0, changed: 0, removed: 0 },
  );

  return { addedTables, removedTables, tables, summary };
}

export function buildChangelogEntry(
  diff: DbDiff,
  meta: { version: string; date: string; note?: string },
): ChangelogEntry | null {
  const empty =
    diff.addedTables.length === 0 && diff.removedTables.length === 0 && diff.tables.length === 0;
  if (empty) return null;
  return {
    version: meta.version,
    date: meta.date,
    note: meta.note,
    summary: diff.summary,
    addedTables: diff.addedTables,
    removedTables: diff.removedTables,
    tables: diff.tables,
  };
}
