import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getDb } from "@/lib/db";

interface Feature {
  title: string;
  description: string;
  href: string;
  disabled?: boolean;
  phase: string;
}

const features: Feature[] = [
  {
    title: "道具查詢",
    description: "搜尋 13,000+ 道具，查看屬性、隨機詞條、掉落來源",
    href: "/items",
    phase: "Phase 1",
  },
  {
    title: "裝備比較",
    description: "七種流派加權排行與多件裝備並排比較",
    href: "/items/compare",
    disabled: true,
    phase: "Phase 2",
  },
  {
    title: "技能 & 怪物",
    description: "14 門派技能瀏覽、怪物查詢與掉落回查",
    href: "/skills",
    disabled: true,
    phase: "Phase 3",
  },
  {
    title: "副本解謎",
    description: "160 迷霧九宮格、175 北斗七星、180 神武禁地",
    href: "/tools",
    disabled: true,
    phase: "Phase 4",
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

export default function HomePage() {
  const stats = getStats();

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:py-16">
      <section className="text-center">
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">玄武</h1>
        <p className="mt-3 text-lg text-muted-foreground">武林同萌傳 · 玩家資料庫</p>
        <p className="mx-auto mt-6 max-w-xl text-sm text-muted-foreground">
          道具查詢、裝備流派比較、副本解謎工具 — 集中一處、即時查得。
        </p>
      </section>

      <section className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {features.map((f) => {
          const card = (
            <Card
              className={`h-full transition-colors ${
                f.disabled ? "opacity-60" : "hover:border-foreground/30"
              }`}
            >
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>{f.title}</CardTitle>
                  <Badge variant="secondary" className="text-xs">
                    {f.phase}
                  </Badge>
                </div>
                <CardDescription className="mt-2">{f.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">
                  {f.disabled ? "即將推出" : "立即查詢 →"}
                </p>
              </CardContent>
            </Card>
          );
          return f.disabled ? (
            <div key={f.href}>{card}</div>
          ) : (
            <Link key={f.href} href={f.href}>
              {card}
            </Link>
          );
        })}
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
      <p className="text-3xl font-semibold">{value.toLocaleString()}</p>
      <p className="mt-1 text-sm text-muted-foreground">{label}</p>
    </div>
  );
}
