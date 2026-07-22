import fs from "node:fs";
import path from "node:path";
import type { ChangelogEntry, TableAddition } from "./types";

export const CHANGELOG_DIR = path.join(process.cwd(), "src", "data", "changelog");

// 向後相容：舊版檔的 addedTables/removedTables 是純字串陣列（無列數），
// 正規化成 TableAddition，讓新版渲染／型別一致對待。
function normalizeTableAdditions(v: unknown): TableAddition[] {
  if (!Array.isArray(v)) return [];
  return v.map((t) => (typeof t === "string" ? { table: t, label: t } : (t as TableAddition)));
}

// 只在 build 階段（Server Component 靜態渲染）呼叫。
export function loadChangelog(dir: string = CHANGELOG_DIR): ChangelogEntry[] {
  let files: string[];
  try {
    files = fs.readdirSync(dir).filter((f) => f.endsWith(".json"));
  } catch {
    return [];
  }
  const entries: ChangelogEntry[] = [];
  for (const f of files) {
    const raw = fs.readFileSync(path.join(dir, f), "utf8");
    const e = JSON.parse(raw) as ChangelogEntry;
    e.addedTables = normalizeTableAdditions(e.addedTables);
    e.removedTables = normalizeTableAdditions(e.removedTables);
    entries.push(e);
  }
  entries.sort((a, b) =>
    a.date < b.date ? 1 : a.date > b.date ? -1 : b.version.localeCompare(a.version),
  );
  return entries;
}
