"use client";

import { useOptimistic, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Columns3Icon, RotateCcwIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  SKILL_BASE_COLUMNS,
  SKILL_NUMERIC_COLUMNS,
  SKILL_COLS_COOKIE,
  DEFAULT_SKILL_COLUMNS,
  isDefaultSkillColumns,
  parseSkillColumns,
  type SkillColumnKey,
} from "@/lib/constants/skill-columns";

const GROUPS = [
  { title: "基本欄位", columns: SKILL_BASE_COLUMNS },
  { title: "數值欄位", columns: SKILL_NUMERIC_COLUMNS },
] as const;

function writeCookie(cols: readonly SkillColumnKey[] | null) {
  document.cookie = cols
    ? `${SKILL_COLS_COOKIE}=${encodeURIComponent(cols.join(","))}; path=/; max-age=31536000; samesite=lax`
    : `${SKILL_COLS_COOKIE}=; path=/; max-age=0; samesite=lax`;
}

export function SkillColumnPicker({ columns }: { columns: readonly SkillColumnKey[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();
  // 勾選立即反映，不等 server 重新 render。
  const [selected, setSelected] = useOptimistic(columns);

  function apply(next: readonly SkillColumnKey[] | null) {
    const params = new URLSearchParams(searchParams.toString());
    // 等於預設就不寫進 URL / cookie，網址保持乾淨。
    const effective = next && !isDefaultSkillColumns(next) ? next : null;
    if (effective) params.set("cols", effective.join(","));
    else params.delete("cols");
    writeCookie(effective);
    const qs = params.toString();
    startTransition(() => {
      setSelected(next ?? DEFAULT_SKILL_COLUMNS);
      router.replace(`${pathname}${qs ? `?${qs}` : ""}`, { scroll: false });
    });
  }

  function toggle(key: SkillColumnKey, on: boolean) {
    const set = new Set(selected);
    if (on) set.add(key);
    else set.delete(key);
    // 重新跑一次 parse 取得固定的欄位順序。
    apply(parseSkillColumns([...set].join(",")));
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
      <PopoverContent align="end" className="w-64 gap-0 p-1.5">
        {GROUPS.map((g) => (
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
        <p className="px-2 pt-2 pb-1 text-xs leading-relaxed text-muted-foreground">
          數值欄皆為該技能最高等級的數值
        </p>
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
