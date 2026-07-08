import type { Metadata } from "next";
import { HistoryIcon } from "lucide-react";
import { loadChangelog } from "@/lib/changelog/load";
import { VersionCard } from "@/components/changelog/version-card";

// 正式機為 Next standalone，runner 無 src/；必須靜態渲染讓 fs 讀取發生在 build 階段。
export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "更新紀錄 | 玄武",
  description: "武林同萌傳資料庫的版本更新紀錄 — 每次資料更新的新增、變更與下架項目。",
};

export default function ChangelogPage() {
  const entries = loadChangelog();
  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:py-14">
      <header className="mb-8 flex items-center gap-3">
        <HistoryIcon className="text-primary size-6" aria-hidden />
        <div>
          <h1 className="font-heading text-2xl font-bold tracking-tight sm:text-3xl">更新紀錄</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            資料庫每次更新的異動摘要，對齊遊戲版本。
          </p>
        </div>
      </header>

      {entries.length === 0 ? (
        <p className="text-muted-foreground text-sm">尚無更新紀錄。</p>
      ) : (
        <div className="space-y-6">
          {entries.map((e) => (
            <VersionCard key={`${e.date}-${e.version}`} entry={e} />
          ))}
        </div>
      )}
    </div>
  );
}
