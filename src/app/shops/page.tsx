import type { Metadata } from "next";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { LinkListRow, LinkListSection } from "@/components/common/link-list";
import { getShops } from "@/lib/queries/shops";
import { SHOP_KIND_LABELS, castleLabel, shopLabel } from "@/lib/constants/shop";
import type { ShopKind, ShopSummary } from "@/lib/types/shop";

export const metadata: Metadata = {
  title: "商店 · 玄武",
  description: "武林同萌傳 NPC 商店販售清單與位置",
  alternates: { canonical: "/shops" },
};

export default function ShopsPage() {
  const shops = getShops().filter((s) => s.sellCount > 0);
  const kinds: ShopKind[] = ["weapon", "item"];

  return (
    <div className="mx-auto max-w-4xl space-y-8 px-4 py-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">NPC 商店</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          店名取自開啟商店的 NPC；位置僅在唯一對應時顯示。
        </p>
      </header>

      {kinds.map((kind) => (
        <ShopSection key={kind} kind={kind} shops={shops.filter((s) => s.kind === kind)} />
      ))}

      <p className="text-xs text-muted-foreground">
        販售資料來自 SHOP.INI，店名來自開店對話；武器店/道具店分類依原始檔案的區段註解。
      </p>
    </div>
  );
}

function ShopSection({ kind, shops }: { kind: ShopKind; shops: ShopSummary[] }) {
  if (shops.length === 0) return null;
  return (
    <LinkListSection title={SHOP_KIND_LABELS[kind]} summary={`${shops.length} 家`}>
      {shops.map((s) => (
        <LinkListRow key={s.id}>
          <Link href={`/shops/${s.id}`} className="font-medium hover:underline">{shopLabel(s)}</Link>
          <span className="font-mono text-xs text-muted-foreground">#{s.id}</span>
          {s.castleId != null && (
            <Badge variant="outline" className="font-normal">
              {castleLabel(s.castleId)}
            </Badge>
          )}
          {s.location && (
            <Link href={`/maps/${s.location.stageId}`} className="text-xs text-muted-foreground hover:underline">
              {s.location.stageName} ({s.location.x}, {s.location.y})
            </Link>
          )}
          <span className="ml-auto font-mono text-xs text-muted-foreground">
            販售 {s.sellCount} 種
          </span>
        </LinkListRow>
      ))}
    </LinkListSection>
  );
}
