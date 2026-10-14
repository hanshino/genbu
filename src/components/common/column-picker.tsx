"use client";

import { useOptimistic, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Columns3Icon, RotateCcwIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { isDefaultColumns, parseColumns, type ColumnSet } from "@/lib/columns";

function writeCookie(name: string, cols: readonly string[] | null) {
  document.cookie = cols
    ? `${name}=${encodeURIComponent(cols.join(","))}; path=/; max-age=31536000; samesite=lax`
    : `${name}=; path=/; max-age=0; samesite=lax`;
}

/** 列表頁「顯示欄位」popover。選擇寫進 URL `cols` + cookie（set.cookie），等於預設時兩者都清掉。 */
export function ColumnPicker({ set, columns }: { set: ColumnSet; columns: readonly string[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();
  // 勾選立即反映，不等 server 重新 render。
  const [selected, setSelected] = useOptimistic(columns);

  const groups = [
    { title: "基本欄位", columns: set.base },
    { title: "數值欄位", columns: set.numeric },
  ];

  function apply(next: readonly string[] | null) {
    const params = new URLSearchParams(searchParams.toString());
    // 等於預設就不寫進 URL / cookie，網址保持乾淨。
    const effective = next && !isDefaultColumns(set, next) ? next : null;
    if (effective) params.set("cols", effective.join(","));
    else params.delete("cols");
    writeCookie(set.cookie, effective);
    const qs = params.toString();
    startTransition(() => {
      setSelected(next ?? set.defaults);
      router.replace(`${pathname}${qs ? `?${qs}` : ""}`, { scroll: false });
    });
  }

  function toggle(key: string, on: boolean) {
    const next = new Set(selected);
    if (on) next.add(key);
    else next.delete(key);
    // 重新跑一次 parse 取得固定的欄位順序。
    apply(parseColumns(set, [...next].join(",")));
  }

  return (
    <Popover>
      <PopoverTrigger
        render={<Button variant="outline" className="gap-1.5 self-end sm:ml-auto sm:self-auto" />}
      >
        <Columns3Icon aria-hidden />
        顯示欄位
        <Badge variant="secondary" className="h-5 min-w-5 px-1.5 tabular-nums">
          {selected.length + 1}
        </Badge>
      </PopoverTrigger>
      <PopoverContent align="end" className="max-h-[70vh] w-64 gap-0 overflow-y-auto p-1.5">
        {groups.map((g) => (
          <div key={g.title} role="group" aria-label={g.title}>
            <p className="px-2 pt-1.5 pb-1 text-xs text-muted-foreground">{g.title}</p>
            {g.columns.map((c) => {
              const checked = selected.includes(c.key);
              // 至少留一欄（名稱以外），避免 cols 變空字串時被當成「沒指定」而跳回預設。
              const locked = checked && selected.length === 1;
              return (
                <label
                  key={c.key}
                  className="flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 hover:bg-muted/50 has-data-disabled:cursor-not-allowed has-data-disabled:opacity-60"
                >
                  <Checkbox
                    className="size-4"
                    checked={checked}
                    disabled={locked}
                    onCheckedChange={(v) => toggle(c.key, v)}
                  />
                  {c.label}
                </label>
              );
            })}
          </div>
        ))}
        {set.note && (
          <p className="px-2 pt-2 pb-1 text-xs leading-relaxed text-muted-foreground">{set.note}</p>
        )}
        <Separator className="my-1" />
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start text-muted-foreground"
          onClick={() => apply(null)}
        >
          <RotateCcwIcon aria-hidden />
          重設為預設
        </Button>
      </PopoverContent>
    </Popover>
  );
}
