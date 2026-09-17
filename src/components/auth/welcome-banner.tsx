"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { CircleCheckBigIcon, XIcon } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { AccountUser, DEFAULT_NICKNAME, IdentityTag } from "./account";

/**
 * 首登提示。登入連結會帶 ?welcome=1，callback 原樣導回，讀到這個參數才顯示。
 * 關掉就把參數從網址拿掉，重新整理不會再出現，不用另外存狀態。
 */
export function WelcomeBanner({ user }: { user: AccountUser | null }) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [dismissed, setDismissed] = useState(false);

  const welcome = searchParams.get("welcome") === "1";
  // 名字改過就不用再講「你有預設名字」；未登入卻帶著參數（登入失敗）也不顯示。
  const show = welcome && user?.nickname === DEFAULT_NICKNAME && !dismissed;

  const query = searchParams.toString();
  const cleanUrl = (() => {
    const next = new URLSearchParams(query);
    next.delete("welcome");
    const rest = next.toString();
    return rest ? `${pathname}?${rest}` : pathname;
  })();

  // 帶了參數但不該顯示時，一樣把參數收掉，不留在網址上。
  useEffect(() => {
    if (welcome && !show) router.replace(cleanUrl, { scroll: false });
  }, [welcome, show, cleanUrl, router]);

  if (!show || !user) return null;

  return (
    <div
      role="status"
      className="border-primary/25 bg-primary/8 animate-in slide-in-from-top-2 fade-in-0 border-b duration-300"
    >
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-3 gap-y-2 px-4 py-2.5">
        <CircleCheckBigIcon className="text-primary size-4 shrink-0" aria-hidden />
        <p className="text-sm">
          已登入。你目前的名字是 <span className="font-medium">{user.nickname}</span>
          <IdentityTag tag={user.tag} className="text-xs" />
          ，可以改成你習慣的。
        </p>
        <Link
          href="/me"
          onClick={() => setDismissed(true)}
          className={cn(buttonVariants({ variant: "outline", size: "sm" }), "ml-auto")}
        >
          修改暱稱
        </Link>
        <button
          type="button"
          aria-label="關閉提示"
          onClick={() => {
            setDismissed(true);
            router.replace(cleanUrl, { scroll: false });
          }}
          className={cn(
            buttonVariants({ variant: "ghost", size: "icon-sm" }),
            "text-muted-foreground",
          )}
        >
          <XIcon aria-hidden />
        </button>
      </div>
    </div>
  );
}
