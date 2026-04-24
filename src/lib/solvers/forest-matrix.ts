export const ROOM_NAMES = ["魁", "晶", "阜", "寶", "帝", "彤", "牡", "蒼", "岡"] as const;
export type RoomName = (typeof ROOM_NAMES)[number];

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
    if (!(k.room in COEFFICIENTS)) return { ok: false, reason: "invalid_value" };
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
    if (!Number.isInteger(v) || v < 1 || v > 9) {
      return { ok: false, reason: "no_valid_solution" };
    }
    cells[name] = v;
  }
  return { ok: true, cells };
}
