import type { TableProfile } from "./types";

// 內部/遷移表一律排除；sqlite_* 由引擎額外過濾。
export const EXCLUDE = new Set(["knex_migrations", "knex_migrations_lock"]);

export const PROFILES: Record<string, TableProfile> = {
  items: {
    tier: "rich",
    label: "道具",
    identity: ["id"],
    displayName: "name",
    fields: {
      name: "名稱",
      summary: "說明",
      value: "售價",
      atk: "攻擊",
      matk: "法攻",
      extra_def: "防禦",
      magic_def: "法防",
      hp: "HP",
      mp: "MP",
      hit: "命中",
      dodge: "迴避",
      str: "力",
      pow: "氣",
      vit: "體",
      dex: "技",
      agi: "敏",
      wis: "智",
      damage_min: "傷害下限",
      damage_max: "傷害上限",
      base_lv: "需求等級",
      type_name: "類型",
    },
    detailRoute: (idParts) => `/items/${idParts[0]}`,
  },
  magic: {
    tier: "rich",
    label: "技能",
    identity: ["id", "level"],
    displayName: "name",
    fields: { name: "名稱", help: "說明", spend_mp: "耗魔", target: "目標", clan: "門派" },
    detailRoute: (idParts) => `/skills/${idParts[0]}`, // idParts = [id, level]
  },
  monsters: {
    tier: "rich",
    label: "怪物",
    identity: ["id"],
    displayName: "name",
    fields: {
      name: "名稱",
      level: "等級",
      hp: "HP",
      extra_def: "防禦",
      damage_min: "傷害下限",
      damage_max: "傷害上限",
      drop_exp: "經驗",
    },
    detailRoute: (idParts) => `/monsters/${idParts[0]}`,
  },
  item_rand: {
    tier: "rich",
    label: "裝備隨機屬性",
    identity: ["id", "attribute"], // 一件裝備多列（每屬性一列）
    displayName: "attribute",
    fields: { min: "最小值", max: "最大值", rate: "機率" },
    detailRoute: (idParts) => `/items/${idParts[0]}`, // idParts = [id, attribute]
  },
  missions: {
    tier: "rich",
    label: "任務",
    identity: ["id"],
    displayName: "name",
    fields: { name: "名稱", help: "說明" },
    detailRoute: (idParts) => `/missions/${idParts[0]}`,
  },
  mission_steps: {
    tier: "rich",
    label: "任務步驟",
    identity: ["mission_id", "step_index"],
    fields: { plain_text: "步驟文字" },
  },
  npc: {
    tier: "rich",
    label: "NPC",
    identity: ["id"],
    displayName: "name",
    fields: { name: "名稱", level: "等級" },
  },
  npc_strings: {
    tier: "rich",
    label: "NPC 對話",
    identity: ["id"],
    displayName: "name",
    fields: { name: "顯示名" },
  },
  message_options: {
    tier: "rich",
    label: "對話選項",
    identity: ["file_no", "msg_id", "opt_index"],
    displayName: "text",
    fields: { text: "選項文字" },
  },
  achievements: {
    tier: "rich",
    label: "成就",
    identity: ["id"],
    displayName: "name",
    fields: {
      name: "名稱",
      description: "描述",
      points: "點數",
      reward_amount: "獎勵數量",
      prereq_achievement_id: "前置成就",
    },
    detailRoute: () => "/achievements",
  },
  shop_sells: {
    tier: "rich",
    label: "商店販售",
    identity: ["shop_id", "item_id"],
    fields: { price: "價格" },
    detailRoute: (idParts) => `/shops/${idParts[0]}`,
  },

  // 計數層（只顯示 +N ~N −N）
  messages: { tier: "count", label: "對話訊息", identity: ["file_no", "msg_id"] },
  mission_refs: { tier: "count", label: "任務關聯", identity: ["id"] },
  map_warps: { tier: "count", label: "地圖傳送點", identity: ["id"] },
  shops: { tier: "count", label: "商店", identity: ["id"] },
  shop_buys: { tier: "count", label: "商店收購", identity: ["shop_id", "item_id"] },
  achievement_categories: { tier: "count", label: "成就分類", identity: ["id"] },
  achievement_sub_cats: { tier: "count", label: "成就子分類", identity: ["id"] },
};
