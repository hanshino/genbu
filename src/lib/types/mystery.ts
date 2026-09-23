// 隨機寶箱（MYSTERY）：items.use_case = 10 的道具，use_case2 = mystery_boxes.id。
// 與 item_box_rewards（對話開啟、同組擇一）是不同機制：這裡是依權重隨機抽。
// prob = weight / total_weight，為「單次抽取」機率；mystery_boxes.prob_rand 意義未知，不使用。

import type { EntityImage } from "@/lib/queries/images";

/** v_item_mystery 一列：某個隨機寶箱道具與它的寶箱表。 */
export interface MysteryBoxInfo {
  boxItemId: number;
  boxName: string | null;
  mysteryId: number | null;
  /** false = 客戶端沒有這張表，內容只在伺服器端。 */
  hasData: boolean;
  minDrop: number | null;
  maxDrop: number | null;
  entries: number | null;
}

/** 寶箱表的一個抽取項目（mystery_box_items 一列；同道具不同數量以 seq 區分，不合併）。 */
export interface MysteryEntry {
  seq: number;
  rewardType: "item" | "hero_token";
  refId: number;
  qty: number;
  prob: number;
  /** reward_type = item */
  itemName: string | null;
  itemIcon: EntityImage | null;
  /** reward_type = hero_token：經 hero_codes 對到的英雄；代碼不在 hero_codes 時皆為 null。 */
  heroId: number | null;
  heroName: string | null;
  /** 開出的道具本身也是隨機寶箱時的內容；非寶箱、超過層數或迴圈時為 null。 */
  contents: MysteryBoxContents | null;
}

export interface MysteryBoxContents {
  info: MysteryBoxInfo;
  /** 依 prob 由高到低（同機率依 seq）。has_data = 0 時為空。 */
  entries: MysteryEntry[];
}

/** 反查：某寶箱道具的某個 seq 會開出此道具。 */
export interface MysterySource {
  boxItemId: number;
  boxName: string | null;
  boxIcon: EntityImage | null;
  mysteryId: number;
  seq: number;
  qty: number;
  prob: number;
}
