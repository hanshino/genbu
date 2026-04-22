"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { MouseEvent } from "react";
import type { Phase2Type } from "@/lib/constants/item-types";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

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
    <Breadcrumb>
      <BreadcrumbList>
        <BreadcrumbItem>
          <BreadcrumbLink
            render={
              <Link href={fallbackHref} onClick={handleClick} />
            }
          >
            排行榜
          </BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbSeparator />
        <BreadcrumbItem>
          <BreadcrumbPage>比較 · {activeType}</BreadcrumbPage>
        </BreadcrumbItem>
      </BreadcrumbList>
    </Breadcrumb>
  );
}
