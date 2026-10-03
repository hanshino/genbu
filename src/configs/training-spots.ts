// 練功地圖分類的手動規則。自動判斷（城鎮出發走得到 = 野外）見 training-classify.ts；
// 這裡只放自動判斷會錯、或需要人決定的例外。

/** 依名稱排除：命中就不算野外練功地圖，歸到對應分類。依序比對，第一個命中為準。 */
export const TRAINING_NAME_RULES: ReadonlyArray<{
  pattern: RegExp;
  category: "pet" | "story";
}> = [
  { pattern: /寵物練功場|寵物花園/, category: "pet" },
  // 193、311 號「劇情用地圖」有走路傳送接進去，光靠可達性會漏網。
  { pattern: /劇情用地圖|試煉|保留|測試/, category: "story" },
];

/** 走得到但其實是副本：整批依名稱排除。 */
export const TRAINING_EXCLUDED_NAMES: ReadonlySet<string> = new Set([
  "名劍塔",
  "天外天機關陣",
  "峨嵋禁地",
  "木人巷",
  "凌霄閣",
]);

/**
 * 走不到但算野外練功地圖的 stage id。
 * 流星島的月岸、星岸、淺灘要搭船（NPC 對話）才到得了，同系列的日岸走得到，玩家視為同一區練功點。
 */
export const TRAINING_FIELD_STAGE_IDS: ReadonlySet<number> = new Set([
  112, 113, 114, 115, 116, // 雷島 南月岸／南星岸／北日岸／北月岸／北星岸
  118, 119, 120, 121, 122, // 火島 南月岸／南星岸／北日岸／北月岸／北星岸
  147, 148, 149, 150, 151, 152, // 雷／火／冰島 淺灘
]);
