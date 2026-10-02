import type { PanelBonus, PassiveDef, StatKey } from "@/lib/types/stat-sim";

/** §6b：逐級手抄，數值是該級總量，不能再累加。
 * 來源（目前 magic.help 已是解出的字串，magic.ts 直接讀取，不需 join messages）：
 * SELECT id, level, name, help FROM magic
 * WHERE id IN (13,14,21,22,23,24,26,27,29,30,51,53,180,265,601,602,750,756,771,777,821,827)
 * ORDER BY id, level;
 */
export const WEAPON_TYPE_NAMES = [
  "SWORD", "BLADE", "HAMMER", "ROD", "STAFF", "WHISK", "HIDDEN_WEAPON",
  "BOW", "GREAT_SWORD", "SHIELD", "STING", "CLAW", "PUNCHER", "BOXING",
];

type HelpPassive = Pick<PassiveDef, "cumulative" | "weaponReq" | "weaponReqStats" | "note">;

// 只把手抄的數字轉成 StatKey 物件，不解析 help；陣列第一筆為 Lv1。
function levels(stat: StatKey, values: number[]): PanelBonus[] {
  return [{}, ...values.map((value) => value === 0 ? {} : { [stat]: value })];
}

export const HELP_PASSIVES: Record<number, HelpPassive> = {
  13: { weaponReq: ["BLADE"], cumulative: levels("atk", [4, 8, 12, 17, 22, 27, 32, 38, 44, 50, 60, 70, 80, 90, 100]) },
  14: { weaponReq: ["SHIELD"], cumulative: levels("def", [9, 13, 17, 21, 25, 29, 33, 37, 41, 45, 60, 75, 90, 105, 120]) },
  21: { weaponReq: ["SWORD"], cumulative: levels("atk", [3, 6, 9, 13, 17, 21, 25, 30, 35, 40, 46, 52, 58, 64, 70]) },
  22: { weaponReq: ["PUNCHER"], cumulative: levels("atk", [2, 4, 6, 9, 12, 15, 18, 22, 26, 30, 40, 45, 50, 55, 60]) },
  23: { weaponReq: ["SWORD"], cumulative: levels("def", [6, 9, 13, 17, 21, 25, 29, 33, 37, 41, 45]) },
  24: { cumulative: levels("mp", [20, 35, 50, 65, 85, 105, 125, 150, 175, 200]) },
  26: { weaponReq: ["ROD"], cumulative: levels("atk", [23, 26, 29, 33, 37, 41, 45, 50, 55, 60]) },
  27: {
    weaponReq: ["BOXING"],
    cumulative: [{},
      { atk: 13, uncanny_dodge: 1 }, { atk: 15, uncanny_dodge: 2 },
      { atk: 17, uncanny_dodge: 3 }, { atk: 19, uncanny_dodge: 4 },
      { atk: 22, uncanny_dodge: 5 }, { atk: 25, uncanny_dodge: 6 },
      { atk: 28, uncanny_dodge: 7 }, { atk: 32, uncanny_dodge: 8 },
      { atk: 36, uncanny_dodge: 9 }, { atk: 40, uncanny_dodge: 10 }],
  },
  29: {
    weaponReq: ["HIDDEN_WEAPON"],
    cumulative: [{},
      { atk: 12, critical: 3 }, { atk: 14, critical: 3 },
      { atk: 16, critical: 4 }, { atk: 19, critical: 4 },
      { atk: 22, critical: 5 }, { atk: 25, critical: 5 },
      { atk: 28, critical: 6 }, { atk: 32, critical: 6 },
      { atk: 36, critical: 7 }, { atk: 40, critical: 7 }],
  },
  30: { weaponReq: ["HIDDEN_WEAPON"], cumulative: levels("hit", [2, 3, 4, 4, 5, 6, 6, 7, 8, 8]) },
  51: { weaponReq: ["ROD"], cumulative: levels("def", [20, 25, 30, 35, 40, 45, 50, 60, 70, 80, 90, 100]) },
  53: { cumulative: levels("hp", [30, 50, 70, 90, 120, 150, 180, 220, 260, 300]) },
  180: {
    // Lv5–9 沒寫 HP 值，不推測延伸；Lv10 按原文記錄，但疑似誤貼。
    cumulative: [{}, { hp: 3000 }, { hp: 6000 }, { hp: 9000 }, { hp: 12000 }, {}, {}, {}, {}, {}, { hp: 300 }],
    note: "嫁衣神功 Lv5–9 說明未提供 HP 加成，尚未計入；Lv10 原文為強筋健骨 +300，疑似誤貼，需實測確認。只有 Lv1–4 有學習資料。",
  },
  265: { weaponReq: ["GREAT_SWORD"], cumulative: levels("atk", [24, 27, 30, 33, 37, 41, 45, 50, 55, 60, 65, 70, 75, 80, 85]) },
  601: { cumulative: levels("mp", [200]) },
  602: { cumulative: levels("hp", [300]) },
  750: { weaponReq: WEAPON_TYPE_NAMES, cumulative: levels("atk", [50, 55, 60, 65, 70, 80, 90, 100, 110, 120]) },
  756: { weaponReq: WEAPON_TYPE_NAMES, cumulative: levels("matk", [60, 70, 80, 90, 100, 110, 120, 130, 140, 150]) },
  771: { weaponReq: ["BOXING"], cumulative: levels("atk", [5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 60, 70, 80, 90, 100]) },
  777: {
    weaponReq: WEAPON_TYPE_NAMES.filter((type) => type !== "BOW" && type !== "HIDDEN_WEAPON"),
    weaponReqStats: ["matk"],
    note: "禁術修練真氣加成無條件；內勁：法杖已確認生效，弓與暗器已確認不生效，其餘武器暫列生效但尚未確認，屬估計值。",
    cumulative: [{},
      { matk: 5, mp: 20 }, { matk: 10, mp: 40 }, { matk: 15, mp: 60 },
      { matk: 20, mp: 80 }, { matk: 25, mp: 100 }, { matk: 30, mp: 120 },
      { matk: 35, mp: 140 }, { matk: 40, mp: 160 }, { matk: 45, mp: 180 },
      { matk: 50, mp: 200 }, { matk: 60, mp: 230 }, { matk: 70, mp: 260 },
      { matk: 80, mp: 290 }, { matk: 90, mp: 320 }, { matk: 100, mp: 350 }],
  },
  821: { weaponReq: ["HAMMER"], cumulative: levels("atk", [5, 30, 35, 40, 45, 50, 55, 60, 65, 70, 80, 90, 100, 110, 120]) },
  827: {
    weaponReq: ["HAMMER"],
    cumulative: levels("matk", [0, 30, 35, 40, 45, 50, 55, 60, 65, 70, 80, 90, 100, 110, 120]),
    note: "劍心修煉 Lv1 說明是主動攻擊，沒有面板加成；內勁加成從 Lv2 起。",
  },
};
