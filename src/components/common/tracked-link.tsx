"use client";

import Link from "next/link";
import type { ComponentProps } from "react";
import { track } from "@/lib/analytics/track";

type EventProps = Record<string, string | number | boolean>;

interface TrackedLinkProps extends ComponentProps<typeof Link> {
  event: string;
  eventProps?: EventProps;
}

/**
 * next/link 包一層埋點。只接事件名稱＋可序列化 props（不接函式），
 * 讓呼叫端可以是 Server Component，直接傳字串/數字跨過 RSC boundary，
 * 不必為了一個 onClick 把整個父層拖成 client component。
 */
export function TrackedLink({ event, eventProps, onClick, ...props }: TrackedLinkProps) {
  return (
    <Link
      {...props}
      onClick={(e) => {
        onClick?.(e);
        track(event, eventProps);
      }}
    />
  );
}
