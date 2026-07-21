// 把確定性 diff 濃縮成「有界」摘要餵給 AI，避免把上千筆原始列塞進 prompt。
// 純函式、無 I/O。計數為全量；樣本有上限，超出記 *SampleTruncated。
import type { AiDigest, AiDigestTable, DbDiff, RowChange, TableDiff } from "./types";

const MAX_ADDED = 40;
const MAX_REMOVED = 40;
const MAX_CHANGED = 20;

export function digestForAI(diff: DbDiff): AiDigest {
  return {
    summary: diff.summary,
    addedTables: diff.addedTables,
    removedTables: diff.removedTables,
    tables: diff.tables.map(digestTable),
  };
}

function digestTable(t: TableDiff): AiDigestTable {
  const d: AiDigestTable = { table: t.table, label: t.label, tier: t.tier, counts: t.counts };
  if (t.structural) {
    d.structural = {
      addedColumns: t.structural.addedColumns.length,
      removedColumns: t.structural.removedColumns.length,
    };
  }
  if (t.systematic?.length) {
    d.systematic = t.systematic.map((s) => ({ label: s.label, from: s.from, to: s.to, count: s.count }));
  }
  if (t.rebuilt) d.rebuilt = true;
  if (t.noIdentity) d.noIdentity = true;

  if (t.added?.length) {
    d.addedSample = t.added.slice(0, MAX_ADDED).map((r) => {
      const o: { name?: string; fields?: Record<string, string> } = {};
      if (r.name) o.name = r.name;
      if (r.fields?.length) {
        o.fields = {};
        for (const f of r.fields) o.fields[f.label] = f.value;
      }
      return o;
    });
    const extra = t.added.length - d.addedSample.length + (t.addedTruncated ?? 0);
    if (extra > 0) d.addedSampleTruncated = extra;
  }

  if (t.removed?.length) {
    d.removedSample = t.removed.slice(0, MAX_REMOVED).map((r) => (r.name ? { name: r.name } : {}));
    const extra = t.removed.length - d.removedSample.length + (t.removedTruncated ?? 0);
    if (extra > 0) d.removedSampleTruncated = extra;
  }

  if (t.changed?.length) {
    const counts: Record<string, number> = {};
    for (const c of t.changed) for (const f of c.fields) counts[f.label] = (counts[f.label] ?? 0) + 1;
    d.changedFieldCounts = counts;

    // 「批量欄」= 出現次數最多的欄；優先挑觸及非批量欄的列給 AI 看。
    const bulk = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0];
    const score = (c: RowChange) => c.fields.filter((f) => f.label !== bulk).length * 10 + c.fields.length;
    const ranked = [...t.changed].sort((a, b) => score(b) - score(a));
    d.changedSample = ranked.slice(0, MAX_CHANGED).map((c) => ({
      ...(c.name ? { name: c.name } : {}),
      fields: c.fields.map((f) => ({ label: f.label, from: f.from, to: f.to })),
    }));
    const extra = t.changed.length - d.changedSample.length + (t.changedTruncated ?? 0);
    if (extra > 0) d.changedSampleTruncated = extra;
  }

  return d;
}
