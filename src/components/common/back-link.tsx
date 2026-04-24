"use client";

import { useRouter } from "next/navigation";
import { ChevronLeftIcon } from "lucide-react";

// 返回連結：優先走 history.back() 還原列表的 page/filter/scroll 狀態。
// 若本 tab 是直接進 detail（無 history），fallback 到 href。
export function BackLink({ href, children }: { href: string; children: React.ReactNode }) {
  const router = useRouter();

  function handleClick(e: React.MouseEvent<HTMLAnchorElement>) {
    if (typeof window === "undefined") return;
    if (window.history.length > 1) {
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
