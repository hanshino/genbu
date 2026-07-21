// 頁面用純取值：把 ai 層缺席時的預設（detail）集中於此，元件不必各自判斷。
import type { ChangelogEntry } from "./types";

export function getHighlights(entry: ChangelogEntry): string[] {
  return entry.ai?.highlights ?? [];
}

export function getTableMode(entry: ChangelogEntry, table: string): "detail" | "summary" {
  return entry.ai?.tables[table]?.mode ?? "detail";
}

export function getTableNote(entry: ChangelogEntry, table: string): string | undefined {
  return entry.ai?.tables[table]?.note;
}
