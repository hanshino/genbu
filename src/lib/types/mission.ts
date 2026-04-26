// missions / mission_steps / mission_refs (MISSION.INI)
//
// 任務由「總述 (help) + 1..16 個步驟」組成。每個步驟內嵌 `<map=...>` 與
// `<item,...>` 標籤；mission_refs 把這些標籤展開為結構化的 NPC/地圖/物品
// 引用（step_index=0 = 總述提及；1..N = StepN 提及）。

export type MissionRefType = "map" | "item";

export interface MissionRow {
  id: number;
  name: string | null;
  group_id: number | null;
  cycle_time: number | null;
  hid_mission_group: number | null;
  help: string | null;
}

export interface MissionStepRow {
  mission_id: number;
  step_index: number;
  raw_text: string;
  plain_text: string;
}

export interface MissionRefRow {
  id: number;
  mission_id: number;
  step_index: number;
  ref_type: MissionRefType;
  map_id: number | null;
  x: number | null;
  y: number | null;
  npc_id: number | null;
  item_id: number | null;
  qty: number | null;
  label: string | null;
}

/** 一筆物品引用（已附 items.name）。 */
export interface MissionItemRef {
  itemId: number;
  qty: number | null;
  name: string;
}

/** 一筆地圖／NPC 引用。npcId=0 代表「不是具體 NPC，只是地標／怪物名」。 */
export interface MissionMapRef {
  mapId: number;
  x: number | null;
  y: number | null;
  npcId: number;
  /** 只在 npcId > 0 時嘗試查表；查不到時為 null。 */
  npcName: string | null;
  /** 標籤（NPC 名 / 地標名 / 怪物名）。 */
  label: string | null;
}

/** 一個任務步驟（含已解析的引用清單）。 */
export interface MissionStep {
  index: number;
  rawText: string;
  plainText: string;
  items: MissionItemRef[];
  maps: MissionMapRef[];
}

/** 任務詳情。 */
export interface MissionDetail {
  id: number;
  name: string | null;
  groupId: number | null;
  cycleTime: number | null;
  hidMissionGroup: number | null;
  help: string | null;
  helpItems: MissionItemRef[];
  helpMaps: MissionMapRef[];
  steps: MissionStep[];
  /** 跨 help + 全部步驟去重後的物品清單（qty 取各處出現的最大值）。 */
  allItems: MissionItemRef[];
  /** 跨 help + 全部步驟去重後的地點 / NPC 清單。 */
  allMaps: MissionMapRef[];
}

/** 列表頁用的精簡 row。 */
export interface MissionListItem {
  id: number;
  name: string | null;
  groupId: number | null;
  cycleTime: number | null;
  stepCount: number;
}

/** 群組統計（hub 用）。 */
export interface MissionGroupStats {
  /** null = 未分類群組（MISSION.INI 缺 GROUP 的任務）。 */
  groupId: number | null;
  count: number;
  /** 其中 cycle_time != null 的數量。 */
  cycleCount: number;
}

/** 「需要此物品的任務」反查結果（給 item detail 頁用）。 */
export interface MissionUseOfItem {
  missionId: number;
  missionName: string | null;
  groupId: number | null;
  cycleTime: number | null;
  /** 同一任務中此物品出現多次時取最大 qty。null = 沒寫數量。 */
  qty: number | null;
}
