import Link from "next/link";
import type { Metadata } from "next";
import type { LucideIcon } from "lucide-react";
import {
  ArrowRightIcon,
  DatabaseIcon,
  RouteIcon,
  SearchIcon,
  ShieldIcon,
  WrenchIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { getDb } from "@/lib/db";
import { cn } from "@/lib/utils";
import { getItemsByIds } from "@/lib/queries/items";
import { getRecentReports } from "@/lib/queries/market-prices";
import { SERVERS, formatAmount, relativeTime } from "@/lib/market-price";

export const metadata: Metadata = {
  title: "武林同萌傳資料庫（原新絕代雙驕）｜玄武",
  description:
    "查詢《武林同萌傳》（原《新絕代雙驕》）的道具取得方式、怪物掉落、技能與任務資料，搭配裝備比較及副本攻略，找回你需要的江湖情報。",
  alternates: { canonical: "/" },
};

interface Feature {
  title: string;
  description: string;
  href: string;
}

interface FeatureGroup {
  label: string;
  icon: LucideIcon;
  features: Feature[];
  // 只有真的有總覽頁的組才給「全部」連結
  overview?: string;
}

// ponytail: 分組與 href 對齊 navbar.tsx 的 navGroups；navbar 新增入口時這裡要一起補
const guideGroup: FeatureGroup = {
  label: "攻略",
  icon: RouteIcon,
  features: [
    {
      title: "修行路線",
      description: "照等級走：從創角、轉副門派、進階任務到轉生，每一站該做什麼",
      href: "/guides",
    },
    {
      title: "迷宮攻略",
      description: "各迷宮的走法整理，搭配 160／175／180 解謎工具",
      href: "/guides/dungeons",
    },
  ],
};

const groups: FeatureGroup[] = [
  {
    label: "資料庫",
    icon: DatabaseIcon,
    features: [
      { title: "道具", description: "13,000+ 道具的屬性、隨機詞條、掉落來源", href: "/items" },
      { title: "技能", description: "14 門派技能瀏覽、等級成長對照", href: "/skills" },
      { title: "怪物", description: "等級、屬性、掉落反查一次找齊", href: "/monsters" },
      { title: "英雄", description: "英雄清單、相惜組合，還能試排隊伍編成", href: "/heroes" },
      { title: "任務", description: "任務步驟、所需物品、地點與 NPC", href: "/missions" },
      { title: "地圖", description: "全部場景地圖、所屬區域與屬性", href: "/maps" },
      { title: "NPC 位置", description: "搜尋 NPC 名稱，查它出現在哪些地圖", href: "/npcs" },
      { title: "練功地圖", description: "輸入等級，找適合練功的地圖", href: "/training-spots" },
      { title: "煉化", description: "煉化配方來源、產出與機率", href: "/compounds" },
      { title: "成就", description: "1,200+ 成就的點數、描述與獎勵", href: "/achievements" },
      { title: "商店", description: "NPC 商店販售與收購價，查哪裡買得到", href: "/shops" },
    ],
  },
  {
    label: "裝備",
    icon: ShieldIcon,
    features: [
      { title: "排行榜", description: "七大流派加權，可調權重與等級區間", href: "/ranking" },
      { title: "比較", description: "多件座騎／背飾的雷達圖與流派分數並排看", href: "/compare" },
    ],
  },
  {
    label: "工具",
    icon: WrenchIcon,
    overview: "/tools",
    features: [
      { title: "強化查詢", description: "依屬性反查真元、魂石強化配方與機率", href: "/tools/enhance" },
      { title: "160 迷霧九宮格", description: "輸入總和與關閉房間，推算水晶數", href: "/tools/160" },
      { title: "175 北斗七星", description: "輸入數字，算出七顆星的開關", href: "/tools/175" },
      { title: "180 神武禁地", description: "輸入總和與封印數字，列出所有排法", href: "/tools/180" },
      { title: "易容閣", description: "試穿外觀、坐騎與染髮，可分享連結", href: "/tools/salon" },
      { title: "經脈模擬器", description: "還沒 180 等也能先試打通、規劃配點", href: "/tools/meridian" },
      { title: "屬性模擬器", description: "填配點、裝備與被動，算出角色面板", href: "/tools/stat-sim" },
    ],
  },
];

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
        <p className="mt-1.5 text-sm text-muted-foreground">武林同萌傳 · 玩家資料庫</p>
        <p className="mx-auto mt-4 max-w-xl text-sm leading-relaxed text-muted-foreground">
          玄武提供《武林同萌傳》（原《新絕代雙驕》）的道具、怪物、技能與任務查詢，以及裝備比較和副本攻略。
        </p>

        <form action="/items" role="search" className="mt-6 flex w-full max-w-md gap-2">
          <Input
            name="search"
            type="search"
            placeholder="搜尋道具名稱…"
            aria-label="搜尋道具名稱"
            className="h-9"
          />
          <Button type="submit" size="lg">
            <SearchIcon aria-hidden />
            搜尋
          </Button>
        </form>

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
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <h2 className="text-sm font-medium">最近的市價回報</h2>
          <p className="text-xs text-muted-foreground">價格由玩家自己回報，登入後誰都能報。</p>
        </div>

        {recent.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">
            還沒有人回報過價格。到任一{" "}
            <Link href="/items" className="text-primary underline underline-offset-3">
              物品頁
            </Link>{" "}
            就能報第一筆。
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
        <p className="-mt-2 mb-4 text-sm text-foreground">剛開始玩或剛回鍋？從這裡開始</p>
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
              <CardDescription className="text-xs leading-relaxed">{f.description}</CardDescription>
            </CardHeader>
          </Card>
        </Link>
      ))}
    </div>
  );
}
