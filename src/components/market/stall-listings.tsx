import Link from "next/link";
import { ArrowRightIcon } from "lucide-react";
import { EquipmentCard, ListingRow } from "@/components/market/listing-parts";
import {
  isIndividualListing,
  mergeStacks,
  shownListingCount,
  type MarketItemInfo,
  type MarketListing,
} from "@/lib/market-listings";
import type { StoneInfo } from "@/lib/queries/market-listings";
import { cn } from "@/lib/utils";

/** /market 依攤位展開時最多畫幾筆（桌機一列四張卡）；其餘到攤位頁看。 */
export const STALL_PREVIEW_LIMIT = 4;

/**
 * 一個攤位的掛單：有個體差異的用裝備卡，一般道具用清單列（同攤同價合併）。
 * 給了 limit 就只畫前 limit 筆（卡片在前、清單列在後，合計），超過時給 moreHref 的連結。
 */
export function StallListings({
  listings,
  items,
  stones,
  limit,
  moreHref,
}: {
  listings: readonly MarketListing[];
  items: Map<number, MarketItemInfo>;
  stones: Map<number, StoneInfo>;
  limit?: number;
  moreHref?: string;
}) {
  const cards: MarketListing[] = [];
  const rows: MarketListing[] = [];
  for (const l of listings) {
    const type = items.get(l.itemId)?.type ?? null;
    (isIndividualListing(l, type) ? cards : rows).push(l);
  }
  // 資料庫找不到的道具不畫。
  const allCards = cards.filter((l) => items.has(l.itemId));
  const allRows = mergeStacks(rows).filter((l) => items.has(l.itemId));
  const cut = limit != null && allCards.length + allRows.length > limit;
  const shownCards = cut ? allCards.slice(0, limit) : allCards;
  const shownRows = cut ? allRows.slice(0, Math.max(0, limit - shownCards.length)) : allRows;

  return (
    <>
      {shownCards.length > 0 && (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,250px),1fr))] gap-3">
          {shownCards.map((l, i) => (
            <EquipmentCard key={i} listing={l} item={items.get(l.itemId)!} stones={stones} />
          ))}
        </div>
      )}
      {shownRows.length > 0 && (
        <ul className={cn(shownCards.length > 0 && "mt-3")}>
          {shownRows.map((l, i) => (
            <ListingRow key={i} listing={l} item={items.get(l.itemId)!} />
          ))}
        </ul>
      )}
      {cut && moreHref && (
        <Link
          href={moreHref}
          className="mt-3 inline-flex items-center gap-1 rounded-sm text-sm font-medium underline-offset-3 hover:underline focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
        >
          看這一攤全部 {shownListingCount(listings, items)} 筆掛單
          <ArrowRightIcon className="size-3.5" aria-hidden />
        </Link>
      )}
    </>
  );
}
