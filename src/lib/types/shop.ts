export type ShopKind = "weapon" | "item";

export interface ShopSummary {
  id: number;
  kind: ShopKind;
  castleId: number | null;
  sellCount: number;
  buyCount: number;
}

export interface ShopSellEntry {
  itemId: number;
  itemName: string | null;
  itemType: string | null;
  price: number;
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
  sells: ShopSellEntry[];
  buys: ShopBuyEntry[];
}

/** 道具頁「商店販售」列 */
export interface ItemShopSale {
  shopId: number;
  kind: ShopKind;
  castleId: number | null;
  price: number;
}

/** 道具頁「商店收購」列 */
export interface ItemShopBuy {
  shopId: number;
  kind: ShopKind;
  castleId: number | null;
  rate: number;
}
