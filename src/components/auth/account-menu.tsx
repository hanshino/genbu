"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Menu as MenuPrimitive } from "@base-ui/react/menu";
import { ChevronDownIcon, LogInIcon, LogOutIcon, UserIcon } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { track } from "@/lib/analytics/track";
import { AccountUser, IdentityBlock, IdentityTag, loginHref } from "./account";

/** 登入後導回目前這一頁（含查詢字串），玩家不會被丟回首頁。 */
function useReturnTo() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const query = searchParams.toString();
  // 已經在 /login 就導回首頁，不然登入完又回到登入頁。
  if (pathname === "/login") return searchParams.get("returnTo") || "/";
  return query ? `${pathname}?${query}` : pathname;
}

export function AccountMenu({ user }: { user: AccountUser | null }) {
  const returnTo = useReturnTo();

  if (!user) {
    return (
      <a
        href={loginHref(returnTo)}
        onClick={() => track("login_start", { source: "navbar" })}
        className={cn(buttonVariants({ variant: "outline", size: "sm" }), "gap-1.5")}
      >
        <LogInIcon aria-hidden />
        登入
      </a>
    );
  }

  return (
    <UserMenu user={user}>
      <MenuPrimitive.Trigger
        className={cn(
          buttonVariants({ variant: "ghost", size: "sm" }),
          "data-popup-open:bg-secondary data-popup-open:text-secondary-foreground gap-2 pl-1.5",
        )}
      >
        <IdentityBlock {...user} />
        <span className="flex items-baseline gap-1">
          <span className="max-w-32 truncate font-medium">{user.nickname}</span>
          <IdentityTag tag={user.tag} className="text-[11px]" />
        </span>
        <ChevronDownIcon
          className="text-muted-foreground size-3.5 transition-transform duration-150 data-popup-open:rotate-180"
          aria-hidden
        />
      </MenuPrimitive.Trigger>
    </UserMenu>
  );
}

/** 手機版：側欄開關旁只放色塊，名字留給側欄裡完整顯示。 */
export function AccountMenuCompact({ user }: { user: AccountUser | null }) {
  const returnTo = useReturnTo();

  if (!user) {
    return (
      <a
        href={loginHref(returnTo)}
        aria-label="登入"
        onClick={() => track("login_start", { source: "navbar" })}
        className={cn(buttonVariants({ variant: "outline", size: "icon-sm" }))}
      >
        <LogInIcon aria-hidden />
      </a>
    );
  }

  return (
    <UserMenu user={user}>
      <MenuPrimitive.Trigger
        aria-label={`使用者選單：${user.nickname} #${user.tag}`}
        className={cn(
          buttonVariants({ variant: "ghost", size: "icon-sm" }),
          "data-popup-open:bg-secondary",
        )}
      >
        <IdentityBlock {...user} />
      </MenuPrimitive.Trigger>
    </UserMenu>
  );
}

function UserMenu({ user, children }: { user: AccountUser; children: React.ReactNode }) {
  return (
    <MenuPrimitive.Root>
      {children}
      <MenuPrimitive.Portal>
        <MenuPrimitive.Positioner align="end" sideOffset={6} className="isolate z-50">
          <MenuPrimitive.Popup
            className={cn(
              "bg-popover text-popover-foreground ring-foreground/10 origin-(--transform-origin) min-w-44 rounded-lg p-1.5 shadow-md ring-1 outline-hidden",
              "data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95",
              "data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
              "data-[side=bottom]:slide-in-from-top-2",
            )}
          >
            <MenuPrimitive.Item
              render={<Link href="/me" />}
              className="data-highlighted:bg-muted flex cursor-pointer items-center gap-2.5 rounded-md px-3 py-1.5 text-sm transition-colors outline-hidden"
            >
              <UserIcon className="text-muted-foreground size-4" aria-hidden />
              個人設定
            </MenuPrimitive.Item>
            <MenuPrimitive.Separator className="bg-border my-1.5 h-px" />
            <LogoutItem nickname={user.nickname} />
          </MenuPrimitive.Popup>
        </MenuPrimitive.Positioner>
      </MenuPrimitive.Portal>
    </MenuPrimitive.Root>
  );
}

function LogoutItem({ nickname }: { nickname: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  return (
    <MenuPrimitive.Item
      disabled={pending}
      // 登出要打 API，讓選單等回應再關，失敗時才不會關掉卻仍是登入狀態。
      closeOnClick={false}
      onClick={async (event) => {
        event.preventDefault();
        setPending(true);
        try {
          const response = await fetch("/api/auth/logout", { method: "POST" });
          if (!response.ok) throw new Error("logout failed");
          // 伺服器端資料（navbar 的使用者）要重抓，不能只靠 client 狀態。
          router.replace("/");
          router.refresh();
        } catch {
          setPending(false);
        }
      }}
      className="data-highlighted:bg-muted data-highlighted:text-foreground text-muted-foreground flex w-full cursor-pointer items-center gap-2.5 rounded-md px-3 py-1.5 text-sm transition-colors outline-hidden data-disabled:pointer-events-none data-disabled:opacity-50"
    >
      <LogOutIcon className="size-4" aria-hidden />
      {pending ? "登出中…" : "登出"}
      <span className="sr-only">（目前身分 {nickname}）</span>
    </MenuPrimitive.Item>
  );
}
