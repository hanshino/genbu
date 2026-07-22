import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { BackLink } from "@/components/common/back-link";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getShopDetail } from "@/lib/queries/shops";
import { SHOP_KIND_LABELS, castleLabel, shopTitle } from "@/lib/constants/shop";

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const shopId = Number(id);
  if (!Number.isInteger(shopId) || shopId <= 0) return { title: "商店 · 玄武" };
  const shop = getShopDetail(shopId);
  if (!shop) return { title: "商店不存在 · 玄武" };
  return {
    title: `${shopTitle(shop.id)} · 商店 · 玄武`,
    description: `${shopTitle(shop.id)}(${SHOP_KIND_LABELS[shop.kind]})的販售與收購清單`,
  };
}

export default async function ShopDetailPage({ params }: PageProps) {
  const { id } = await params;
  const shopId = Number(id);
  if (!Number.isInteger(shopId) || shopId <= 0) notFound();

  const shop = getShopDetail(shopId);
  if (!shop) notFound();

  return (
    <div className="mx-auto max-w-4xl space-y-8 px-4 py-8">
      <nav className="text-sm text-muted-foreground">
        <BackLink href="/shops">返回商店列表</BackLink>
      </nav>

      <header className="flex flex-wrap items-baseline gap-2">
        <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
          {shopTitle(shop.id)}
        </h1>
        <Badge variant="secondary" className="font-normal">
          {SHOP_KIND_LABELS[shop.kind]}
        </Badge>
        {shop.castleId != null && (
          <Badge variant="outline" className="font-normal">
            {castleLabel(shop.castleId)}
          </Badge>
        )}
      </header>

      <section className="space-y-2">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-lg font-medium">販售</h2>
          <span className="text-xs text-muted-foreground">{shop.sells.length} 種</span>
        </div>
        <div className="overflow-x-auto rounded-lg border border-border/60">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>道具</TableHead>
                <TableHead>類型</TableHead>
                <TableHead className="text-right">單價</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {shop.sells.map((e) => (
                <TableRow key={e.itemId}>
                  <TableCell>
                    <Link
                      href={`/items/${e.itemId}`}
                      className="font-medium underline decoration-dotted underline-offset-2 hover:decoration-solid"
                    >
                      {e.itemName ?? `#${e.itemId}`}
                    </Link>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {e.itemType ?? "—"}
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm">
                    {e.price.toLocaleString("zh-TW")}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </section>

      {shop.buys.length > 0 && (
        <section className="space-y-2">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-lg font-medium">收購</h2>
            <span className="text-xs text-muted-foreground">{shop.buys.length} 種</span>
          </div>
          <div className="overflow-x-auto rounded-lg border border-border/60">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>道具</TableHead>
                  <TableHead className="text-right">收購率</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {shop.buys.map((e) => (
                  <TableRow key={e.itemId}>
                    <TableCell>
                      <Link
                        href={`/items/${e.itemId}`}
                        className="font-medium underline decoration-dotted underline-offset-2 hover:decoration-solid"
                      >
                        {e.itemName ?? `#${e.itemId}`}
                      </Link>
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">{e.rate}%</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </section>
      )}

      <p className="text-xs text-muted-foreground">
        資料來自 SHOP.INI。商店暫無名稱與 NPC / 地圖對應。收購率推定為道具售價的百分比,
        實際收購價以遊戲內為準。
      </p>
    </div>
  );
}
