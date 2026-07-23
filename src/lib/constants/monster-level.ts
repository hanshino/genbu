// 怪物等級的實際範圍（npc.type > 0，資料實測 1–200）。
// 放在純常數模組，讓 query 層與 client 元件都能引用，避免 client 匯入 DB 模組。
export const MIN_MONSTER_LEVEL = 1;
export const MAX_MONSTER_LEVEL = 200;
