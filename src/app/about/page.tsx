import type { Metadata } from "next";
import Link from "next/link";
import {
  MessageSquareIcon,
  MessagesSquareIcon,
  ExternalLinkIcon,
  DatabaseIcon,
  WrenchIcon,
  HeartIcon,
  Code2Icon,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";

export const metadata: Metadata = {
  title: "關於 | 玄武",
  description: "關於玄武 — 武林同萌傳玩家資料庫的緣由、功能、技術與作者。",
};

const capabilities = [
  { title: "道具查詢", desc: "搜尋 13,000+ 道具，查看屬性、隨機詞條、掉落來源。" },
  { title: "流派排行", desc: "七大流派加權，即時調整權重與等級區間。" },
  { title: "裝備比較", desc: "同時比對多件座騎 / 背飾的雷達圖與流派分數。" },
  { title: "技能瀏覽", desc: "14 門派技能瀏覽、等級成長對照。" },
  { title: "怪物查詢", desc: "等級、屬性、掉落反查一次找齊。" },
  { title: "煉化配方", desc: "煉化群組總覽，配方來源、產出、機率一覽。" },
  { title: "任務瀏覽", desc: "全部任務的步驟、所需物品、地點 / NPC 一覽。" },
  { title: "副本解謎", desc: "160 迷霧九宮格、175 北斗七星、180 神武禁地互動解題器。" },
];

const techStack = [
  "Next.js 16",
  "React 19",
  "TypeScript",
  "Tailwind CSS 4",
  "shadcn/ui",
  "better-sqlite3",
  "Recharts",
  "Docker",
];

const links = [
  {
    label: "GitHub",
    href: "https://github.com/hanshino",
    icon: Code2Icon,
  },
  {
    label: "巴哈姆特 · jane58821",
    href: "https://home.gamer.com.tw/homeindex.php?owner=jane58821",
    icon: ExternalLinkIcon,
  },
  {
    label: "Discord 頻道",
    href: "https://discord.gg/NaMjUXv6Tb",
    icon: MessagesSquareIcon,
  },
  {
    label: "問題回報 / Issues",
    href: "https://github.com/hanshino/genbu/issues",
    icon: MessageSquareIcon,
  },
];

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:py-14">
      <header className="flex flex-col items-center text-center">
        <span
          aria-hidden
          className="inline-flex h-20 w-20 items-center justify-center rounded-md border-2 border-primary bg-primary/5 text-4xl font-bold text-primary shadow-sm [font-family:var(--font-heading)]"
          title="玄武印"
        >
          玄
        </span>
        <h1 className="font-heading mt-5 text-3xl font-bold tracking-tight sm:text-4xl">
          關於玄武
        </h1>
        <p className="text-muted-foreground mt-3 max-w-xl text-sm leading-relaxed">
          武林同萌傳 (TTHOL) 的玩家資料庫 — 道具查詢、裝備流派比較、副本解謎，集中一處、即時查得。
        </p>
      </header>

      <Separator className="my-10" />

      <Section
        icon={<WrenchIcon className="text-primary size-5" aria-hidden />}
        title="這個站做什麼"
      >
        <p className="text-muted-foreground text-sm leading-relaxed">
          武林同萌傳的攻略資訊散落在論壇、Wiki、群組對話之間，找一件裝備往往需要翻好幾個頁面。
          玄武把這些遊戲資料整理進可查、可比、可推算的工具裡，讓玩家不用切到第二個分頁就能做完一輪規劃。
        </p>
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          {capabilities.map((c) => (
            <div key={c.title} className="border-border/60 bg-card rounded-md border p-4">
              <p className="font-medium">{c.title}</p>
              <p className="text-muted-foreground mt-1 text-xs leading-relaxed">{c.desc}</p>
            </div>
          ))}
        </div>
      </Section>

      <Separator className="my-10" />

      <Section icon={<DatabaseIcon className="text-primary size-5" aria-hidden />} title="資料來源">
        <p className="text-muted-foreground text-sm leading-relaxed">
          所有遊戲資料來自《武林同萌傳》遊戲檔案與社群整理，僅作為查詢用途展示，不涉及任何遊戲內檔案的散布。
          站內計算公式（流派加權、裝備分數）為個人整理，僅供參考；如與實際數值有出入，請以遊戲內顯示為準。
        </p>
      </Section>

      <Separator className="my-10" />

      <Section title="技術棧">
        <div className="flex flex-wrap gap-2">
          {techStack.map((t) => (
            <Badge key={t} variant="secondary" className="font-mono text-xs">
              {t}
            </Badge>
          ))}
        </div>
      </Section>

      <Separator className="my-10" />

      <Section icon={<HeartIcon className="text-primary size-5" aria-hidden />} title="關於作者">
        <Card>
          <CardHeader>
            <CardTitle className="font-heading">hanshino · 罕</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm leading-relaxed">
            <p className="text-muted-foreground">
              武林同萌傳的老玩家，巴哈姆特板上以 jane58821（罕）活動，分享過幾篇攻略與小工具，
              現在也擔任板務。本業是寫程式，平常會把遊戲遇到的計算需求做成可分享的網頁工具。
            </p>
            <p className="text-muted-foreground">
              玄武是以類似精神延續的個人專案 — 想看到的工具自己做，做完丟出來給同好用。
              有任何錯誤回報、新功能想法，都歡迎透過下面任一管道告訴我。
            </p>
            <div className="flex flex-wrap gap-2 pt-2">
              {links.map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  target="_blank"
                  rel="noreferrer"
                  className="border-border/60 hover:bg-muted/50 inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-xs transition-colors"
                >
                  <l.icon className="size-3.5" aria-hidden />
                  {l.label}
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      </Section>

      <Separator className="my-10" />

      <Section title="免責聲明">
        <p className="text-muted-foreground text-xs leading-relaxed">
          本站為個人興趣製作之非官方查詢站，與《武林同萌傳》原廠及代理商無任何隸屬關係。
          遊戲名稱、美術素材、設定資料之著作權皆歸原權利人所有，本站僅整理公開可得之數值資訊提供查詢，不提供遊戲檔案或修改工具。
          站內計算結果僅供參考，實際遊戲數值以官方為準。
        </p>
      </Section>
    </div>
  );
}

function Section({
  icon,
  title,
  children,
}: {
  icon?: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h2 className="font-heading mb-4 flex items-center gap-2 text-xl font-bold">
        {icon}
        {title}
      </h2>
      {children}
    </section>
  );
}
