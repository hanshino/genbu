import type { Metadata } from "next";
import { Badge } from "@/components/ui/badge";
import { LinkListRow, LinkListSection } from "@/components/common/link-list";
import { getShops } from "@/lib/queries/shops";
import { SHOP_KIND_LABELS, castleLabel, shopLabel } from "@/lib/constants/shop";
import type { ShopKind, ShopSummary } from "@/lib/types/shop";

export const metadata: Metadata = {
  title: "商店 · 玄武",
  description: "武林同萌傳 NPC 商店販售與收購清單",
};

export default function ShopsPage() {
  const shops = getShops();
  const kinds: ShopKind[] = ["weapon", "item"];

  return (
    <div className="mx-auto max-w-4xl space-y-8 px-4 py-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">NPC 商店</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          共 {shops.length} 家商店;店名由計價貨幣與主要商品自動歸納(SHOP.INI 無店名欄),NPC 對應待考
        </p>
      </header>

      {kinds.map((kind) => (
        <ShopSection key={kind} kind={kind} shops={shops.filter((s) => s.kind === kind)} />
      ))}

      <p className="text-xs text-muted-foreground">
        資料來自 SHOP.INI;武器店/道具店分類依原始檔案的區段註解。
      </p>
    </div>
  );
}

function ShopSection({ kind, shops }: { kind: ShopKind; shops: ShopSummary[] }) {
  if (shops.length === 0) return null;
  return (
    <LinkListSection title={SHOP_KIND_LABELS[kind]} summary={`${shops.length} 家`}>
      {shops.map((s) => (
        <LinkListRow key={s.id} href={`/shops/${s.id}`}>
          <span className="font-medium">{shopLabel(s)}</span>
          <span className="font-mono text-xs text-muted-foreground">#{s.id}</span>
          {s.castleId != null && (
            <Badge variant="outline" className="font-normal">
              {castleLabel(s.castleId)}
            </Badge>
          )}
          <span className="ml-auto font-mono text-xs text-muted-foreground">
            販售 {s.sellCount} 種{s.buyCount > 0 ? ` · 收購 ${s.buyCount} 種` : ""}
          </span>
        </LinkListRow>
      ))}
    </LinkListSection>
  );
}
