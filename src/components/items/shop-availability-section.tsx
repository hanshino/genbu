import { Badge } from "@/components/ui/badge";
import { LinkListRow, LinkListSection } from "@/components/common/link-list";
import { getShopsBuyingItem, getShopsSellingItem } from "@/lib/queries/shops";
import { castleLabel, shopCurrencyLabel, shopStoreLabel } from "@/lib/constants/shop";

export function ShopAvailabilitySection({ itemId }: { itemId: number }) {
  const sales = getShopsSellingItem(itemId);
  const buys = getShopsBuyingItem(itemId);
  if (sales.length === 0 && buys.length === 0) return null;

  const buySummary =
    buys.length > 0
      ? `另有 ${buys.length} 家商店收購(${[...new Set(buys.map((b) => b.rate))]
          .sort((a, b) => b - a)
          .map((r) => `${r}%`)
          .join("、")})`
      : null;

  if (sales.length === 0) {
    return (
      <LinkListSection title="商店收購" footer="收購率推定為道具售價的百分比。">
        {buys.map((b) => (
          <LinkListRow key={b.shopId} href={`/shops/${b.shopId}`}>
            <span className="font-medium">{shopStoreLabel(b.kind, b.currency)}</span>
            <span className="font-mono text-xs text-muted-foreground">#{b.shopId}</span>
            <span className="ml-auto font-mono text-xs text-muted-foreground">{b.rate}%</span>
          </LinkListRow>
        ))}
      </LinkListSection>
    );
  }

  return (
    <LinkListSection
      title="商店販售"
      summary={`${sales.length} 家商店販售`}
      footer={buySummary}
    >
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
    </LinkListSection>
  );
}
