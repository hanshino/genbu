import Link from "next/link";
import { ListingsCollapsible } from "@/components/market/listings-collapsible";
import { ServerPanels } from "@/components/market/server-switch";
import {
  EquipmentCard,
  ListingRow,
  Price,
  PriceScaleBar,
  StaleNotice,
  scanCaption,
  stallHref,
} from "@/components/market/listing-parts";
import {
  isIndividualListing,
  mergeStacks,
  pickDefaultServer,
  type MarketItemInfo,
  type MarketListing,
  type MarketScan,
} from "@/lib/market-listings";
import {
  getItemListings,
  getMarketItemInfo,
  getStoneInfo,
  type StoneInfo,
} from "@/lib/queries/market-listings";

/** 和頁面其他段落一致：標題加上分隔線，不自己包框，只有裡面的裝備卡有框。 */
const SECTION = "space-y-3 border-t border-border/60 pt-5";

function Header({ scan, children }: { scan: MarketScan; children?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
      <div className="min-w-0">
        <h2 id="market-listings" className="text-lg font-medium">
          市集掛單
        </h2>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {scanCaption(scan)}
          {children}
        </p>
      </div>
      <Link
        href={`/market?server=${scan.server}`}
        className="rounded-sm text-[13px] text-muted-foreground underline underline-offset-3 hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
      >
        看整個市集
      </Link>
    </div>
  );
}

function countText(listings: MarketListing[]): string {
  const stalls = new Set(listings.map((l) => l.ownerHash)).size;
  const pieces = listings.reduce((sum, l) => sum + l.count, 0);
  return `${stalls} 攤 ${pieces.toLocaleString("zh-TW")} 件`;
}

function ServerBody({
  scan,
  listings,
  item,
  stones,
}: {
  scan: MarketScan;
  listings: MarketListing[];
  item: MarketItemInfo;
  stones: Map<number, StoneInfo>;
}) {
  if (listings.length === 0) {
    return (
      <div className="space-y-2">
        <Header scan={scan}>，目前沒有人在賣「{item.name}」</Header>
        <StaleNotice scan={scan} />
      </div>
    );
  }

  const cards = listings.some((l) => isIndividualListing(l, item.type));
  // 清單模式畫的是合併後的列，展開按鈕的筆數要跟看到的列數一致；卡片模式一筆掛單一張卡。
  const rows = cards ? listings : mergeStacks(listings);

  return (
    <div className="space-y-3">
      <Header scan={scan} />
      <StaleNotice scan={scan} />
      {cards ? (
        <div>
          <div className="mb-1.5 flex items-baseline justify-between gap-3 text-xs text-muted-foreground">
            <span>掛單價</span>
            <span className="font-mono">{countText(listings)}</span>
          </div>
          <PriceScaleBar prices={listings.map((l) => l.price)} />
        </div>
      ) : (
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 rounded-lg bg-muted px-4 py-3">
          <span className="text-xs text-muted-foreground">目前最低</span>
          <Price silver={listings[0].price} className="text-2xl leading-tight" />
          <span className="ml-auto font-mono text-xs text-muted-foreground">
            {countText(listings)}
          </span>
        </div>
      )}
      <ListingsCollapsible count={rows.length}>
        {cards ? (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,250px),1fr))] gap-3">
            {listings.map((l, i) => (
              <EquipmentCard
                key={i}
                listing={l}
                item={item}
                stones={stones}
                stall={{ href: l.sign ? stallHref(scan, l.ownerHash) : undefined }}
              />
            ))}
          </div>
        ) : (
          <ul>
            {rows.map((l, i) => (
              <ListingRow key={i} listing={l} stallHref={stallHref(scan, l.ownerHash)} />
            ))}
          </ul>
        )}
      </ListingsCollapsible>
    </div>
  );
}

/**
 * 道具頁的「市集掛單」：tthol-headless 最新一次掃描裡，誰在賣這件、開多少。
 * 掛單價是賣家開的價，和下面「玩家回報市價」（成交價）分開放。
 */
export async function ItemMarketListings({ itemId }: { itemId: number }) {
  let data: ReturnType<typeof getItemListings>;
  let item: MarketItemInfo | undefined;
  let stones: Map<number, StoneInfo>;
  try {
    data = getItemListings(itemId);
    if (data.length === 0) return null; // 沒有任何伺服器有掃描資料：整塊不出現
    item = getMarketItemInfo([itemId]).get(itemId);
    stones = getStoneInfo(data.flatMap((d) => d.listings.flatMap((l) => l.stones)));
  } catch (error) {
    console.error("market listings read failed", error);
    return (
      <section aria-labelledby="market-listings" className={SECTION}>
        <h2 id="market-listings" className="text-lg font-medium">
          市集掛單
        </h2>
        <p className="text-xs text-muted-foreground">無法讀取市集掛單，請稍後重新整理。</p>
      </section>
    );
  }
  if (!item) return null;

  const panels = Object.fromEntries(
    data.map((d) => [
      d.scan.server,
      <ServerBody
        key={d.scan.server}
        scan={d.scan}
        listings={d.listings}
        item={item}
        stones={stones}
      />,
    ]),
  );

  return (
    <section aria-labelledby="market-listings" className={SECTION}>
      {data.length > 1 ? (
        <ServerPanels
          servers={data.map((d) => d.scan.server)}
          panels={panels}
          initial={pickDefaultServer(
            data.map((d) => ({ server: d.scan.server, listings: d.listings })),
          )}
        />
      ) : (
        panels[data[0].scan.server]
      )}
    </section>
  );
}
