import { Badge } from "@/components/ui/badge";
import { LinkListRow } from "@/components/common/link-list";
import { ShowMoreList } from "@/components/common/capped-list";
import { ItemSubSection } from "@/components/items/item-section-group";
import type { ItemShopBuy, ItemShopSale } from "@/lib/types/shop";
import { castleLabel, shopCurrencyLabel, shopStoreLabel } from "@/lib/constants/shop";

/** 取得途徑：向商店買。 */
export function ShopSalesSection({ sales }: { sales: ItemShopSale[] }) {
  if (sales.length === 0) return null;
  const sorted = [...sales].sort((a, b) => a.price - b.price || a.shopId - b.shopId);
  const cheapest = sorted[0];
  const cheapestLabel = shopCurrencyLabel(cheapest.currency);

  return (
    <ItemSubSection
      title="商店販售"
      count={`${sales.length} 家`}
      highlight={`最低 ${cheapest.price.toLocaleString("zh-TW")}${cheapestLabel ? ` ${cheapestLabel}` : ""}`}
      note="價格為資料庫記載的售價；兌換店以指定道具計價，需先備妥該貨幣道具。"
    >
      <ShowMoreList limit={5} unit="家">
        {sorted.map((s) => {
          const currencyLabel = shopCurrencyLabel(s.currency);
          return (
            <LinkListRow
              key={s.shopId}
              href={`/shops/${s.shopId}`}
              event="item_source_click"
              eventProps={{ kind: "shop", target_id: s.shopId }}
            >
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
      </ShowMoreList>
    </ItemSubSection>
  );
}

/** 用途／出清：把此道具賣回給商店。不是取得途徑，故與「如何取得」分開。 */
export function ShopBuybackSection({ buys }: { buys: ItemShopBuy[] }) {
  if (buys.length === 0) return null;
  // 收購只記收購率（售價的百分比），沒有實際金額，所以「最高」以收購率表示
  const sorted = [...buys].sort((a, b) => b.rate - a.rate || a.shopId - b.shopId);

  return (
    <ItemSubSection
      title="商店收購"
      count={`${buys.length} 家`}
      highlight={`最高收購率 ${sorted[0].rate}%`}
      note="收購率推定為道具售價的百分比，實際入手金額以遊戲內為準。"
    >
      <ShowMoreList limit={3} unit="家">
        {sorted.map((b) => (
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
      </ShowMoreList>
    </ItemSubSection>
  );
}
