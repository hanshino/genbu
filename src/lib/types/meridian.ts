// 經脈模擬器的資料契約。來源表與欄位意義見 docs/magic-learn-meridian-data.md。

export type MeridianStatFlag = "AFFECT_NUMBER" | "AFFECT_MAX_NUMBER" | "AFFECT_RATIO" | null;

export interface MeridianChannel {
  channelNo: number; // 1 任脈 / 2 督脈 / 3 帶脈 / 4 沖脈
  name: string;
  tabImage: UiImage; // 分頁字（ui_images state='disable'）
  baseImage: UiImage; // 該脈剪影
  baseX: number; // 剪影在 640×480 視窗內的左上角
  baseY: number;
}

export interface MeridianLevel {
  level: number;
  /** 打通花費（丹田）；承漿 Lv1 為 null（由任務取得）。 */
  cost: number | null;
  /** 打通成功率 %（未含天突/膻中加成）。 */
  prob: number;
  /** 本級需要的其他穴位（AND）；已排除自己。 */
  prereqs: { id: number; level: number }[];
  /** 本級的加成增量（逐級累加）。 */
  stats: { stat: string; value: number; flag: MeridianStatFlag }[];
  help: string | null;
}

export interface MeridianPoint {
  id: number; // magic_id
  name: string;
  channelNo: number;
  maxLevel: number;
  isRoot: boolean;
  slot: number;
  /** 640×480 視窗內按鈕座標；圓點中心 = (btnX+5, btnY+5)。 */
  btnX: number;
  btnY: number;
  levels: MeridianLevel[]; // 依 level 升冪，index 0 = Lv1
}

export interface UiImage {
  iconId: number;
  state: string;
  frame: number;
  url: string;
  width: number;
  height: number;
  posX: number;
  posY: number;
  anchorX: number;
  anchorY: number;
}

export interface MeridianData {
  channels: MeridianChannel[]; // 依 channelNo 升冪
  points: MeridianPoint[]; // 依 channelNo、id 升冪
  /** 視窗共用圖：key 例如 "1284:normal:0"（icon:state:frame）。 */
  images: Record<string, UiImage>;
}

/** 某個配置：穴位 id → 已打通等級（0 或不存在 = 未打通）。 */
export type MeridianLevels = Record<number, number>;
