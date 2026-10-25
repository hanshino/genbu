"use client";

import { useRouter } from "next/navigation";
import { ChevronLeftIcon } from "lucide-react";
import { getPreviousUrl } from "@/lib/nav-history";

// 返回連結：上一頁是本站時走 history.back()，還原列表的 page/filter/scroll 狀態；
// 從站外（例如搜尋引擎）或直接開啟時 fallback 到 href，不會把人送出網站。
// 文案固定「返回上一頁」：實際行為多半是 history.back()，寫死目的地會跟實際去處不符。
export function BackLink({
  href,
  children = "返回上一頁",
}: {
  href: string;
  children?: React.ReactNode;
}) {
  const router = useRouter();

  function handleClick(e: React.MouseEvent<HTMLAnchorElement>) {
    if (getPreviousUrl() !== null) {
      e.preventDefault();
      router.back();
    }
  }

  return (
    <a
      href={href}
      onClick={handleClick}
      className="inline-flex items-center gap-1 hover:underline"
    >
      <ChevronLeftIcon className="size-3.5" aria-hidden />
      {children}
    </a>
  );
}
