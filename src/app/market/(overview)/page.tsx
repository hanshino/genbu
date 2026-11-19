import { Fragment, Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { ChevronDownIcon } from "lucide-react";
import { Pagination } from "@/components/common/pagination";
import { ItemIcon } from "@/components/common/item-icon";
import { buttonVariants } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ItemListingList } from "@/components/market/item-market-listings";
import { MarketFilters } from "@/components/market/market-filters";
import { ShowcaseSwitch } from "@/components/market/showcase-switch";
import { ServerQueryToggle } from "@/components/market/server-switch";
import { StallCollapsible } from "@/components/market/stall-collapsible";
import {
  Price,
  StaleNotice,
  StallOwner,
  scanCaption,
  stallHref,
  typeLevelText,
} from "@/components/market/listing-parts";
import { STALL_PREVIEW_LIMIT, StallListings } from "@/components/market/stall-listings";
import { getGroupForType, itemTypeGroups } from "@/lib/constants/item-types";
import {
  groupByStall,
  normalizeSearchParams,
  shownListingCount,
  summarizeByItem,
  type MarketItemInfo,
  type MarketListing,
  type MarketScan,
  type RawSearchParams,
  type StallSummary,
} from "@/lib/market-listings";
import {
  getLatestScans,
  getMarketItemInfo,
  getScanListings,
  getStoneInfo,
  type StoneInfo,
} from "@/lib/queries/market-listings";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "市集掛單 · 玄武",
  description: "成都市集最新一次掃描的擺攤掛單：誰在賣、開多少、裝備素質如何。",
  alternates: { canonical: "/market" },
};

const ITEMS_PER_PAGE = 50;
const STALLS_PER_PAGE = 20;
const ICONS_PER_STALL = 8;

interface PageProps {
  searchParams: Promise<RawSearchParams>;
}

type Data = {
  scans: MarketScan[];
  scan: MarketScan;
  listings: MarketListing[];
  items: Map<number, MarketItemInfo>;
  stones: Map<number, StoneInfo>;
};

function load(server: string | undefined, showcase: boolean): Data | null {
  const scans = getLatestScans();
  if (scans.length === 0) return null;
  const scan = scans.find((s) => s.server === server) ?? scans[0];
  const listings = getScanListings(scan.scanId, showcase);
  const items = getMarketItemInfo(listings.map((l) => l.itemId));
  const stones = getStoneInfo(listings.flatMap((l) => l.stones));
  return { scans, scan, listings, items, stones };
}

