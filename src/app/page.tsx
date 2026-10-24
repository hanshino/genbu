import Link from "next/link";
import type { Metadata } from "next";
import type { LucideIcon } from "lucide-react";
import {
  ArrowRightIcon,
  DatabaseIcon,
  RouteIcon,
  ShieldIcon,
  WrenchIcon,
} from "lucide-react";
import { GlobalSearch } from "@/components/search/global-search";
import { Badge } from "@/components/ui/badge";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getDb } from "@/lib/db";
import { cn } from "@/lib/utils";
import { NAV_SECTIONS, type NavSection } from "@/lib/site-nav";
import { getItemsByIds } from "@/lib/queries/items";
import { getRecentReports } from "@/lib/queries/market-prices";
import { SERVERS, formatAmount, relativeTime } from "@/lib/market-price";

export const metadata: Metadata = {
  title: "武林同萌傳資料庫（原新絕代雙驕）｜玄武",
  description:
    "查詢《武林同萌傳》（原《新絕代雙驕》）的道具取得方式、怪物掉落、技能與任務資料，搭配裝備比較及副本攻略，找回你需要的江湖情報。",
  alternates: { canonical: "/" },
};

const SECTION_ICONS: Record<string, LucideIcon> = {
  攻略: RouteIcon,
  資料庫: DatabaseIcon,
  裝備: ShieldIcon,
  工具: WrenchIcon,
};

interface Feature {
  title: string;
  description?: string;
  href: string;
}

interface FeatureGroup {
  label: string;
  icon: LucideIcon;
  features: Feature[];
  // 只有真的有總覽頁的組才給「全部」連結
  overview?: string;
}

// hideOnHome 的入口（例如 navbar 專用的「工具總覽」）不上首頁
function toFeatureGroup(section: NavSection): FeatureGroup {
  return {
    label: section.label,
    icon: SECTION_ICONS[section.label],
    overview: section.overview,
    features: section.items.flatMap((e) =>
      e.hideOnHome ? [] : [{ title: e.title ?? e.label, description: e.description, href: e.href }],
    ),
  };
}

const allGroups = NAV_SECTIONS.map(toFeatureGroup);
const guideGroup = allGroups.find((g) => g.label === "攻略")!;
const groups = allGroups.filter((g) => g !== guideGroup);

function getStats() {
  const db = getDb();
  const counts = (["items", "magic", "monsters"] as const).map((t) => {
    const row = db.prepare(`SELECT COUNT(*) AS c FROM ${t}`).get() as { c: number };
    return row.c;
  });
  return { items: counts[0], magic: counts[1], monsters: counts[2] };
}

// 回報在玩家資料庫、名稱在唯讀遊戲資料庫，跨檔不能 JOIN，分兩段查再拼起來。
function getRecentPrices() {
  const reports = getRecentReports(5);
  const names = new Map(getItemsByIds(reports.map((r) => r.itemId)).map((i) => [i.id, i.name]));
  return reports.flatMap((r) => {
    const name = names.get(r.itemId);
    // 遊戲資料更新後物品可能不在了，寧可少一列也不要顯示「未知物品」。
    if (name == null) return [];
    return [
      {
        ...r,
        name,
        money: formatAmount(r.amount, r.currency),
        serverName: SERVERS.find((s) => s.id === r.server)?.name ?? r.server,
      },
    ];
  });
}

