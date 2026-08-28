import Link from "next/link";
import { FunnelXIcon, RotateCcwIcon } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface EmptyResultProps {
  /** 資料名詞，例如「道具」「技能」「怪物」 */
  noun: string;
  /** 目前的搜尋字（可為空字串） */
  search: string;
  /** 清掉篩選後會有幾筆。undefined = 沒套篩選 / 本來就查無資料 */
  unfilteredTotal?: number;
  /** 清除篩選後要回到的列表路徑，例如 "/items" */
  basePath: string;
}

/**
 * 列表 0 筆的空狀態。
 *
 * 有套篩選、且清掉篩選後其實查得到東西時，改成「是篩選擋住了」的說明 + 一鍵清篩選；
 * 其他情況（含連搜尋字本身都查無資料）維持原本的一行純文字。
 */
export function EmptyResult({ noun, search, unfilteredTotal, basePath }: EmptyResultProps) {
  const overFiltered = unfilteredTotal != null && unfilteredTotal > 0;

  if (!overFiltered) {
    return (
      <div className="rounded-lg border border-border/60 bg-card px-6 py-12 text-center text-muted-foreground">
        找不到符合條件的{noun}
      </div>
    );
  }

  const clearHref = search ? `${basePath}?search=${encodeURIComponent(search)}` : basePath;

  return (
    <div className="rounded-lg border border-border/60 bg-card px-6 py-12 text-center">
      <div className="mx-auto flex max-w-md flex-col items-center gap-3">
        <span className="flex size-11 items-center justify-center rounded-full bg-chart-4/10 text-chart-4">
          <FunnelXIcon className="size-5" aria-hidden />
        </span>

        <p className="font-heading text-base text-foreground">篩選條件擋掉了所有結果</p>

        <p className="text-sm text-muted-foreground">
          {search ? (
            <>
              搜尋「
              <span className="font-medium text-foreground">{search}</span>
              」原本有{" "}
              <span className="font-medium text-foreground tabular-nums">
                {unfilteredTotal.toLocaleString()}
              </span>{" "}
              筆{noun}，是目前的篩選把它們全濾掉了。
            </>
          ) : (
            <>
              清除篩選後有{" "}
              <span className="font-medium text-foreground tabular-nums">
                {unfilteredTotal.toLocaleString()}
              </span>{" "}
              筆{noun}。
            </>
          )}
        </p>

        <Link
          href={clearHref}
          className={cn(buttonVariants({ variant: "outline", size: "sm" }), "mt-1 max-w-full")}
        >
          <RotateCcwIcon aria-hidden />
          {search ? <span className="truncate">清除篩選，保留「{search}」</span> : "清除全部篩選"}
        </Link>
      </div>
    </div>
  );
}
