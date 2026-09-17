"use client";

import { Toggle as TogglePrimitive } from "@base-ui/react/toggle";
import { ToggleGroup as ToggleGroupPrimitive } from "@base-ui/react/toggle-group";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

/**
 * 分段控制（segmented control）。視覺對齊 TabsList/TabsTrigger，
 * 但不綁面板，適合「切換同一塊內容的顯示條件」這種用途。
 */
function ToggleGroup({ className, ...props }: ToggleGroupPrimitive.Props) {
  return (
    <ToggleGroupPrimitive
      data-slot="toggle-group"
      className={cn(
        "inline-flex w-fit items-center gap-0.5 rounded-lg border border-border/60 bg-secondary p-[3px] text-muted-foreground",
        className,
      )}
      {...props}
    />
  );
}

const toggleGroupItemVariants = cva(
  "inline-flex select-none items-center justify-center rounded-md border border-transparent font-medium whitespace-nowrap transition-colors outline-none hover:bg-accent/70 hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 data-pressed:bg-card data-pressed:text-foreground data-pressed:shadow-sm [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-3.5",
  {
    variants: {
      size: {
        default: "h-7 gap-1.5 px-3 text-sm",
        sm: "h-6 gap-1 px-2.5 text-xs",
        /** 兩行標籤用（主名稱 + 副名稱），高度交給內容撐開。 */
        stacked: "flex-col items-start gap-0 px-2.5 py-1 text-[13px] leading-tight",
      },
    },
    defaultVariants: { size: "default" },
  },
);

function ToggleGroupItem({
  className,
  size,
  ...props
}: TogglePrimitive.Props & VariantProps<typeof toggleGroupItemVariants>) {
  return (
    <TogglePrimitive
      data-slot="toggle-group-item"
      className={cn(toggleGroupItemVariants({ size }), className)}
      {...props}
    />
  );
}

export { ToggleGroup, ToggleGroupItem };
