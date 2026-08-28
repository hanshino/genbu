import type { ReactNode } from "react";

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
      <div className="space-y-6">{children}</div>
    </section>
  );
}

/** 分組內的單一區塊（h3 層級），統一道具頁各來源／用途區塊的標題樣式。 */
export function ItemSubSection({
  title,
  summary,
  footer,
  children,
}: {
  title: string;
  summary?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="space-y-2">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h3 className="text-base font-medium">{title}</h3>
        {summary != null && <span className="text-xs text-muted-foreground">{summary}</span>}
      </div>
      {children}
      {footer != null && <p className="text-xs leading-relaxed text-muted-foreground">{footer}</p>}
    </section>
  );
}

/** LinkListRow 的容器；與 common/link-list 的 ul 樣式一致，只是標題交給 ItemSubSection。 */
export function ItemLinkList({ children }: { children: ReactNode }) {
  return (
    <ul className="divide-y divide-border/60 rounded-lg border border-border/60 bg-card">
      {children}
    </ul>
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
}): string | null {
  const parts: string[] = [];
  if (counts.drops > 0) parts.push(`怪物掉落（${counts.drops} 隻）`);
  if (counts.shops > 0) parts.push(`商店販售（${counts.shops} 家）`);
  if (counts.compounds > 0) parts.push(`煉化配方（${counts.compounds} 條）`);
  return parts.length > 0 ? parts.join(" · ") : null;
}
