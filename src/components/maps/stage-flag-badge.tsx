import { cn } from "@/lib/utils";
import { stageFlagLabel, stageFlagVariant } from "@/lib/constants/stage-flags";

const VARIANT_CLASS: Record<string, string> = {
  safe: "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  danger: "border-red-500/40 bg-red-500/10 text-red-700 dark:text-red-300",
  restrict: "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  info: "border-border/60 bg-muted/40 text-muted-foreground",
};

interface Props {
  flag: string;
  size?: "sm" | "xs";
  className?: string;
}

/**
 * STAGE_FLAG_* 用 colored chip 顯示。屬於 hand-rolled 而非 Badge variant 的原因：
 * 一個語意 (variant) 就要對到一組顏色，shadcn Badge 只有 default/secondary/outline。
 */
export function StageFlagBadge({ flag, size = "sm", className }: Props) {
  const variant = stageFlagVariant(flag);
  const label = stageFlagLabel(flag);
  return (
    <span
      title={flag}
      className={cn(
        "inline-flex items-center rounded-md border font-normal",
        size === "xs" ? "px-1.5 py-0 text-[0.7rem]" : "px-2 py-0.5 text-xs",
        VARIANT_CLASS[variant] ?? VARIANT_CLASS.info,
        className,
      )}
    >
      {label}
    </span>
  );
}
