"use client";

import { useSyncExternalStore } from "react";
import { Menu as MenuPrimitive } from "@base-ui/react/menu";
import { CheckIcon, MonitorIcon, MoonIcon, SunIcon } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Theme = "light" | "dark" | "system";

const STORAGE_KEY = "theme";

const options = [
  { value: "light", label: "宣紙", Icon: SunIcon },
  { value: "dark", label: "玄夜", Icon: MoonIcon },
  { value: "system", label: "跟隨系統", Icon: MonitorIcon },
] as const;

// 判斷與套用主題只在 layout.tsx 的 inline script（window.__applyTheme）；
// 這裡只管使用者手動選擇後的寫入與通知。
declare global {
  interface Window {
    __applyTheme?: () => void;
  }
}

const listeners = new Set<() => void>();

function getTheme(): Theme {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return v === "light" || v === "dark" ? v : "system";
  } catch {
    return "system";
  }
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  window.addEventListener("storage", cb); // 其他分頁改了主題
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", cb);
  };
}

function setTheme(theme: Theme) {
  try {
    if (theme === "system") localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // 無痕模式等情況存不了，至少這次瀏覽有效
  }
  window.__applyTheme?.();
  listeners.forEach((l) => l());
}

export function ThemeToggle() {
  // server 不知道使用者選了什麼，先當成跟隨系統；選單只在 client 打開，不會 mismatch。
  const theme = useSyncExternalStore(subscribe, getTheme, () => "system" as Theme);

  return (
    <MenuPrimitive.Root>
      <MenuPrimitive.Trigger
        aria-label="切換佈景主題"
        title="切換佈景主題"
        className={cn(
          buttonVariants({ variant: "ghost", size: "icon-sm" }),
          "text-muted-foreground hover:text-foreground data-popup-open:bg-secondary data-popup-open:text-foreground",
        )}
      >
        {/* 圖示跟著 html.dark 走（純 CSS），server 與 client 輸出一致 */}
        <SunIcon className="size-4 dark:hidden" aria-hidden />
        <MoonIcon className="hidden size-4 dark:block" aria-hidden />
      </MenuPrimitive.Trigger>
      <MenuPrimitive.Portal>
        <MenuPrimitive.Positioner align="end" sideOffset={6} className="isolate z-50">
          <MenuPrimitive.Popup
            className={cn(
              "bg-popover text-popover-foreground ring-foreground/10 origin-(--transform-origin) min-w-36 rounded-lg p-1.5 shadow-md ring-1 outline-hidden",
              "data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95",
              "data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
              "data-[side=bottom]:slide-in-from-top-2",
            )}
          >
            <MenuPrimitive.RadioGroup value={theme} onValueChange={(v: Theme) => setTheme(v)}>
              {options.map(({ value, label, Icon }) => (
                <MenuPrimitive.RadioItem
                  key={value}
                  value={value}
                  className="data-highlighted:bg-muted data-checked:text-foreground text-muted-foreground flex cursor-pointer items-center gap-2.5 rounded-md px-3 py-1.5 text-sm transition-colors outline-hidden"
                >
                  <Icon className="size-4" aria-hidden />
                  <span className="flex-1">{label}</span>
                  <MenuPrimitive.RadioItemIndicator className="text-primary">
                    <CheckIcon className="size-3.5" aria-hidden />
                  </MenuPrimitive.RadioItemIndicator>
                </MenuPrimitive.RadioItem>
              ))}
            </MenuPrimitive.RadioGroup>
          </MenuPrimitive.Popup>
        </MenuPrimitive.Positioner>
      </MenuPrimitive.Portal>
    </MenuPrimitive.Root>
  );
}
