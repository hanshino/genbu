// STAGE_FLAG_* 旗標翻譯。INI 並無正式對照表，下列名稱依語意+遊戲機制推斷。

export type StageFlagVariant = "safe" | "danger" | "restrict" | "info";

interface StageFlagMeta {
  label: string;
  variant: StageFlagVariant;
  /** 滑鼠 hover 補充說明，可空。 */
  hint?: string;
}

export const STAGE_FLAG_META: Record<string, StageFlagMeta> = {
  STAGE_FLAG_SAFE: { label: "安全區", variant: "safe", hint: "通常為村莊／城鎮中央地帶" },
  STAGE_FLAG_NOFIGHT: { label: "禁止戰鬥", variant: "safe" },
  STAGE_FLAG_PK: { label: "可 PK", variant: "danger", hint: "玩家對戰開放" },
  STAGE_FLAG_NOPUNISH: { label: "死亡無懲罰", variant: "info", hint: "推測：陣亡不扣經驗" },
  STAGE_FLAG_NOPET: { label: "禁帶寵物", variant: "restrict" },
  STAGE_FLAG_NOBANTAIZI: { label: "禁搬太子", variant: "restrict", hint: "推測：禁止背負同伴機制" },
  STAGE_FLAG_NOBLOCK: { label: "不阻擋", variant: "info", hint: "推測：碰撞檢查放寬" },
  STAGE_FLAG_FORCEDAYTIME: { label: "強制白天", variant: "info" },
};

/** 旗標排序權重：安全 > 危險 > 限制 > 資訊。 */
const VARIANT_RANK: Record<StageFlagVariant, number> = {
  safe: 0,
  danger: 1,
  restrict: 2,
  info: 3,
};

export function parseStageFlags(raw: string | null | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && s !== "0");
}

export function sortStageFlags(flags: string[]): string[] {
  return [...flags].sort((a, b) => {
    const va = STAGE_FLAG_META[a]?.variant ?? "info";
    const vb = STAGE_FLAG_META[b]?.variant ?? "info";
    if (va !== vb) return VARIANT_RANK[va] - VARIANT_RANK[vb];
    return a.localeCompare(b);
  });
}

export function stageFlagLabel(flag: string): string {
  return STAGE_FLAG_META[flag]?.label ?? flag;
}

export function stageFlagVariant(flag: string): StageFlagVariant {
  return STAGE_FLAG_META[flag]?.variant ?? "info";
}
