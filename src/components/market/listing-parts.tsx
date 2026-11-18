import Link from "next/link";
import { ClockIcon, StoreIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ItemIcon } from "@/components/common/item-icon";
import { CopyNameButton } from "@/components/market/copy-name-button";
import { ITEM_TYPE_LABELS } from "@/lib/constants/item-types";
import { SERVERS, formatSilver, relativeTime } from "@/lib/market-price";
import {
  isStale,
  listingStateText,
  priceScale,
  type MarketItemInfo,
  type MarketListing,
  type MarketScan,
} from "@/lib/market-listings";
import type { StoneInfo } from "@/lib/queries/market-listings";
import { cn } from "@/lib/utils";

export function scanCaption(scan: MarketScan, now?: number): string {
  const server = SERVERS.find((s) => s.id === scan.server)?.name ?? scan.server;
  return `${server}，${relativeTime(scan.started, now)}掃描`;
}

/** 攤位頁。owner_hash 攤主重登就換，這個網址只在這次掃描有效。 */
export function stallHref(scan: MarketScan, ownerHash: string): string {
  return `/market/stalls/${ownerHash}?server=${scan.server}`;
}

export function Price({ silver, className }: { silver: number; className?: string }) {
  const money = formatSilver(silver);
  return (
    <span className={cn("font-heading font-semibold tabular-nums", className)}>
      {money.value}
      <span className="ml-1 font-sans text-xs font-normal text-muted-foreground">{money.unit}</span>
    </span>
  );
}

export function StallOwner({ name }: { name: string | null }) {
  if (name == null) {
    return <span className="text-muted-foreground">攤主名稱未取得，請認招牌</span>;
  }
  return (
    <span className="inline-flex min-w-0 flex-wrap items-center gap-1.5 text-muted-foreground">
      攤主
      <span className="break-all text-foreground">{name}</span>
      <CopyNameButton name={name} />
    </span>
  );
}

/** 招牌＋攤主。招牌是玩家自己寫的字，空字串就不顯示那一塊。 */
export function StallLine({
  listing,
  href,
  className,
}: {
  listing: Pick<MarketListing, "sign" | "name">;
  href?: string;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[13px]", className)}>
      {listing.sign ? (
        <span className="inline-flex min-w-0 items-center gap-1.5">
          <StoreIcon className="size-3.5 shrink-0" aria-hidden />
          {href ? (
            <Link
              href={href}
              className="rounded-sm font-medium break-all hover:underline focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
            >
              {listing.sign}
            </Link>
          ) : (
            <span className="font-medium break-all">{listing.sign}</span>
          )}
        </span>
      ) : null}
      {!listing.sign && listing.name == null ? (
        <span className="text-muted-foreground">沒有攤位資料</span>
      ) : (
        <StallOwner name={listing.name} />
      )}
    </div>
  );
}

export function StaleNotice({ scan, now }: { scan: MarketScan; now?: number }) {
  if (!isStale(scan.started, now)) return null;
  return (
    <p
      role="status"
      className="flex items-start gap-2 rounded-lg border border-dashed border-border bg-muted px-3 py-2 text-xs text-muted-foreground"
    >
      <ClockIcon className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" aria-hidden />
      這是 {relativeTime(scan.started, now)}的掛單，可能已經賣掉或改價。
    </p>
  );
}

function moneyText(silver: number): string {
  const m = formatSilver(silver);
  return `${m.value} ${m.unit}`;
}

/** 掛單價刻度條：左最低、右最高，每筆一個刻度，同價往右並排。全部同價時只給一個價格。 */
export function PriceScaleBar({ prices }: { prices: readonly number[] }) {
  const scale = priceScale(prices);
  if (!scale) return null;
  if (scale.kind === "single") {
    return (
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 rounded-lg bg-muted px-4 py-3">
        <span className="text-xs text-muted-foreground">
          {scale.count > 1 ? `${scale.count} 筆同價` : "掛單價"}
        </span>
        <Price silver={scale.price} className="text-2xl" />
      </div>
    );
  }
  return (
    <div
      role="img"
      aria-label={`掛單價從 ${moneyText(scale.min)} 到 ${moneyText(scale.max)}，共 ${prices.length} 筆，每一條線是一筆掛單`}
      className="flex items-center gap-3.5"
    >
      <div className="shrink-0">
        <Price silver={scale.min} className="block text-xl leading-tight sm:text-2xl" />
        <div className="text-xs text-muted-foreground">最低</div>
      </div>
      <div className="relative h-7 min-w-16 flex-1">
        <span className="absolute inset-x-0 top-1/2 border-t border-border" />
        {scale.ticks.map((tick, i) => {
          // 靠右半邊的刻度往左疊，免得擠出線外。
          const dir = tick.percent > 50 ? -1 : 1;
          return (
            <span
              key={i}
              className="absolute top-1/2 -mt-[9px] h-[18px] w-[3px] rounded-[1px] bg-foreground"
              style={{
                left: `calc(${tick.percent}% - ${(tick.percent / 100) * 3}px + ${dir * tick.stack * 5}px)`,
              }}
            />
          );
        })}
      </div>
      <div className="shrink-0 text-right">
        <Price silver={scale.max} className="block text-xl leading-tight sm:text-2xl" />
        <div className="text-xs text-muted-foreground">最高</div>
      </div>
    </div>
  );
}

function signed(value: number): string {
  return value < 0 ? String(value) : `+${value}`;
}

