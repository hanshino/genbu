import type { ReactNode } from "react";
import { ChevronRightIcon, InfoIcon } from "lucide-react";
import { Collapsible, CollapsiblePanel, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

/**
 * 道具頁的資訊分組外框（h2 層級）。
 *
 * 分組本身不知道子區塊有沒有資料 —— 子區塊各自在無資料時回傳 null，
 * 因此「整組是否渲染」必須由 page 端先用資料筆數判斷，否則會留下空容器。
 */
export function ItemSectionGroup({
  id,
  title,
  icon,
  description,
  children,
}: {
  id: string;
  title: string;
  icon: ReactNode;
  description?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section aria-labelledby={id} className="space-y-4">
      <header className="space-y-1.5 border-b border-border/60 pb-3">
        <div className="flex items-center gap-2">
          <span
            className="flex size-7 shrink-0 items-center justify-center rounded-md border border-border/60 bg-muted/40 text-muted-foreground [&>svg]:size-4"
            aria-hidden
          >
            {icon}
          </span>
          <h2 id={id} className="text-xl font-semibold tracking-tight">
            {title}
          </h2>
        </div>
        {description != null && (
          <p className="text-xs leading-relaxed text-muted-foreground">{description}</p>
        )}
      </header>
      <div className="space-y-2">{children}</div>
    </section>
  );
}

/**
 * 分組內的單一區塊（h3 層級），一律預設收合；收合的標題列「筆數 · 重點」就是這組的目錄。
 *
 * 標題列要放 ⓘ 說明按鈕，所以展開按鈕只包標題與筆數，ⓘ 是它旁邊的兄弟元素（不能巢狀 button）。
 * 收合內容用 hiddenUntilFound 留在 HTML 裡：搜尋引擎抓得到，Ctrl+F 找到時會自動展開。
 */
export function ItemSubSection({
  title,
  count,
  highlight,
  note,
  children,
}: {
  title: string;
  /** 例：「63 隻」 */
  count: string;
  /** 例：「最低 40 金幣」，收合時讓人不用點開就知道重點 */
  highlight?: string | null;
  /** 區塊說明，收進 ⓘ */
  note?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Collapsible render={<section />}>
      <div className="flex items-start rounded-lg border border-border/60 bg-card transition-colors hover:bg-muted/50 sm:items-center">
        <h3 className="min-w-0 flex-1">
          <CollapsibleTrigger className="group flex flex-wrap items-center gap-x-2.5 gap-y-0.5 rounded-lg px-3 py-2.5 sm:flex-nowrap">
            <ChevronRightIcon
              className="size-4 shrink-0 text-muted-foreground transition-transform group-data-[panel-open]:rotate-90"
              aria-hidden
            />
            <span className="shrink-0 text-base font-medium">{title}</span>
            <span className="flex min-w-0 basis-full items-baseline gap-1.5 pl-6.5 text-xs text-muted-foreground sm:basis-auto sm:pl-0">
              <span className="shrink-0 font-mono">{count}</span>
              {highlight && (
                <>
                  <span className="shrink-0" aria-hidden>·</span>
                  <span className="truncate">{highlight}</span>
                </>
              )}
            </span>
          </CollapsibleTrigger>
        </h3>
        {note != null && (
          <Popover>
            <PopoverTrigger
              aria-label={`${title}說明`}
              className="m-1.5 flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none sm:my-0"
            >
              <InfoIcon className="size-3.5" aria-hidden />
            </PopoverTrigger>
            <PopoverContent align="end" className="text-xs leading-relaxed text-muted-foreground">
              {note}
            </PopoverContent>
          </Popover>
        )}
      </div>
      <CollapsiblePanel hiddenUntilFound>
        <div className="space-y-2 pt-2 pb-4">{children}</div>
      </CollapsiblePanel>
    </Collapsible>
  );
}

/**
 * 「如何取得」分組的途徑摘要文案。全部為 0 時回傳 null —— 呼叫端據此改走
 * 「查無來源」說明，而不是印出一個沒有內容的分組。
 */
export function summarizeSourceRoutes(counts: {
  drops: number;
  shops: number;
  compounds: number;
  missions?: number;
  npcDialogues?: number;
  otherDialogues?: boolean;
  mapEvents?: number;
  boxes?: number;
  mysteryBoxes?: number;
}): string | null {
  const parts: string[] = [];
  if (counts.drops > 0) parts.push(`怪物掉落（${counts.drops} 隻）`);
  if (counts.shops > 0) parts.push(`商店販售（${counts.shops} 家）`);
  if (counts.compounds > 0) parts.push(`煉化配方（${counts.compounds} 條）`);
  if (counts.missions) parts.push(`任務獎勵（${counts.missions} 個）`);
  if (counts.npcDialogues) parts.push(`NPC 對話（${counts.npcDialogues} 位）`);
  if (counts.otherDialogues) parts.push("其他對話（入口未明）");
  if (counts.mapEvents) parts.push(`地圖事件（${counts.mapEvents} 張地圖）`);
  if (counts.boxes) parts.push(`禮盒（${counts.boxes} 種）`);
  if (counts.mysteryBoxes) parts.push(`隨機寶箱（${counts.mysteryBoxes} 種）`);
  return parts.length > 0 ? parts.join(" · ") : null;
}
