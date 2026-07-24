import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { CoinsIcon } from "lucide-react";
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
import { ItemIcon } from "@/components/common/item-icon";
import { getItemIconMap } from "@/lib/queries/images";
import { getShopDetail } from "@/lib/queries/shops";
import {
  castleLabel,
  shopCurrencyLabel,
  shopLabel,
  shopTitle,
} from "@/lib/constants/shop";

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
    title: `${shopLabel(shop)} · 商店 · 玄武`,
    description: `${shopLabel(shop)}(${shopTitle(shop.id)})的販售與收購清單`,
  };
}

export default async function ShopDetailPage({ params }: PageProps) {
  const { id } = await params;
  const shopId = Number(id);
  if (!Number.isInteger(shopId) || shopId <= 0) notFound();

  const shop = getShopDetail(shopId);
  if (!shop) notFound();

  const iconMap = getItemIconMap([
    ...shop.sells.map((e) => e.itemId),
    ...shop.buys.map((e) => e.itemId),
    ...(shop.currency.itemId != null ? [shop.currency.itemId] : []),
  ]);

  // 計價幣別的視覺標記(隨售價顯示):金幣圖示、貨幣道具圖示,或(other)不標。
  const currencyIcon =
    shop.currency.kind === "gold" ? (
      <CoinsIcon className="size-4 shrink-0 text-muted-foreground" aria-label="金幣" />
    ) : shop.currency.kind === "item" && shop.currency.itemId != null ? (
      <ItemIcon
        image={iconMap.get(shop.currency.itemId) ?? null}
        alt={shop.currency.itemName ?? ""}
        className="size-4 shrink-0"
      />
    ) : null;

  return (
    <div className="mx-auto max-w-4xl space-y-8 px-4 py-8">
      <nav className="text-sm text-muted-foreground">
        <BackLink href="/shops">返回商店列表</BackLink>
      </nav>

      <header className="flex flex-wrap items-baseline gap-2">
        <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
          {shopLabel(shop)}
        </h1>
        <span className="font-mono text-sm text-muted-foreground">#{shop.id}</span>
        {shop.castleId != null && (
          <Badge variant="outline" className="font-normal">
            {castleLabel(shop.castleId)}
          </Badge>
        )}
        {shop.currency.kind !== "other" && (
          <Badge variant="outline" className="gap-1 font-normal">
            {currencyIcon}
            <span className="text-muted-foreground">貨幣</span>
            {shopCurrencyLabel(shop.currency)}
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
                    <div className="flex items-center gap-2">
                      <ItemIcon
                        image={iconMap.get(e.itemId) ?? null}
                        alt={e.itemName ?? String(e.itemId)}
                        className="size-6"
                      />
                      <Link
                        href={`/items/${e.itemId}`}
                        className="font-medium underline decoration-dotted underline-offset-2 hover:decoration-solid"
                      >
                        {e.itemName ?? `#${e.itemId}`}
                      </Link>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {e.itemType ?? "—"}
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm">
                    <span className="inline-flex items-center justify-end gap-1.5">
                      {currencyIcon}
                      {e.price.toLocaleString("zh-TW")}
                    </span>
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
                      <div className="flex items-center gap-2">
                        <ItemIcon
                          image={iconMap.get(e.itemId) ?? null}
                          alt={e.itemName ?? String(e.itemId)}
                          className="size-6"
                        />
                        <Link
                          href={`/items/${e.itemId}`}
                          className="font-medium underline decoration-dotted underline-offset-2 hover:decoration-solid"
                        >
                          {e.itemName ?? `#${e.itemId}`}
                        </Link>
                      </div>
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