function Shell({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto max-w-6xl space-y-5 px-4 py-8">{children}</div>;
}

function Notice({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border/60 bg-card px-6 py-12 text-center text-sm text-muted-foreground">
      {children}
    </div>
  );
}

function ViewSwitch({ view, base }: { view: "items" | "stalls"; base: URLSearchParams }) {
  const href = (v: "items" | "stalls") => {
    const params = new URLSearchParams(base);
    for (const key of ["page", "stall", "item"]) params.delete(key);
    if (v === "stalls") params.set("view", "stalls");
    else params.delete("view");
    return `/market${params.size > 0 ? `?${params}` : ""}`;
  };
  return (
    <div
      role="group"
      aria-label="瀏覽方式"
      className="inline-flex w-fit items-center gap-0.5 rounded-lg border border-border/60 bg-secondary p-[3px] text-muted-foreground"
    >
      {(
        [
          ["items", "依道具"],
          ["stalls", "依攤位"],
        ] as const
      ).map(([v, label]) => (
        <Link
          key={v}
          href={href(v)}
          aria-current={view === v ? "page" : undefined}
          className={cn(
            "inline-flex h-7 items-center rounded-md border border-transparent px-3 text-sm font-medium whitespace-nowrap transition-colors outline-none hover:bg-accent/70 hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50",
            view === v && "bg-card text-foreground shadow-sm",
          )}
        >
          {label}
        </Link>
      ))}
    </div>
  );
}

/** 依道具：每列的攤數是個開關，點了在下面攤開這件道具的每一筆掛單與攤位（網址的 item）。 */
function ItemsView({
  rows,
  items,
  listings,
  scan,
  stones,
  base,
  expanded,
  showcase,
}: {
  rows: ReturnType<typeof summarizeByItem>;
  items: Map<number, MarketItemInfo>;
  /** 已套用篩選、由便宜到貴的掛單 */
  listings: MarketListing[];
  scan: MarketScan;
  stones: Map<number, StoneInfo>;
  base: URLSearchParams;
  expanded: number | null;
  showcase: boolean;
}) {
  const toggleHref = (itemId: number) => {
    const params = new URLSearchParams(base);
    if (expanded === itemId) params.delete("item");
    else params.set("item", String(itemId));
    return `/market${params.size > 0 ? `?${params}` : ""}`;
  };
  return (
    <div className="rounded-lg border border-border/60 bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>道具</TableHead>
            <TableHead className="text-right">最低價</TableHead>
            <TableHead className="hidden text-right sm:table-cell">最高價</TableHead>
            <TableHead className="text-right">攤數</TableHead>
            <TableHead className="hidden text-right sm:table-cell">件數</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => {
            const item = items.get(row.itemId);
            const sub = item ? typeLevelText(item) : "";
            const open = item != null && expanded === row.itemId;
            return (
              <Fragment key={row.itemId}>
                <TableRow>
                  <TableCell className="whitespace-normal">
                    <span className="flex items-center gap-2.5">
                      <ItemIcon image={item?.icon} alt="" pixelated />
                      <span className="min-w-0">
                        <Link
                          href={`/items/${row.itemId}`}
                          className="rounded-sm font-medium hover:underline focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                        >
                          {item?.name ?? `#${row.itemId}`}
                        </Link>
                        {sub && <span className="block text-xs text-muted-foreground">{sub}</span>}
                      </span>
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <Price silver={row.min} className="font-mono text-sm font-normal" />
                  </TableCell>
                  <TableCell className="hidden text-right sm:table-cell">
                    {row.max !== row.min && (
                      <Price silver={row.max} className="font-mono text-sm font-normal" />
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {item ? (
                      <Link
                        href={toggleHref(row.itemId)}
                        scroll={false}
                        aria-expanded={open}
                        aria-label={`${item.name}，${row.stalls} 攤在賣`}
                        className={cn(
                          buttonVariants({ variant: open ? "secondary" : "ghost", size: "sm" }),
                          "-mr-2 font-mono tabular-nums",
                        )}
                      >
                        {row.stalls}
                        <ChevronDownIcon
                          className={cn("size-3.5 transition-transform", open && "rotate-180")}
                          aria-hidden
                        />
                      </Link>
                    ) : (
                      <span className="font-mono tabular-nums">{row.stalls}</span>
                    )}
                  </TableCell>
                  <TableCell className="hidden text-right font-mono tabular-nums sm:table-cell">
                    {row.pieces.toLocaleString("zh-TW")}
                  </TableCell>
                </TableRow>
                {open && (
                  <TableRow className="hover:bg-transparent">
                    <TableCell colSpan={5} className="bg-muted/30 p-3 whitespace-normal sm:p-4">
                      <ItemListingList
                        listings={listings.filter((l) => l.itemId === row.itemId)}
                        item={item}
                        scan={scan}
                        stones={stones}
                        showcase={showcase}
                      />
                    </TableCell>
                  </TableRow>
                )}
              </Fragment>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

/** 依攤位的一攤：無外框的列表列，攤與攤之間用分隔線；展開後的裝備卡是唯一有框的層級。 */
function StallRow({
  stall,
  scan,
  items,
  stones,
  open,
  showcase,
}: {
  stall: StallSummary;
  scan: MarketScan;
  items: Map<number, MarketItemInfo>;
  stones: Map<number, StoneInfo>;
  open: boolean;
  showcase: boolean;
}) {
  const iconIds = [...new Set(stall.listings.map((l) => l.itemId))];
  const sign = stall.sign || "（沒有招牌）";
  const count = shownListingCount(stall.listings, items);
  return (
    <article id={`stall-${stall.ownerHash}`} className="scroll-mt-20 py-4">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-1">
        <h2 className="min-w-0 text-base font-semibold break-all">{sign}</h2>
        <span className="text-[13px]">
          <StallOwner name={stall.name} />
        </span>
      </div>
      <StallCollapsible
        defaultOpen={open}
        label={`${sign}的 ${count} 筆掛單`}
        summary={
          <span className="flex flex-wrap items-center gap-1.5">
            {iconIds.slice(0, ICONS_PER_STALL).map((id) => (
              <ItemIcon key={id} image={items.get(id)?.icon} alt="" pixelated />
            ))}
            {iconIds.length > ICONS_PER_STALL && (
              <span className="font-mono text-xs text-muted-foreground">
                +{iconIds.length - ICONS_PER_STALL}
              </span>
            )}
            <span className="ml-1 text-xs text-muted-foreground">{count} 筆掛單</span>
          </span>
        }
      >
        <StallListings
          listings={stall.listings}
          items={items}
          stones={stones}
          limit={STALL_PREVIEW_LIMIT}
          moreHref={stallHref(scan, stall.ownerHash, showcase)}
        />
      </StallCollapsible>
    </article>
  );
}

export default async function MarketPage({ searchParams }: PageProps) {
  const params = normalizeSearchParams(await searchParams);
  const view = params.view === "stalls" ? "stalls" : "items";
  const query = (params.q ?? "").trim();
  const group = params.group ?? "";
  const showcase = params.showcase === "1";

  let data: Data | null;
  try {
    data = load(params.server, showcase);
  } catch (error) {
    console.error("market page read failed", error);
    return (
      <Shell>
        <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">市集</h1>
        <Notice>無法讀取市集掛單，請稍後重新整理。</Notice>
      </Shell>
    );
  }

  if (!data) {
    return (
      <Shell>
        <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">市集</h1>
        <Notice>目前還沒有市集掃描資料。</Notice>
      </Shell>
    );
  }

  const { scans, scan, listings, items, stones } = data;
  const base = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v) base.set(k, v);

  const groupOf = (itemId: number) =>
    getGroupForType(items.get(itemId)?.type ?? null)?.id ?? "misc";
  const presentGroups = new Set(listings.map((l) => groupOf(l.itemId)));
  const groups = itemTypeGroups
    .filter((g) => presentGroups.has(g.id))
    .map((g) => ({ id: g.id, label: g.label }));
  const inGroup = (l: MarketListing) => !group || groupOf(l.itemId) === group;
  const needle = query.toLowerCase();
  const nameOf = (l: MarketListing) => items.get(l.itemId)?.name ?? "";

  const allStalls = groupByStall(listings);
  const caption = `${scanCaption(scan)}，${allStalls.length} 攤、${new Set(listings.map((l) => l.itemId)).size} 種道具`;
  const requestedPage = Math.max(1, Math.floor(Number(params.page)) || 1);

  let body: React.ReactNode;
  let pagination: { page: number; totalPages: number } | null = null;
  let footer: string;

  if (view === "items") {
    const filtered = listings.filter(
      (l) => inGroup(l) && (!needle || nameOf(l).toLowerCase().includes(needle)),
    );
    const rows = summarizeByItem(filtered);
    const totalPages = Math.max(1, Math.ceil(rows.length / ITEMS_PER_PAGE));
    const page = Math.min(requestedPage, totalPages);
    const pageRows = rows.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);
    body =
      rows.length === 0 ? (
        <Notice>找不到符合條件的掛單</Notice>
      ) : (
        <ItemsView
          rows={pageRows}
          items={items}
          listings={filtered}
          scan={scan}
          stones={stones}
          base={base}
          expanded={Number(params.item) || null}
          showcase={showcase}
        />
      );
    pagination = totalPages > 1 ? { page, totalPages } : null;
    footer =
      rows.length === 0
        ? ""
        : `第 ${(page - 1) * ITEMS_PER_PAGE + 1} 至 ${(page - 1) * ITEMS_PER_PAGE + pageRows.length} 筆，共 ${rows.length} 種，依掛單數排序`;
  } else {
    const stalls = allStalls.filter(
      (s) =>
        s.listings.some(inGroup) &&
        (!needle ||
          (s.sign ?? "").toLowerCase().includes(needle) ||
          (s.name ?? "").toLowerCase().includes(needle) ||
          s.listings.some((l) => nameOf(l).toLowerCase().includes(needle))),
    );
    const totalPages = Math.max(1, Math.ceil(stalls.length / STALLS_PER_PAGE));
    // 帶 stall 參數（沒帶頁碼）時：直接翻到那一攤所在的頁並展開。
    const target = params.stall ? stalls.findIndex((s) => s.ownerHash === params.stall) : -1;
    const page =
      !params.page && target >= 0
        ? Math.floor(target / STALLS_PER_PAGE) + 1
        : Math.min(requestedPage, totalPages);
    const pageStalls = stalls.slice((page - 1) * STALLS_PER_PAGE, page * STALLS_PER_PAGE);
    body =
      stalls.length === 0 ? (
        <Notice>找不到符合條件的攤位</Notice>
      ) : (
        <div className="divide-y divide-border/60 border-y border-border/60">
          {pageStalls.map((s) => (
            <StallRow
              key={s.ownerHash}
              stall={s}
              scan={scan}
              items={items}
              stones={stones}
              open={s.ownerHash === params.stall}
              showcase={showcase}
            />
          ))}
        </div>
      );
    pagination = totalPages > 1 ? { page, totalPages } : null;
    footer =
      stalls.length === 0
        ? ""
        : `第 ${(page - 1) * STALLS_PER_PAGE + 1} 至 ${(page - 1) * STALLS_PER_PAGE + pageStalls.length} 攤，共 ${stalls.length} 攤，依商品數排序`;
  }

  return (
    <Shell>
      <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">市集</h1>
          <p className="mt-1 text-sm text-muted-foreground">{caption}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            掛單價是賣家開的價，不代表成交價。
            {showcase
              ? "標「議價」的是開 9,999 萬以上的展示價，價錢要找攤主談。"
              : "9,999 萬以上的展示價不列入。"}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {scans.length > 1 && (
            <Suspense fallback={null}>
              <ServerQueryToggle servers={scans.map((s) => s.server)} value={scan.server} />
            </Suspense>
          )}
          <ViewSwitch view={view} base={base} />
        </div>
      </header>

      <StaleNotice scan={scan} />

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <Suspense fallback={null}>
            <MarketFilters
              key={view}
              initialQuery={query}
              group={group}
              groups={groups}
              placeholder={view === "items" ? "搜尋道具名稱" : "搜尋招牌、攤主或道具"}
            />
          </Suspense>
        </div>
        <Suspense fallback={null}>
          <ShowcaseSwitch checked={showcase} />
        </Suspense>
      </div>

      {body}

      {(footer || pagination) && (
        <div className="space-y-3">
          {footer && <p className="text-xs text-muted-foreground">{footer}</p>}
          {pagination && (
            <Suspense fallback={null}>
              <Pagination
                page={pagination.page}
                totalPages={pagination.totalPages}
                basePath="/market"
              />
            </Suspense>
          )}
        </div>
      )}
    </Shell>
  );
}
