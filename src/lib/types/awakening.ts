/**
 * 一個覺醒階段的單一屬性配方。
 * 同階段、同部位可能有多個屬性可選（例：200鞋 +1 同時有 DEF/ATK/MATK/DODGE/HP 5 條 row，
 * 共享 money/material/successProb，只差 bonus）。Stage 把它們合併。
 */
export interface AwakeningStage {
  /** +1 ~ +20 */
  stage: number;
  /** 此階金錢成本 */
  money: number;
  /** 主要使用的覺醒符 id */
  materialId: number;
  /** 覺醒符中文名（從 items 表 join 出來） */
  materialName: string;
  /** 此階消耗符數量 */
  materialAmount: number;
  /** 成功率（0~1，不是百分比） */
  successProb: number;
  /** 此階段可加的所有屬性（一般單元素，200 系鞋/甲/帽 為 5 元素） */
  bonuses: AwakeningBonus[];
}

export interface AwakeningBonus {
  /** ITEM_BONUS_DEF / ITEM_BONUS_ATK / ... */
  bonusType: string;
  /** 中文標籤（防禦 / 物攻 / ...） */
  label: string;
  /** 加值大小（DB 原值是字串，這裡轉成 number） */
  value: number;
}

export interface AwakeningPath {
  /** 該裝備對應的 prefix，例：`200鞋` */
  prefix: string;
  /** 共 20 階（若 DB 有缺則少於 20，按實際存在排序） */
  stages: AwakeningStage[];
}
