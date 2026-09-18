import Link from "next/link";
import { ChevronRightIcon } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getDb } from "@/lib/db";
import { getItemsByIds } from "@/lib/queries/items";
import { getRecentReports } from "@/lib/queries/market-prices";
import { SERVERS, formatAmount, relativeTime } from "@/lib/market-price";

interface Feature {
  title: string;
  description: string;
  href: string;
}

const features: Feature[] = [
  {
    title: "道具查詢",
    description: "搜尋 13,000+ 道具，查看屬性、隨機詞條、掉落來源",
    href: "/items",
  },
  {
    title: "流派排行",
    description: "七大流派加權，即時調整權重與等級區間",
    href: "/ranking",
  },
  {
    title: "裝備比較",
    description: "同時比對多件座騎 / 背飾的雷達圖與流派分數",
    href: "/compare",
  },
  {
    title: "技能瀏覽",
    description: "14 門派技能瀏覽、等級成長對照",
    href: "/skills",
  },
  {
    title: "怪物查詢",
    description: "等級、屬性、掉落反查一次找齊",
    href: "/monsters",
  },
  {
    title: "煉化配方",
    description: "煉化群組總覽，配方來源、產出、機率一覽",
    href: "/compounds",
  },
  {
    title: "任務瀏覽",
    description: "全部任務的步驟、所需物品、地點 / NPC 一覽",
    href: "/missions",
  },
  {
    title: "成就圖鑑",
    description: "1,200+ 成就分類瀏覽,點數、描述、獎勵一覽",
    href: "/achievements",
  },
  {
    title: "商店查詢",
    description: "NPC 商店販售與收購價,道具頁直查哪裡買",
    href: "/shops",
  },
  {
    title: "副本解謎",
    description: "160 迷霧九宮格、175 北斗七星、180 神武禁地",
    href: "/tools",
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
    <div className="mx-auto max-w-6xl px-4 py-12 sm:py-16">
      <section className="flex flex-col items-center text-center">
        <span
          aria-hidden
          className="inline-flex h-24 w-24 items-center justify-center rounded-md border-2 border-primary bg-primary/5 text-5xl font-bold text-primary shadow-sm [font-family:var(--font-heading)]"
          title="玄武印"
        >
          玄
        </span>
        <h1 className="mt-5 text-4xl font-bold tracking-tight sm:text-5xl">玄武</h1>
        <p className="mt-2 text-sm text-muted-foreground">武林同萌傳 · 玩家資料庫</p>
        <p className="mx-auto mt-6 max-w-xl text-sm leading-relaxed text-muted-foreground">
          道具查詢、裝備流派比較、副本解謎工具 — 集中一處、即時查得。
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
                  <span className="ml-auto text-xs whitespace-nowrap text-muted-foreground">
                    {r.serverName} · {relativeTime(r.createdAt)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {features.map((f) => (
          <Link key={f.href} href={f.href}>
            <Card className="h-full transition-colors hover:border-primary/50">
              <CardHeader>
                <CardTitle>{f.title}</CardTitle>
                <CardDescription className="mt-2">{f.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                  立即查詢
                  <ChevronRightIcon className="size-3" aria-hidden />
                </p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </section>

      <section className="mt-12 grid gap-4 sm:grid-cols-3">
        <StatCard label="道具" value={stats.items} />
        <StatCard label="技能" value={stats.magic} />
        <StatCard label="怪物" value={stats.monsters} />
      </section>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-border/60 bg-card p-6 text-center">
      <p className="text-3xl font-semibold font-mono tabular-nums">{value.toLocaleString()}</p>
      <p className="mt-1 text-sm text-muted-foreground">{label}</p>
    </div>
  );
}
