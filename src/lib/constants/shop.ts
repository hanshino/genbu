import { ITEM_TYPE_LABELS } from "@/lib/constants/item-types";
import type { ShopCurrency, ShopCurrencyKind, ShopKind } from "@/lib/types/shop";

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

/**
 * 由 shops.style0 判定計價幣別:
 * - style0 = 2   → 金幣(gold)
 * - style0 > 100 → 貨幣道具(item),style0 即該貨幣道具的 item id
 * - 其它          → 無法判定(other),直接顯示 real_price 數字,不標任何幣別
 * style2/style3 恆為 (2,20000) 常數、無意義,忽略。
 */
export function shopCurrencyKind(style0: number | null | undefined): ShopCurrencyKind {
  if (style0 === 2) return "gold";
  if (style0 != null && style0 > 100) return "item";
  return "other";
}

/** 文字情境用的幣別標籤;other/未知回傳 null(價格直接顯示數字即可)。 */
export function shopCurrencyLabel(currency: ShopCurrency): string | null {
  if (currency.kind === "gold") return "金幣";
  if (currency.kind === "item") return currency.itemName ?? "兌換道具";
  return null;
}

/**
 * 商店的「店型」標籤(貨幣＋店種),用來取代生硬的編號:
 * - 金幣店 → 金幣武器店 / 金幣道具店(依 SHOP.INI 武器/道具區段)
 * - 兌換店 → {貨幣道具名}兌換店(例:謎霧之心兌換店)
 * - 其它   → 兌換店(幣別無法判定,不冠貨幣名)
 */
export function shopStoreLabel(kind: ShopKind, currency: ShopCurrency): string {
  if (currency.kind === "gold") {
    return kind === "weapon" ? "金幣武器店" : "金幣道具店";
  }
  if (currency.kind === "item") {
    return `${currency.itemName ?? "兌換道具"}兌換店`;
  }
  return "兌換店";
}

/** 主商品類型的中文標籤(權威對照見 item-types.ts);無資料回傳 null。 */
export function shopProductLabel(mainType: string | null): string | null {
  if (!mainType) return null;
  return ITEM_TYPE_LABELS[mainType] ?? mainType;
}

/**
 * 完整的商店辨識標籤 =「店型 · 主商品」,例如:
 *   金幣武器店 · 衣 / 謎霧之心兌換店 · 飾品 / 兌換店 · 座騎
 */
export function shopLabel(shop: {
  kind: ShopKind;
  currency: ShopCurrency;
  mainType: string | null;
}): string {
  const store = shopStoreLabel(shop.kind, shop.currency);
  const product = shopProductLabel(shop.mainType);
  return product ? `${store} · ${product}` : store;
}
