"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Switch } from "@/components/ui/switch";

/** 把 9,999 萬以上的展示價掛單也列出來（畫面上寫「議價」）；狀態放在網址的 showcase。 */
export function ShowcaseSwitch({ checked }: { checked: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  return (
    <label className="inline-flex h-8 shrink-0 items-center gap-2 text-sm">
      <Switch
        checked={checked}
        onCheckedChange={(on) => {
          const params = new URLSearchParams(searchParams.toString());
          if (on) params.set("showcase", "1");
          else params.delete("showcase");
          for (const key of ["page", "stall", "item"]) params.delete(key);
          router.push(`${pathname}${params.size > 0 ? `?${params}` : ""}`, { scroll: false });
        }}
      />
      顯示展示價
    </label>
  );
}
