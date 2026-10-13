import { Badge } from "@/components/ui/badge";
import { LinkListRow } from "@/components/common/link-list";
import { ShowMoreList } from "@/components/common/capped-list";
import { ItemSubSection } from "@/components/items/item-section-group";
import type { ItemShopSale } from "@/lib/types/shop";
import { castleLabel, shopCurrencyLabel, shopLabel } from "@/lib/constants/shop";

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
              <span className="font-medium">{shopLabel(s)}</span>
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
