"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { MenuIcon, XIcon } from "lucide-react";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/", label: "首頁" },
  { href: "/items", label: "道具" },
  { href: "/ranking", label: "排行榜" },
  { href: "/compare", label: "比較" },
  { href: "/skills", label: "技能" },
  { href: "/monsters", label: "怪物" },
  { href: "/compounds", label: "煉化" },
  { href: "/tools", label: "工具" },
];

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function Navbar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <header className="border-b border-border/60 bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-40">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
        <Link href="/" className="flex items-baseline gap-2 tracking-tight">
          <span className="font-heading text-xl font-bold text-primary">玄武</span>
          <span className="text-muted-foreground text-xs">Genbu</span>
        </Link>

        <nav className="hidden items-center gap-1 text-sm md:flex">
          {navItems.map((item) => {
            const active = isActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  buttonVariants({
                    variant: active ? "secondary" : "ghost",
                    size: "sm",
                  }),
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
          <DialogPrimitive.Trigger
            aria-label="開啟選單"
            className={cn(buttonVariants({ variant: "ghost", size: "icon-sm" }), "md:hidden")}
          >
            <MenuIcon className="size-5" aria-hidden />
          </DialogPrimitive.Trigger>
          <DialogPrimitive.Portal>
            <DialogPrimitive.Backdrop className="fixed inset-0 z-50 bg-black/30 backdrop-blur-sm data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0" />
            <DialogPrimitive.Popup
              aria-label="網站導覽"
              className="fixed inset-y-0 right-0 z-50 flex w-72 max-w-[85vw] flex-col border-l border-border/60 bg-background p-4 shadow-xl duration-200 data-open:animate-in data-open:slide-in-from-right data-closed:animate-out data-closed:slide-out-to-right"
            >
              <div className="mb-4 flex items-center justify-between">
                <DialogPrimitive.Title className="flex items-baseline gap-2">
                  <span className="font-heading text-lg font-bold text-primary">玄武</span>
                  <span className="text-muted-foreground text-xs">Genbu</span>
                </DialogPrimitive.Title>
                <DialogPrimitive.Close
                  aria-label="關閉選單"
                  className="rounded-sm p-1 text-muted-foreground opacity-70 transition-opacity hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <XIcon className="size-4" aria-hidden />
                </DialogPrimitive.Close>
              </div>
              <nav className="flex flex-col gap-1">
                {navItems.map((item) => {
                  const active = isActive(pathname, item.href);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      aria-current={active ? "page" : undefined}
                      onClick={() => setOpen(false)}
                      className={cn(
                        "rounded-md px-3 py-2.5 text-base transition-colors",
                        active
                          ? "bg-secondary font-medium text-secondary-foreground"
                          : "text-foreground hover:bg-muted",
                      )}
                    >
                      {item.label}
                    </Link>
                  );
                })}
              </nav>
            </DialogPrimitive.Popup>
          </DialogPrimitive.Portal>
        </DialogPrimitive.Root>
      </div>
    </header>
  );
}
