// stages (STAGE.INI + SESTAGE.INI)
//
// 主鍵 (kind, id)。實際上 stage.id ∈ [1, 999] 與 sestage.id ∈ [1001, 5016]
// 完全互斥，因此外部路由可用單一 id 識別一張地圖。

export type StageKind = "stage" | "sestage";

export interface StageRow {
  kind: StageKind;
  id: number;
  name: string | null;
  flag: string | null;
  group: number | null;
  icon: string | null;
  map: string | null;
  map2: string | null;
  smap: string | null;
  music: string | null;
  music2: string | null;
  sound: string | null;
  sound2: string | null;
  light: number | null;
  safe_tag: number | null;
  logout_map: number | null;
  logout_tag: number | null;
  appear_map1: number | null;
  appear_tag1: number | null;
  appear_map2: number | null;
  appear_tag2: number | null;
  cave_tag: number | null;
}

/** 地圖列表頁的精簡 row。 */
export interface StageListItem {
  id: number;
  kind: StageKind;
  name: string;
  groupId: number | null;
  flags: string[];
  /** 多少張地圖把這裡列為 appear/logout 目的地（hub 程度指標）。 */
  inboundCount: number;
}

/** 群組統計（hub 用）。 */
export interface StageGroupStats {
  groupId: number;
  count: number;
  /** 用前幾張地圖名拼出群組預覽（無正式群組名）。 */
  preview: string;
}

/** 反向：哪幾張地圖把這裡當 appear/logout 目的地。 */
export interface InboundLink {
  fromId: number;
  fromName: string;
  /** 哪些欄位指向：'appear_map1' | 'appear_map2' | 'logout_map' */
  via: ("appear_map1" | "appear_map2" | "logout_map")[];
}

/** 任務 → 地圖反查（地圖詳情頁用）。 */
export interface StageMissionRef {
  missionId: number;
  missionName: string | null;
  groupId: number | null;
  /** 該任務在這張地圖出現的次數（mission_refs 行數）。 */
  refCount: number;
}

/** 完整詳情。 */
export interface StageDetail extends StageRow {
  flags: string[];
  groupSiblings: { id: number; name: string }[];
  appearMap1Name: string | null;
  appearMap2Name: string | null;
  logoutMapName: string | null;
  inbound: InboundLink[];
  missions: StageMissionRef[];
}
