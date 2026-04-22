"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { ChevronRightIcon } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useCompareTray } from "@/lib/hooks/use-compare-tray";

// The bar only earns its screen real estate on routes where the tray is
// actionable: ranking (add), item list + detail (add). On the home page it's
// noise, and on /compare itself it's redundant with the in-page tag pills.
function isRelevantRoute(pathname: string | null): boolean {
  if (!pathname) return false;
  return pathname === "/ranking" || pathname.startsWith("/items");
}

export function CompareBar() {
  const tray = useCompareTray();
  const pathname = usePathname();
  const visible = tray.ids.length > 0 && isRelevantRoute(pathname);

  // When the bar is visible, reserve bottom padding on <body> so its fixed
  // position does not cover the last row of table / chart content.
  useEffect(() => {
    if (typeof document === "undefined") return;
    document.body.classList.toggle("has-compare-bar", visible);
    return () => document.body.classList.remove("has-compare-bar");
  }, [visible]);

  if (!visible) return null;
  return (
    <div
      role="region"
      aria-label="比較盤"
      className="fixed bottom-4 left-1/2 z-40 -translate-x-1/2 rounded-full border border-border bg-background/95 px-4 py-2 shadow-lg backdrop-blur flex items-center gap-3 text-sm"
    >
      <span className="text-muted-foreground">
        比較盤：{tray.ids.length} 件
      </span>
      <Link
        href={`/compare?ids=${tray.ids.join(",")}`}
        className={cn(buttonVariants({ size: "sm" }))}
      >
        去比較
        <ChevronRightIcon aria-hidden />
      </Link>
      <Button
        variant="ghost"
        size="sm"
        onClick={tray.clear}
      >
        清空
      </Button>
    </div>
  );
}
