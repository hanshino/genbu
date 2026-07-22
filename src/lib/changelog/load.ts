import fs from "node:fs";
import path from "node:path";
import type { ChangelogEntry } from "./types";

export const CHANGELOG_DIR = path.join(process.cwd(), "src", "data", "changelog");

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
    entries.push(JSON.parse(raw) as ChangelogEntry);
  }
  entries.sort((a, b) =>
    a.date < b.date ? 1 : a.date > b.date ? -1 : b.version.localeCompare(a.version),
  );
  return entries;
}
