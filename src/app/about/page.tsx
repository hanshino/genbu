import type { Metadata } from "next";
import Link from "next/link";
import {
  MessageSquareIcon,
  MessagesSquareIcon,
  ExternalLinkIcon,
  DatabaseIcon,
  HeartIcon,
  Code2Icon,
  CpuIcon,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";

export const metadata: Metadata = {
  title: "關於 | 玄武",
  description: "關於玄武 — 武林同萌傳玩家資料庫的緣由、功能、技術與作者。",
};

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
          武林同萌傳 (TTHOL) 玩家資料庫
        </p>
      </header>

      <Separator className="my-10" />

      <Section icon={<DatabaseIcon className="text-primary size-5" aria-hidden />} title="資料來源">
        <p className="text-muted-foreground text-sm leading-relaxed">
          遊戲資料與素材取自遊戲用戶端與社群整理，公式為個人整理，僅供參考，以遊戲內顯示為準。
          著作權、下架流程與隱私說明請見{" "}
          <Link
            href="/legal"
            className="text-foreground underline underline-offset-4 hover:text-primary"
          >
            免責與著作權聲明
          </Link>
          。
        </p>
      </Section>

      <Separator className="my-10" />

      <Section icon={<CpuIcon className="text-primary size-5" aria-hidden />} title="技術棧">
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
