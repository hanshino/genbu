import { cn } from "@/lib/utils";

/** navbar / 頁面只需要顯示用的欄位，sub 不送到 client。 */
export type AccountUser = { nickname: string; tag: string };

/** 後端首次登入時寫入的預設暱稱（callback route）。 */
export const DEFAULT_NICKNAME = "英雄";

/**
 * 辨識碼決定色塊配色，所以同名玩家只要辨識碼不同就不會長一樣。
 * 只收錄在宣紙底色上對比足夠的色票（--chart-4 鎏金太淺，讀不出來）。
 */
const TAG_COLORS = [
  "bg-chart-1/12 text-chart-1 ring-chart-1/25",
  "bg-chart-2/12 text-chart-2 ring-chart-2/25",
  "bg-chart-3/12 text-chart-3 ring-chart-3/25",
  "bg-chart-5/12 text-chart-5 ring-chart-5/25",
];

function tagColor(tag: string) {
  let hash = 0;
  for (let i = 0; i < tag.length; i++) hash = (hash * 31 + tag.charCodeAt(i)) >>> 0;
  return TAG_COLORS[hash % TAG_COLORS.length];
}

/** 暱稱首字色塊。純裝飾，可讀的身分資訊由旁邊的暱稱文字負責。 */
export function IdentityBlock({ nickname, tag, className }: AccountUser & { className?: string }) {
  // 取「字」而不是 UTF-16 單位，暱稱開頭是表情符號時才不會切成半個字。
  const initial = [...nickname.trim()][0] ?? "俠";
  return (
    <span
      aria-hidden
      className={cn(
        "font-heading flex size-6 shrink-0 items-center justify-center rounded-md text-[13px] leading-none font-bold ring-1",
        tagColor(tag),
        className,
      )}
    >
      {initial}
    </span>
  );
}

/** 辨識碼一律比暱稱弱一階：等寬、等寬數字、muted，不會被讀成名字的一部分。 */
export function IdentityTag({ tag, className }: { tag: string; className?: string }) {
  return (
    <span className={cn("text-muted-foreground font-mono tabular-nums tracking-tight", className)}>
      #{tag}
    </span>
  );
}

/**
 * 發起登入。returnTo 帶 welcome=1，callback 會原樣導回，
 * 首登提示才知道「這次是剛登入回來的」。returnTo 由後端再驗一次。
 */
export function loginHref(returnTo: string) {
  const target = new URL(returnTo, "https://genbu.invalid");
  target.searchParams.set("welcome", "1");
  const path = `${target.pathname}${target.search}${target.hash}`;
  return `/api/auth/line?returnTo=${encodeURIComponent(path)}`;
}
