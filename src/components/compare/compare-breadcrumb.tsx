"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { MouseEvent } from "react";
import type { Phase2Type } from "@/lib/constants/item-types";

interface Props {
  activeType: Phase2Type;
}

export function CompareBreadcrumb({ activeType }: Props) {
  const router = useRouter();
  const fallbackHref = `/ranking?type=${encodeURIComponent(activeType)}`;

  const handleClick = (e: MouseEvent<HTMLAnchorElement>) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
    if (typeof window === "undefined") return;
    // Prefer router.back() when the user arrived from the ranking page — it
    // restores their scroll, sort, weights, and filter state (none of which
    // live in the URL today). Direct visits / shares fall through to Link.
    try {
      const ref = document.referrer;
      if (!ref) return;
      const url = new URL(ref);
      if (url.origin !== window.location.origin) return;
      if (!url.pathname.startsWith("/ranking")) return;
      if (window.history.length <= 1) return;
      e.preventDefault();
      router.back();
    } catch {
      // fall through to default Link navigation
    }
  };

  return (
    <nav aria-label="breadcrumb" className="text-sm text-muted-foreground">
      <ol className="flex flex-wrap items-center gap-1.5">
        <li>
          <Link
            href={fallbackHref}
            onClick={handleClick}
            className="transition-colors hover:text-foreground focus-visible:text-foreground focus-visible:outline-none focus-visible:underline"
          >
            排行榜
          </Link>
        </li>
        <li aria-hidden="true" className="text-muted-foreground/50">
          ›
        </li>
        <li className="text-foreground">比較 · {activeType}</li>
      </ol>
    </nav>
  );
}
