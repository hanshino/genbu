"use client";

import { track } from "@/lib/analytics/track";

interface TrackedLoginLinkProps extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
  source: string;
}

/**
 * 登入連結的共用包裝，只負責點擊時送出 login_start；
 * 視覺與原本的 <a> 完全一致，不動 className。
 */
export function TrackedLoginLink({ source, onClick, ...props }: TrackedLoginLinkProps) {
  return (
    <a
      {...props}
      onClick={(event) => {
        onClick?.(event);
        track("login_start", { source });
      }}
    />
  );
}
