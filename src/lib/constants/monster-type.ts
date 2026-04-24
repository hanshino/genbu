// monsters.type / npc.type：DB 值域為 13–19 (7 類)
// tthol-line-bot locale 未對照；暫以數字 + 暫定中文，TODO 校對。

export const MONSTER_TYPE_LABELS: Record<number, string> = {
  // 13: "",
  // 14: "",
  // 15: "",
  // 16: "",
  // 17: "",
  // 18: "",
  // 19: "",
};

export const MONSTER_TYPE_ORDER: readonly number[] = [13, 14, 15, 16, 17, 18, 19];

export function monsterTypeLabel(type: number | null | undefined): string {
  if (type == null) return "—";
  return MONSTER_TYPE_LABELS[type] ?? `類型 ${type}`;
}
