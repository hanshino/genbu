import type { Attributes, EquipSlot, PanelStatKey, StatKey } from "./stat-sim";

/** 規格：docs/plans/2026-10-03-stat-sim-import-format.md */
export const IMPORT_PREFIX = "TTHOL1";
export const IMPORT_VERSION = 1;

/** 匯出 stats 會出現的 key（已換成 genbu StatKey）；不在內的（如 weight）不參與拆解。 */
export const IMPORT_STAT_KEYS = [
  "hp",
  "mp",
  "str",
  "pow",
  "vit",
  "agi",
  "dex",
  "wis",
  "atk",
  "matk",
  "def",
  "mdef",
  "hit",
  "dodge",
  "critical",
  "uncanny_dodge",
  "attack_speed",
  "run_speed",
] as const satisfies readonly StatKey[];
export type ImportStatKey = (typeof IMPORT_STAT_KEYS)[number];
export type ImportStats = Partial<Record<ImportStatKey, number>>;

export interface ImportEquipEntry {
  id: number;
  /** 0–20 */
  plus: number;
  /** 長度 4，記憶體插槽順序，0 為空槽；值為 compounds.id。 */
  inlays: [number, number, number, number];
  /** 固定值＋隨機素質＋插槽合計，不含強化；只列非 0。 */
  stats: ImportStats;
}

export interface ImportPanel {
  attributes?: Partial<Attributes>;
  stats?: Partial<Record<PanelStatKey, number>>;
}

export interface ImportPayloadV1 {
  v: 1;
  app: string;
  at: string;
  name: string;
  sect: number;
  level: number;
  bare: Attributes;
  remainingPoints: number;
  equipment: Record<EquipSlot, ImportEquipEntry | null>;
  /** magic.id → 等級 */
  skills: Record<number, number>;
  /** 原始 JSON 的 panel 是扁平的；decoder 正規化成 attributes + stats。 */
  panel?: ImportPanel;
}

export interface ImportDiagnostic {
  code: string;
  /** warning：需要注意；info：已自動調整／資訊。 */
  severity: "warning" | "info";
  message: string;
  slot?: EquipSlot;
  itemId?: number;
  stat?: StatKey;
}

export class ImportError extends Error {
  constructor(
    public code: string,
    message: string,
  ) {
    super(message);
    this.name = "ImportError";
  }
}
