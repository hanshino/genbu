// 技能命中需求：遊戲公式是 玩家命中 × (skill.func_hit_p1 / 100) ≥ 怪物閃躲
// 反推玩家需要撐的命中：ceil(dodge × 100 / p1)
//
// 當某技能跨級 p1 不一樣（例：幽冥刺擊 Lv1-10 p1=120, Lv11-20 p1=125），
// 需要命中也會隨等級變化：p1 越高、需要越低。所以輸出一個範圍。

export interface HitRequirement {
  /** 最寬鬆的需命中：p1 = maxP1 的情況 */
  minRequired: number;
  /** 最嚴格的需命中：p1 = minP1 的情況（整條等級都穩打中的門檻） */
  maxRequired: number;
}

export function computeHitRequirement(dodge: number, minP1: number, maxP1: number): HitRequirement {
  const safeMin = Math.max(1, minP1);
  const safeMax = Math.max(1, maxP1);
  return {
    minRequired: Math.ceil((dodge * 100) / safeMax),
    maxRequired: Math.ceil((dodge * 100) / safeMin),
  };
}
