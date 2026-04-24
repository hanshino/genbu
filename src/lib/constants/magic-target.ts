// magic.target 作用目標：TARGET_* 字串
// 依 DB distribution + 字面意義推定中文對照。

export const MAGIC_TARGET_LABELS: Record<string, string> = {
  TARGET_ENEMYTARGET: "單體敵人",
  TARGET_ENEMY: "敵人",
  TARGET_ENEMYEX: "敵人 (擴)",
  TARGET_PASSIVE: "被動",
  TARGET_SELF: "自身",
  TARGET_ALLY: "友軍",
  TARGET_GROUP: "範圍",
  TARGET_GROUP_ONE: "範圍 (單次)",
  TARGET_SIEGE_GROUND: "攻城地面",
  TARGET_LOVE: "情侶",
};

export const MAGIC_TARGET_ORDER: readonly string[] = [
  "TARGET_ENEMYTARGET",
  "TARGET_ENEMY",
  "TARGET_ENEMYEX",
  "TARGET_GROUP",
  "TARGET_GROUP_ONE",
  "TARGET_SELF",
  "TARGET_ALLY",
  "TARGET_PASSIVE",
  "TARGET_SIEGE_GROUND",
  "TARGET_LOVE",
];

export function magicTargetLabel(target: string | null | undefined): string {
  if (!target) return "—";
  return MAGIC_TARGET_LABELS[target] ?? target;
}