export function typeLevelText(item: MarketItemInfo): string {
  const type = item.type ? (ITEM_TYPE_LABELS[item.type] ?? item.type) : null;
  return [type, item.level > 0 ? `等級 ${item.level}` : null].filter(Boolean).join("，");
}

/** 一件有個體差異的掛單：素質、強化、鑲嵌都攤開看。 */
export function EquipmentCard({
  listing,
  item,
  stones,
  stall,
}: {
  listing: MarketListing;
  item: MarketItemInfo;
  stones: Map<number, StoneInfo>;
  /** 給了才顯示招牌與攤主（依攤位檢視裡已經在攤位標題上，不重複） */
  stall?: { href?: string };
}) {
  const state = listingStateText(listing);
  const sub = typeLevelText(item);
  return (
    <article className="flex min-w-0 flex-col overflow-hidden rounded-lg border border-border bg-background">
      <div className="flex flex-col gap-3 px-4 pt-4 pb-3.5">
        <div className="flex items-center gap-2.5">
          <ItemIcon image={item.icon} alt="" className="size-12 bg-muted" pixelated />
          <div className="min-w-0">
            <h3 className="text-[17px] leading-snug font-semibold">
              {item.name}
              {listing.strengthen > 0 && (
                <span className="ml-2 font-mono font-medium text-primary">
                  +{listing.strengthen}
                </span>
              )}
            </h3>
            {sub && <div className="text-xs text-muted-foreground">{sub}</div>}
          </div>
        </div>

        {item.attributes.length > 0 && (
          <dl className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-0.5 text-[13px]">
            {item.attributes.map((a) => (
              <div key={a.label} className="contents">
                <dt>{a.label}</dt>
                <dd className="text-right font-mono tabular-nums">{a.value}</dd>
              </div>
            ))}
          </dl>
        )}

        <div className="border-t border-dashed border-border" />

        <div>
          <div className="mb-1 text-[11px] text-muted-foreground">附加素質</div>
          {listing.stats.length > 0 ? (
            <dl className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-1 rounded-md bg-chart-2/12 px-2.5 py-2 text-base font-medium text-celadon-ink">
              {listing.stats.map(([label, value]) => (
                <div key={label} className="contents">
                  <dt>{label}</dt>
                  <dd className="text-right font-mono tabular-nums">{signed(value)}</dd>
                </div>
              ))}
            </dl>
          ) : (
            <div className="rounded-md border border-dashed border-border px-2.5 py-2 text-[13px] text-muted-foreground">
              無
            </div>
          )}
        </div>

        {listing.stones.length > 0 && (
          <div>
            <div className="mb-1 text-[11px] text-muted-foreground">
              真元／魂石（{listing.stones.length} 顆）
            </div>
            <ul>
              {listing.stones.map((id, i) => {
                const stone = stones.get(id);
                return (
                  <li key={i} className="flex items-center gap-2.5 py-1.5">
                    {stone?.icon && (
                      <ItemIcon
                        image={stone.icon}
                        alt=""
                        className="size-[34px] bg-muted"
                        pixelated
                      />
                    )}
                    <span className="min-w-0">
                      <span className="block text-sm font-medium">{stone?.name ?? `#${id}`}</span>
                      {stone?.effect && (
                        <span className="block text-xs text-muted-foreground">{stone.effect}</span>
                      )}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {state && <div className="text-xs text-muted-foreground">{state}</div>}
      </div>

      <div className="mt-auto flex flex-col gap-2 bg-muted px-4 py-3">
        <Price silver={listing.price} className="text-xl" />
        {stall && <StallLine listing={listing} href={stall.href} />}
      </div>
    </article>
  );
}

/** 一般道具（沒有個體差異）的一攤一列。 */
export function ListingRow({
  listing,
  stallHref: href,
  item,
}: {
  listing: MarketListing;
  /** 給了就是道具頁：第二行顯示招牌與攤主 */
  stallHref?: string;
  /** 給了就是攤位檢視：第一行先顯示道具 */
  item?: MarketItemInfo;
}) {
  // binds_left 為 null 表示可堆疊的一般物品，綁定／精煉對它沒有意義，兩個都不顯示。
  const badges =
    listing.bindsLeft == null
      ? []
      : [
          `綁 ${listing.bindsLeft}`,
          listing.refineLeft != null ? `精煉 ${listing.refineLeft}` : null,
        ].filter((b): b is string => b != null);
  return (
    <li className="flex items-start gap-3 border-t border-border py-3.5 first:border-t-0">
      {item && <ItemIcon image={item.icon} alt="" pixelated />}
      <div className="min-w-0 flex-1">
        {item && (
          <Link
            href={`/items/${item.id}`}
            className="block rounded-sm text-sm font-medium hover:underline focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
          >
            {item.name}
          </Link>
        )}
        <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
          <Price silver={listing.price} className={item ? "text-base" : "text-lg"} />
          {badges.length > 0 && (
            <span className="inline-flex flex-wrap gap-1.5">
              {badges.map((b) => (
                <Badge
                  key={b}
                  variant="outline"
                  className="font-normal text-muted-foreground tabular-nums"
                >
                  {b}
                </Badge>
              ))}
            </span>
          )}
        </div>
        {href !== undefined && <StallLine listing={listing} href={href} className="mt-2" />}
      </div>
      <div className="shrink-0 pt-1 font-mono text-xs whitespace-nowrap text-muted-foreground">
        {listing.count.toLocaleString("zh-TW")} 件
      </div>
    </li>
  );
}
