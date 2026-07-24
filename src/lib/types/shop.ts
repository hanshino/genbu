export type ShopKind = "weapon" | "item";

/**
 * 商店計價幣別,由 shops.style0 判定(見 lib/constants/shop.ts):
 * - gold  :金幣(style0 = 2)
 * - item  :以貨幣道具計價(style0 > 100,style0 即貨幣道具 item id)
 * - other :幣別無法從資料判定(style0 ∈ {0,4,6,8,10}…),直接顯示數字
 */
export type ShopCurrencyKind = "gold" | "item" | "other";

export interface ShopCurrency {
  kind: ShopCurrencyKind;
  /** kind === "item" 時的貨幣道具 id(= shops.style0),用來取名稱/圖示 */
  itemId: number | null;
  /** kind === "item" 時的貨幣道具名稱 */
  itemName: string | null;
}

export interface ShopSummary {
  id: number;
  kind: ShopKind;
  castleId: number | null;
  /** 全店計價幣別(貨幣＋辨識用) */
  currency: ShopCurrency;
  /** 販售清單中最大宗的 items.type_name(英文列舉),無販售則 null */
  mainType: string | null;
  sellCount: number;
  buyCount: number;
}

export interface ShopSellEntry {
  itemId: number;
  itemName: string | null;
  itemType: string | null;
  /** 對玩家顯示的售價(= shop_sells.real_price,已在資料載入時算好) */
  price: number;
  /** 內部用:shop_sells.price,實為基礎價值的百分比 rate,不對玩家顯示 */
  rate: number;
}

export interface ShopBuyEntry {
  itemId: number;
  itemName: string | null;
  rate: number;
}

export interface ShopDetail {
  id: number;
  kind: ShopKind;
  castleId: number | null;
  /** 全店共用的計價幣別 */
  currency: ShopCurrency;
  /** 販售清單中最大宗的 items.type_name(英文列舉),無販售則 null */
  mainType: string | null;
  sells: ShopSellEntry[];
  buys: ShopBuyEntry[];
}

/** 道具頁「商店販售」列 */
export interface ItemShopSale {
  shopId: number;
  kind: ShopKind;
  castleId: number | null;
  /** 對玩家顯示的售價(= shop_sells.real_price) */
  price: number;
  /** 內部用:shop_sells.price(百分比 rate),不對玩家顯示 */
  rate: number;
  /** 該商店的計價幣別 */
  currency: ShopCurrency;
}

/** 道具頁「商店收購」列 */
export interface ItemShopBuy {
  shopId: number;
  kind: ShopKind;
  castleId: number | null;
  rate: number;
  /** 該商店的計價幣別 */
  currency: ShopCurrency;
}
