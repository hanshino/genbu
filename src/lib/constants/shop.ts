import type { ShopKind } from "@/lib/types/shop";

/**
 * SHOP.INI 僅有的兩行區段註解:「// 武器店」與「// 道具店」。
 * 武器店區段的商店 id 如下(依 INI 出現順序),其餘 77 家為道具店。
 */
export const WEAPON_SHOP_IDS = new Set([9, 1, 2, 6, 3, 4, 5, 11, 41, 43, 48, 50]);

export function shopKindOf(id: number): ShopKind {
  return WEAPON_SHOP_IDS.has(id) ? "weapon" : "item";
}

export const SHOP_KIND_LABELS: Record<ShopKind, string> = {
  weapon: "武器店",
  item: "道具店",
};

/** castle_id → 城池名。正名待考證(使用者後續提供),先以編號呈現。 */
export const CASTLE_NAMES: Record<number, string> = {
  1: "城池 #1",
  2: "城池 #2",
  3: "城池 #3",
  4: "城池 #4",
};

export function castleLabel(castleId: number): string {
  return CASTLE_NAMES[castleId] ?? `城池 #${castleId}`;
}

/** 商店暫無名稱資料(SHOP.INI 無 name 欄),統一以編號呈現。 */
export function shopTitle(id: number): string {
  return `商店 #${id}`;
}
