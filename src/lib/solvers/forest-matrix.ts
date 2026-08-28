export const ROOM_NAMES = ["魁", "晶", "阜", "寶", "帝", "彤", "牡", "蒼", "岡"] as const;
export type RoomName = (typeof ROOM_NAMES)[number];

/**
 * 九宮格的「視覺排列」，對應遊戲中九鼎機關陣的實際方位（上＝北、右＝東）：
 *
 *   魁(西北) │ 寶(北) │ 牡(東北)
 *   ────────┼────────┼────────
 *   晶(西)   │ 帝(中) │ 蒼(東)
 *   ────────┼────────┼────────
 *   阜(西南) │ 彤(南) │ 岡(東南)
 *
 * 渲染九宮格時請 **務必** 走訪 GRID_LAYOUT，而非 ROOM_NAMES。
 * ROOM_NAMES 只是解題迭代用的名稱清單，其陣列順序為求解器內部順序（魁晶阜／寶帝彤／
 * 牡蒼岡），並非房間在遊戲中的方位；直接拿它 row-major 渲染會得到「轉置」後的錯誤盤面。
 *
 * 注意：此排列只影響「顯示位置」。解題數學（COEFFICIENTS / solveForestMatrix）以房間
 * 名稱為鍵，與排列方式無關——魔方陣的轉置仍是擁有相同線集合的魔方陣，因此每個房間的
 * 數值不會因為改變排列而改變。
 */
export const GRID_LAYOUT = [
  "魁", "寶", "牡",
  "晶", "帝", "蒼",
  "阜", "彤", "岡",
] as const satisfies readonly RoomName[];

const COEFFICIENTS: Record<RoomName, readonly [number, number, number]> = {
  魁: [1, 0, 0],
  晶: [-1, -1, 3],
  阜: [0, 1, 0],
  寶: [-1, 1, 1],
  帝: [0, 0, 1],
  彤: [1, -1, 1],
  牡: [0, -1, 2],
  蒼: [1, 1, -1],
  岡: [-1, 0, 2],
};

export type ForestMatrixInput = {
  sum: 12 | 15;
  known: [
    { room: RoomName; value: number },
    { room: RoomName; value: number },
  ];
};

export type ForestMatrixResult =
  | { ok: true; cells: Record<RoomName, number> }
  | {
      ok: false;
      reason:
        | "invalid_sum"
        | "invalid_value"
        | "same_room"
        | "center_known"
        | "redundant_pair"
        | "no_valid_solution";
    };

export function solveForestMatrix(input: ForestMatrixInput): ForestMatrixResult {
  const { sum, known } = input;
  if (sum !== 12 && sum !== 15) return { ok: false, reason: "invalid_sum" };

  for (const k of known) {
    if (!Number.isInteger(k.value) || k.value < 1 || k.value > 9) {
      return { ok: false, reason: "invalid_value" };
    }
  }

  if (known[0].room === known[1].room) return { ok: false, reason: "same_room" };
  if (known[0].room === "帝" || known[1].room === "帝") {
    return { ok: false, reason: "center_known" };
  }

  const c = sum / 3;
  const [α1, β1, γ1] = COEFFICIENTS[known[0].room];
  const [α2, β2, γ2] = COEFFICIENTS[known[1].room];

  const rhs1 = known[0].value - γ1 * c;
  const rhs2 = known[1].value - γ2 * c;
  const D = α1 * β2 - β1 * α2;

  if (D === 0) return { ok: false, reason: "redundant_pair" };

  const a = (rhs1 * β2 - β1 * rhs2) / D;
  const b = (α1 * rhs2 - rhs1 * α2) / D;

  const cells = {} as Record<RoomName, number>;
  for (const name of ROOM_NAMES) {
    const [α, β, γ] = COEFFICIENTS[name];
    const v = α * a + β * b + γ * c;
    // ponytail: 推算格可以是 0（實測 sum=12 晶6 阜5 → 彤=0），只有 NPC 給的
    // 兩間關閉房間限制在 1~9（見上方輸入驗證與 number-pad-popover 的按鍵）。
    if (!Number.isInteger(v) || v < 0 || v > 9) {
      return { ok: false, reason: "no_valid_solution" };
    }
    cells[name] = v;
  }
  return { ok: true, cells };
}
