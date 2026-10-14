import { TableCell } from "@/components/ui/table";
import { cn } from "@/lib/utils";

// 可自選欄位的列表（/skills、/items、/monsters）共用的儲存格樣式。
// 列需加 `group/row`，固定欄才會跟著整列 hover 變色。

// 橫向捲動時固定在左側的欄位要有不透明底色。
const STICKY_BG =
  "bg-background group-hover/row:bg-[color-mix(in_oklch,var(--muted)_50%,var(--background))]";

/** 編號欄：只在 sm 以上固定，手機寬度只鎖名稱，留空間給右側數值。 */
export const STICKY_ID_COL = cn("w-[90px] min-w-[90px] sm:sticky sm:left-0 sm:z-10", STICKY_BG);

/** 名稱欄：永遠固定在左側；編號有顯示時 sm 以上往右讓出編號寬度。 */
export function stickyNameCol(idShown: boolean): string {
  return cn(
    "sticky left-0 z-10 shadow-[inset_-1px_0_0_var(--color-border)]",
    idShown && "sm:left-[90px]",
    STICKY_BG,
  );
}

/** 數值欄：靠右、等寬數字；null（呼叫端也可把「無此數值」轉成 null）顯示「—」。 */
export function NumericCell({ value }: { value: number | null | undefined }) {
  return (
    <TableCell className="text-right font-mono tabular-nums">
      {value == null ? <span className="text-muted-foreground">—</span> : value.toLocaleString()}
    </TableCell>
  );
}
