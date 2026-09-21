"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { CircleCheckBigIcon, XIcon } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { track } from "@/lib/analytics/track";
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
  // ponytail: 一次性事件用 ref 守住，router.replace 觸發的 re-render 不會重送。
  const firedRef = useRef(false);

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

  // welcome=1 且有登入使用者才算真的登入成功；first_login 沿用「暱稱仍是預設值」判斷。
  useEffect(() => {
    if (welcome && user && !firedRef.current) {
      firedRef.current = true;
      track("login_success", { first_login: user.nickname === DEFAULT_NICKNAME });
    }
  }, [welcome, user]);

  // 帶了參數但不該顯示時，一樣把參數收掉，不留在網址上。
  useEffect(() => {
    if (welcome && !show) router.replace(cleanUrl, { scroll: false });
  }, [welcome, show, cleanUrl, router]);

  if (!show || !user) return null;

  return (
    // 用青瓷 --chart-2 不用朱砂 --primary：朱砂是主題的警示/主要動作色，
    // 淡紅底一眼看過去像錯誤，但這是登入成功的正向提示。
    <div
      role="status"
      className="border-chart-2/40 bg-chart-2/8 animate-in slide-in-from-top-2 fade-in-0 border-b duration-300"
    >
      <div className="mx-auto flex max-w-6xl items-start gap-3 px-4 py-2.5 sm:items-center">
        <CircleCheckBigIcon className="text-chart-2 mt-0.5 size-4 shrink-0 sm:mt-0" aria-hidden />

        {/* 窄版：文字一行、按鈕退到下一行靠左；sm 以上才拉回同一列並推到右邊。 */}
        <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
          <p className="text-sm">
            已登入。你目前的名字是 <span className="font-medium">{user.nickname}</span>
            <IdentityTag tag={user.tag} className="text-xs" />
            ，可以改成你習慣的。
          </p>
          <Link
            href="/me"
            className={cn(
              buttonVariants({ variant: "outline", size: "sm" }),
              "self-start sm:ml-auto",
            )}
          >
            修改暱稱
          </Link>
        </div>

        <button
          type="button"
          aria-label="關閉提示"
          onClick={() => {
            setDismissed(true);
            router.replace(cleanUrl, { scroll: false });
          }}
          className={cn(
            buttonVariants({ variant: "ghost", size: "icon-sm" }),
            "text-muted-foreground -mr-1 shrink-0",
          )}
        >
          <XIcon aria-hidden />
        </button>
      </div>
    </div>
  );
}
