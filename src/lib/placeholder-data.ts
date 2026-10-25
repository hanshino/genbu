// 遊戲資料裡混著大量玩家碰不到的佔位資料（測試怪、保留地圖、活動／劇情用空殼）。
// 列表瀏覽時預設隱藏，搜尋時照常找得到。純資料、不 import DB，client / server 都能用。

// 地圖只能靠名稱判斷：這些地圖多半仍有傳點或 NPC 擺放，看結構分不出來。
const PLACEHOLDER_STAGE_NAME =
  /TEST|測試|測專用|保留|預留|不可用|背景$|^(活動用地圖|劇情用地圖|劇情|對戰報名)$|^\d+$/i;

export function isPlaceholderStageName(name: string): boolean {
  return PLACEHOLDER_STAGE_NAME.test(name.trim());
}

/**
 * 佔位怪物（SQL 條件，n = npc、m = monsters）：
 * 沒有任何出沒地點也沒有掉落，或名稱就是測試／預留用。
 */
export const PLACEHOLDER_MONSTER_SQL = `(
  (NOT EXISTS (SELECT 1 FROM monster_spawns ms WHERE ms.npc_id = n.id)
   AND (m.drop_item IS NULL OR m.drop_item IN ('[]', 'null')))
  OR n.name LIKE '%測試%' OR n.name LIKE '測%' OR n.name LIKE '%預留%'
  OR n.name LIKE '%保留%' OR n.name LIKE '活動用%'
)`;
