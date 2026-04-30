"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { ChevronDownIcon, MenuIcon, XIcon } from "lucide-react";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { Menu as MenuPrimitive } from "@base-ui/react/menu";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type NavLink = { href: string; label: string };
type NavGroup = { label: string; items: NavLink[] };

const navGroups: NavGroup[] = [
  {
    label: "資料庫",
    items: [
      { href: "/items", label: "道具" },
      { href: "/skills", label: "技能" },
      { href: "/monsters", label: "怪物" },
      { href: "/missions", label: "任務" },
      { href: "/maps", label: "地圖" },
      { href: "/compounds", label: "煉化" },
    ],
  },
  {
    label: "裝備",
    items: [
      { href: "/ranking", label: "排行榜" },
      { href: "/compare", label: "比較" },
    ],
  },
];

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function isGroupActive(pathname: string, group: NavGroup) {
  return group.items.some((i) => isActive(pathname, i.href));
}

export function Navbar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <header className="border-border/60 bg-background/80 supports-[backdrop-filter]:bg-background/60 sticky top-0 z-40 border-b backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-4 px-4">
        <Link href="/" className="flex items-baseline gap-2 tracking-tight">
          <span className="font-heading text-primary text-xl font-bold">玄武</span>
          <span className="text-muted-foreground text-xs">Genbu</span>
        </Link>

        <nav className="hidden flex-1 items-center gap-1 text-sm md:flex">
          <DesktopLink href="/" label="首頁" pathname={pathname} />
          {navGroups.map((group) => (
            <DesktopGroup key={group.label} group={group} pathname={pathname} />
          ))}
          <DesktopLink href="/tools" label="工具" pathname={pathname} />
        </nav>

        <div className="ml-auto hidden md:block">
          <DesktopLink href="/about" label="關於" pathname={pathname} muted />
        </div>

        <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
          <DialogPrimitive.Trigger
            aria-label="開啟選單"
            className={cn(
              buttonVariants({ variant: "ghost", size: "icon-sm" }),
              "ml-auto md:hidden",
            )}
          >
            <MenuIcon className="size-5" aria-hidden />
          </DialogPrimitive.Trigger>
          <DialogPrimitive.Portal>
            <DialogPrimitive.Backdrop className="data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0 fixed inset-0 z-50 bg-black/30 backdrop-blur-sm" />
            <DialogPrimitive.Popup
              aria-label="網站導覽"
              className="border-border/60 bg-background data-open:animate-in data-open:slide-in-from-right data-closed:animate-out data-closed:slide-out-to-right fixed inset-y-0 right-0 z-50 flex w-72 max-w-[85vw] flex-col overflow-y-auto border-l p-4 shadow-xl duration-200"
            >
              <div className="mb-4 flex items-center justify-between">
                <DialogPrimitive.Title className="flex items-baseline gap-2">
                  <span className="font-heading text-primary text-lg font-bold">玄武</span>
                  <span className="text-muted-foreground text-xs">Genbu</span>
                </DialogPrimitive.Title>
                <DialogPrimitive.Close
                  aria-label="關閉選單"
                  className="text-muted-foreground focus-visible:ring-ring rounded-sm p-1 opacity-70 transition-opacity hover:opacity-100 focus-visible:ring-2 focus-visible:outline-none"
                >
                  <XIcon className="size-4" aria-hidden />
                </DialogPrimitive.Close>
              </div>

              <nav className="flex flex-col gap-4">
                <MobileLink
                  href="/"
                  label="首頁"
                  pathname={pathname}
                  onNavigate={() => setOpen(false)}
                />

                {navGroups.map((group) => (
                  <div key={group.label}>
                    <p className="text-muted-foreground px-3 pb-1.5 text-xs font-medium tracking-wider uppercase">
                      {group.label}
                    </p>
                    <div className="flex flex-col gap-1">
                      {group.items.map((item) => (
                        <MobileLink
                          key={item.href}
                          href={item.href}
                          label={item.label}
                          pathname={pathname}
                          onNavigate={() => setOpen(false)}
                        />
                      ))}
                    </div>
                  </div>
                ))}

                <MobileLink
                  href="/tools"
                  label="工具"
                  pathname={pathname}
                  onNavigate={() => setOpen(false)}
                />

                <div className="border-border/60 mt-2 border-t pt-3">
                  <MobileLink
                    href="/about"
                    label="關於"
                    pathname={pathname}
                    onNavigate={() => setOpen(false)}
                  />
                </div>
              </nav>
            </DialogPrimitive.Popup>
          </DialogPrimitive.Portal>
        </DialogPrimitive.Root>
      </div>
    </header>
  );
}

function DesktopLink({
  href,
  label,
  pathname,
  muted = false,
}: {
  href: string;
  label: string;
  pathname: string;
  muted?: boolean;
}) {
  const active = isActive(pathname, href);
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        buttonVariants({
          variant: active ? "secondary" : "ghost",
          size: "sm",
        }),
        muted && !active && "text-muted-foreground",
      )}
    >
      {label}
    </Link>
  );
}

function DesktopGroup({ group, pathname }: { group: NavGroup; pathname: string }) {
  const active = isGroupActive(pathname, group);
  return (
    <MenuPrimitive.Root>
      <MenuPrimitive.Trigger
        className={cn(
          buttonVariants({
            variant: active ? "secondary" : "ghost",
            size: "sm",
          }),
          "data-popup-open:bg-secondary data-popup-open:text-secondary-foreground gap-1",
        )}
      >
        {group.label}
        <ChevronDownIcon
          className="size-3.5 transition-transform duration-150 data-popup-open:rotate-180"
          aria-hidden
        />
      </MenuPrimitive.Trigger>
      <MenuPrimitive.Portal>
        <MenuPrimitive.Positioner align="start" sideOffset={6} className="isolate z-50">
          <MenuPrimitive.Popup
            className={cn(
              "bg-popover text-popover-foreground ring-foreground/10 origin-(--transform-origin) min-w-40 rounded-lg p-1.5 shadow-md ring-1 outline-hidden",
              "data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95",
              "data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
              "data-[side=bottom]:slide-in-from-top-2",
            )}
          >
            {group.items.map((item) => {
              const itemActive = isActive(pathname, item.href);
              return (
                <MenuPrimitive.Item
                  key={item.href}
                  render={<Link href={item.href} />}
                  className={cn(
                    "data-highlighted:bg-muted flex cursor-pointer items-center rounded-md px-3 py-1.5 text-sm transition-colors outline-hidden",
                    itemActive && "bg-secondary text-secondary-foreground font-medium",
                  )}
                >
                  {item.label}
                </MenuPrimitive.Item>
              );
            })}
          </MenuPrimitive.Popup>
        </MenuPrimitive.Positioner>
      </MenuPrimitive.Portal>
    </MenuPrimitive.Root>
  );
}

function MobileLink({
  href,
  label,
  pathname,
  onNavigate,
}: {
  href: string;
  label: string;
  pathname: string;
  onNavigate: () => void;
}) {
  const active = isActive(pathname, href);
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      onClick={onNavigate}
      className={cn(
        "rounded-md px-3 py-2.5 text-base transition-colors",
        active
          ? "bg-secondary text-secondary-foreground font-medium"
          : "text-foreground hover:bg-muted",
      )}
    >
      {label}
    </Link>
  );
}
