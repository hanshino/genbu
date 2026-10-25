"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

// 記住「上一個站內網址」：返回連結要知道上一頁是不是本站、是不是某個列表。
// history.length 分不出來（從 Google 進來也 > 1），document.referrer 在 Next 的 client 導航不會更新。
let current: string | null = null;
let previous: string | null = null;

function sameOriginReferrer(): string | null {
  try {
    const ref = new URL(document.referrer);
    return ref.origin === window.location.origin ? ref.pathname + ref.search : null;
  } catch {
    return null;
  }
}

/** 掛在 layout 一次。只追 pathname：列表改篩選只換 query，不算換頁。 */
export function NavigationTracker() {
  const pathname = usePathname();
  useEffect(() => {
    const url = window.location.pathname + window.location.search;
    if (current === null) {
      previous = sameOriginReferrer();
    } else {
      // 同一頁重跑（Strict Mode 的雙重 effect）不算換頁
      if (new URL(current, "http://x").pathname === window.location.pathname) return;
      previous = current;
    }
    current = url;
  }, [pathname]);
  return null;
}

/** 上一個站內網址（pathname + search）；從站外進來或直接開啟時為 null。 */
export function getPreviousUrl(): string | null {
  return previous;
}

/** 上一頁是不是站內的 href（只比 pathname）。是的話 history.back() 能還原它的篩選與捲動位置。 */
export function cameFrom(href: string): boolean {
  if (!previous) return false;
  return new URL(previous, "http://x").pathname === new URL(href, "http://x").pathname;
}
