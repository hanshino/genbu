import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { DetailBreadcrumb } from "@/components/common/detail-breadcrumb";
import { buttonVariants } from "@/components/ui/button";
import { StaleNotice, StallOwner, scanCaption } from "@/components/market/listing-parts";
import { ShowcaseSwitch } from "@/components/market/showcase-switch";
import { StallListings } from "@/components/market/stall-listings";
import {
  isOwnerHash,
  isShowcasePrice,
  normalizeSearchParams,
  shownListingCount,
  type MarketItemInfo,
  type MarketListing,
  type MarketScan,
  type RawSearchParams,
} from "@/lib/market-listings";
import {
  getLatestScans,
  getMarketItemInfo,
  getStallListings,
  getStoneInfo,
  type StoneInfo,
} from "@/lib/queries/market-listings";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

// owner_hash 攤主重登就換，這頁的網址只在這次掃描有效：不收錄、不進 sitemap。
export const metadata: Metadata = {
  title: "市集攤位 · 玄武",
  robots: { index: false },
};

interface PageProps {
  params: Promise<{ ownerHash: string }>;
  searchParams: Promise<RawSearchParams>;
}

type Data = {
  scan: MarketScan;
  listings: MarketListing[];
  items: Map<number, MarketItemInfo>;
  stones: Map<number, StoneInfo>;
};

/** 只讀該伺服器最新一筆掃描；沒帶或無效的 server 和 /market 一樣退回第一個。 */
function load(server: string | undefined, ownerHash: string): Data | null {
  const scans = getLatestScans();
  if (scans.length === 0) return null;
  const scan = scans.find((s) => s.server === server) ?? scans[0];
  // 展示價一律先拿：只擺展示價的攤位也要認得出來，不能當成「已經不在了」。
  const listings = getStallListings(scan.scanId, ownerHash, true);
  const items = getMarketItemInfo(listings.map((l) => l.itemId));
  const stones = getStoneInfo(listings.flatMap((l) => l.stones));
  return { scan, listings, items, stones };
}

function Shell({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto max-w-6xl space-y-5 px-4 py-8">{children}</div>;
}

function marketHref(scan?: MarketScan, showcase = false): string {
  const tail = showcase ? "&showcase=1" : "";
  return scan ? `/market?view=stalls&server=${scan.server}${tail}` : "/market?view=stalls";
}

export default async function MarketStallPage({ params, searchParams }: PageProps) {
  const { ownerHash } = await params;
  if (!isOwnerHash(ownerHash)) notFound();
  const search = normalizeSearchParams(await searchParams);
  const server = search.server;
  const showcase = search.showcase === "1";

  let data: Data | null;
  try {
    data = load(server, ownerHash);
  } catch (error) {
    console.error("market stall page read failed", error);
    return (
      <Shell>
        <DetailBreadcrumb parent={{ href: marketHref(), label: "市集" }} current="攤位" />
        <p className="text-sm text-muted-foreground">無法讀取市集掛單，請稍後重新整理。</p>
      </Shell>
    );
  }

  if (!data) {
    return (
      <Shell>
        <DetailBreadcrumb parent={{ href: marketHref(), label: "市集" }} current="攤位" />
        <p className="text-sm text-muted-foreground">目前還沒有市集掃描資料。</p>
      </Shell>
    );
  }

  const { scan, listings: all, items, stones } = data;
  const listings = showcase ? all : all.filter((l) => !isShowcasePrice(l.price));
  const count = shownListingCount(listings, items);

  if (shownListingCount(all, items) === 0) {
    return (
      <Shell>
        <DetailBreadcrumb parent={{ href: marketHref(scan), label: "市集" }} current="攤位" />
        <div className="space-y-3">
          <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">這個攤位已經不在了</h1>
          <p className="max-w-prose text-sm text-muted-foreground">
            {scanCaption(scan)}
            的結果裡沒有這個攤位，可能已經收攤，或攤主重新上線後換了攤位網址。
          </p>
          <Link
            href={marketHref(scan)}
            className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
          >
            回市集看所有攤位
          </Link>
        </div>
      </Shell>
    );
  }

  const { sign, name } = all[0];
  const title = sign || "（沒有招牌）";

  return (
    <Shell>
      <DetailBreadcrumb
        parent={{ href: marketHref(scan, showcase), label: "市集" }}
        current={title}
      />
      <header className="space-y-1.5">
        <h1 className="text-2xl font-semibold tracking-tight break-all md:text-3xl">{title}</h1>
        <p className="text-sm">
          {sign == null && name == null ? (
            <span className="text-muted-foreground">沒有攤位資料</span>
          ) : (
            <StallOwner name={name} />
          )}
        </p>
        <p className="text-sm text-muted-foreground">{scanCaption(scan)}</p>
      </header>

      <StaleNotice scan={scan} />

      <section aria-labelledby="stall-listings" className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="stall-listings" className="text-sm text-muted-foreground">
            {count} 筆掛單
          </h2>
          <Suspense fallback={null}>
            <ShowcaseSwitch checked={showcase} />
          </Suspense>
        </div>
        {count === 0 ? (
          <p className="text-sm text-muted-foreground">這一攤只擺了展示價的商品。</p>
        ) : (
          <StallListings listings={listings} items={items} stones={stones} />
        )}
      </section>
    </Shell>
  );
}
