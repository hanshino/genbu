import Link from "next/link";
import type { Metadata } from "next";
import { GlobalSearch } from "@/components/search/global-search";
import { buttonVariants } from "@/components/ui/button";
import { NAV_SECTIONS } from "@/lib/site-nav";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "找不到這一頁｜玄武",
  robots: { index: false },
};

// 資料更新後被移除的道具、怪物最常落到這裡，所以先給搜尋，再給幾個列表入口
const shortcuts = NAV_SECTIONS.find((s) => s.label === "資料庫")!.items.slice(0, 4);

export default function NotFound() {
  return (
    <div className="mx-auto flex max-w-xl flex-col items-center px-4 py-16 text-center sm:py-24">
      <p className="font-heading text-5xl font-bold text-primary tabular-nums">404</p>
      <h1 className="mt-3 text-2xl font-semibold tracking-tight">找不到這一頁</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        網址可能打錯了，或這筆資料在遊戲更新後已經移除。搜尋看看：
      </p>

      <GlobalSearch className="mt-6" />

      <div className="mt-6 flex flex-wrap justify-center gap-2">
        {shortcuts.map((s) => (
          <Link key={s.href} href={s.href} className={buttonVariants({ variant: "outline", size: "sm" })}>
            {s.title ?? s.label}
          </Link>
        ))}
        <Link href="/" className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}>
          回首頁
        </Link>
      </div>
    </div>
  );
}
