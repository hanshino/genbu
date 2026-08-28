import { Badge } from "@/components/ui/badge";
import { LinkListRow } from "@/components/common/link-list";
import { ItemLinkList, ItemSubSection } from "@/components/items/item-section-group";
import type { ItemShopBuy, ItemShopSale } from "@/lib/types/shop";
import { castleLabel, shopCurrencyLabel, shopStoreLabel } from "@/lib/constants/shop";

/** 取得途徑：向商店買。 */
export function ShopSalesSection({ sales }: { sales: ItemShopSale[] }) {
  if (sales.length === 0) return null;

  return (
    <ItemSubSection
      title="商店販售"
      summary={`${sales.length} 家商店有賣`}
      footer="價格為資料庫記載的售價；兌換店以指定道具計價，需先備妥該貨幣道具。"
    >
      <ItemLinkList>
        {sales.map((s) => {
          const currencyLabel = shopCurrencyLabel(s.currency);
          return (
            <LinkListRow key={s.shopId} href={`/shops/${s.shopId}`}>
              <span className="font-medium">{shopStoreLabel(s.kind, s.currency)}</span>
              <span className="font-mono text-xs text-muted-foreground">#{s.shopId}</span>
              {s.castleId != null && (
                <Badge variant="outline" className="font-normal">
                  {castleLabel(s.castleId)}
                </Badge>
              )}
              <span className="ml-auto font-mono text-sm">
                {s.price.toLocaleString("zh-TW")}
                {currencyLabel && (
                  <span className="ml-1 text-xs text-muted-foreground">{currencyLabel}</span>
                )}
              </span>
            </LinkListRow>
          );
        })}
      </ItemLinkList>
    </ItemSubSection>
  );
}

/** 用途／出清：把此道具賣回給商店。不是取得途徑，故與「如何取得」分開。 */
export function ShopBuybackSection({ buys }: { buys: ItemShopBuy[] }) {
  if (buys.length === 0) return null;

  return (
    <ItemSubSection
      title="商店收購"
      summary={`${buys.length} 家商店願意收`}
      footer="收購率推定為道具售價的百分比，實際入手金額以遊戲內為準。"
    >
      <ItemLinkList>
        {buys.map((b) => (
          <LinkListRow key={b.shopId} href={`/shops/${b.shopId}`}>
            <span className="font-medium">{shopStoreLabel(b.kind, b.currency)}</span>
            <span className="font-mono text-xs text-muted-foreground">#{b.shopId}</span>
            {b.castleId != null && (
              <Badge variant="outline" className="font-normal">
                {castleLabel(b.castleId)}
              </Badge>
            )}
            <span className="ml-auto font-mono text-xs text-muted-foreground">{b.rate}%</span>
          </LinkListRow>
        ))}
      </ItemLinkList>
    </ItemSubSection>
  );
}