export default function HomePage() {
  const stats = getStats();
  const recent = getRecentPrices();

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:py-14">
      <section className="flex flex-col items-center text-center">
        <span
          aria-hidden
          className="inline-flex h-16 w-16 items-center justify-center rounded-md border-2 border-primary bg-primary/5 text-3xl font-bold text-primary shadow-sm [font-family:var(--font-heading)]"
          title="玄武印"
        >
          玄
        </span>
        <h1 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">玄武</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">《武林同萌傳》玩家資料庫</p>

        <GlobalSearch className="mt-6" />

        <p className="mt-4 text-xs text-muted-foreground">
          收錄 <span className="tabular-nums">{stats.items.toLocaleString()}</span> 道具 ·{" "}
          <span className="tabular-nums">{stats.magic.toLocaleString()}</span> 技能 ·{" "}
          <span className="tabular-nums">{stats.monsters.toLocaleString()}</span> 怪物 ·{" "}
          <Link
            href="/changelog"
            className="inline-flex items-center gap-0.5 text-primary underline-offset-3 hover:underline"
          >
            更新紀錄
            <ArrowRightIcon className="size-3" aria-hidden />
          </Link>
        </p>
      </section>

      {/* 市價本來只在物品詳情頁看得到，沒逛到那頁的人不知道可以報價，放首頁當入口。 */}
      <section className="mt-10 rounded-lg border border-border/60 bg-card p-4">
        <h2 className="text-sm font-medium">最近的市價回報</h2>

        {recent.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">
            尚無回報，到
            <Link href="/items" className="text-primary underline underline-offset-3">
              物品頁
            </Link>
            報第一筆
          </p>
        ) : (
          <ul className="mt-1.5">
            {recent.map((r) => (
              <li key={r.id} className="border-t border-border/60 first:border-t-0">
                <Link
                  href={`/items/${r.itemId}`}
                  className="-mx-2 flex flex-wrap items-baseline gap-x-2 gap-y-0.5 rounded-md px-2 py-2 transition-colors hover:bg-muted/50"
                >
                  <span className="text-sm font-medium">{r.name}</span>
                  <span className="font-heading text-sm font-semibold tabular-nums">
                    {r.money.value}
                    <span className="ml-0.5 font-sans text-xs font-normal text-muted-foreground">
                      {r.money.unit}
                    </span>
                  </span>
                  {/* 覺醒過、強化過的價差可以到好幾倍，不標出來會被當成這件的行情。 */}
                  {r.modified && <Badge variant="outline">動過</Badge>}
                  <span className="ml-auto text-xs whitespace-nowrap text-muted-foreground">
                    {r.serverName} · {relativeTime(r.createdAt)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* 攻略放最前面並加框：新玩家／回鍋玩家最需要的是「從哪開始」 */}
      <section className="mt-10 rounded-xl border border-primary/30 bg-primary/5 p-4 sm:p-5">
        <GroupHeading group={guideGroup} className="mt-0" />
        <FeatureGrid features={guideGroup.features} className="sm:grid-cols-2 lg:grid-cols-2" />
      </section>

      {groups.map((g) => (
        <section key={g.label}>
          <GroupHeading group={g} />
          <FeatureGrid features={g.features} />
        </section>
      ))}
    </div>
  );
}

function GroupHeading({ group, className }: { group: FeatureGroup; className?: string }) {
  const Icon = group.icon;
  return (
    <div className={cn("mt-10 mb-4 flex items-center gap-3", className)}>
      <h2 className="font-heading flex flex-1 items-center gap-2.5 text-[15px] font-normal tracking-[0.08em] text-muted-foreground after:h-px after:flex-1 after:bg-border">
        <Icon className="size-4" aria-hidden />
        {group.label}
      </h2>
      {group.overview && (
        <Link
          href={group.overview}
          className="inline-flex items-center gap-1 text-xs text-primary underline-offset-3 hover:underline"
        >
          全部
          <ArrowRightIcon className="size-3" aria-hidden />
        </Link>
      )}
    </div>
  );
}

function FeatureGrid({ features, className }: { features: Feature[]; className?: string }) {
  return (
    <div className={cn("grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4", className)}>
      {features.map((f) => (
        <Link
          key={f.href}
          href={f.href}
          className="rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Card size="sm" className="h-full transition-colors hover:bg-muted/50 hover:ring-primary/50">
            <CardHeader>
              <CardTitle>{f.title}</CardTitle>
              {f.description && (
                <CardDescription className="text-xs leading-relaxed">{f.description}</CardDescription>
              )}
            </CardHeader>
          </Card>
        </Link>
      ))}
    </div>
  );
}
