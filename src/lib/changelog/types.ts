// 更新日誌 diff 引擎共用型別。刻意不 import 任何 runtime 相依，
// 讓 tsx CLI 與 Next 頁面都能安全引入。

export interface TableProfile {
  tier: "rich" | "count"; // 精華層（逐欄明細+深連）/ 計數層（只計數）
  label: string; // zh-tw 顯示名，如 "道具"
  identity: string[]; // 識別欄（覆寫自動偵測）；空陣列 → 引擎改用全列雜湊 fallback
  displayName?: string; // 顯示名稱欄
  fields?: Record<string, string>; // rich 專用白名單：欄名 → zh-tw 標籤；其餘欄一律忽略
  detailRoute?: (idParts: string[]) => string; // rich 專用：深連詳情頁；收識別欄陣列
}

export interface FieldChange {
  col: string;
  label: string;
  from: string;
  to: string;
}

export interface RowRef {
  idParts: string[]; // 原始識別欄值（不含控制字元）
  name?: string;
}

export interface RowChange extends RowRef {
  fields: FieldChange[];
}

export interface SystematicChange {
  col: string;
  label: string;
  from: string;
  to: string;
  count: number;
}

export interface TableDiff {
  table: string;
  label: string;
  tier: "rich" | "count";
  counts: { added: number; changed: number; removed: number };
  structural?: { addedColumns: string[]; removedColumns: string[] };
  systematic?: SystematicChange[];
  added?: RowRef[];
  removed?: RowRef[];
  changed?: RowChange[];
  addedTruncated?: number;
  removedTruncated?: number;
  changedTruncated?: number;
  noIdentity?: boolean; // 無識別欄 → 全列雜湊 multiset diff
  rebuilt?: boolean; // 整表重建防呆觸發
}

export interface DbDiff {
  addedTables: string[];
  removedTables: string[];
  tables: TableDiff[]; // 有變動的表才收錄，rich（core 最前）排前
  summary: { added: number; changed: number; removed: number };
}

export interface ChangelogEntry {
  version: string;
  date: string; // YYYY-MM-DD
  note?: string;
  summary: { added: number; changed: number; removed: number };
  addedTables: string[];
  removedTables: string[];
  tables: TableDiff[];
}

export interface DiffOptions {
  maxRowsPerTable?: number; // 每表明細上限，預設 200
  maxStringLen?: number; // 長字串輸出截斷，預設 120
  systematicMinCount?: number; // 系統性摺疊絕對筆數門檻，預設 100
  systematicCoverage?: number; // 系統性摺疊覆蓋率門檻，預設 0.9
  systematicMaxDistinct?: number; // 系統性摺疊 distinct 配對上限，預設 3
  rebuildRatio?: number; // 整表重建門檻（added+removed 佔比），預設 0.5
  rebuildMinRows?: number; // 觸發整表重建的最小列數門檻，預設 50
}
