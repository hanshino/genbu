"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  SKILL_FAMILY_ORDER,
  SKILL_SCHOOLS_BY_FAMILY,
  type SkillSchool,
} from "@/lib/constants/skill-picks";

// ?school=X 同步在 URL 上，重新整理 / 分享連結都保留選擇
export function SchoolSelect({ value }: { value: SkillSchool }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  function onChange(next: string | null) {
    if (!next || next === value) return;
    const params = new URLSearchParams(searchParams.toString());
    params.set("school", next);
    startTransition(() => {
      // replace 而非 push：切換流派不堆 history entry，按返回才會回到怪物列表
      router.replace(`?${params.toString()}`);
    });
  }

  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="h-8 w-[140px] sm:w-[160px]" aria-label="選擇流派">
        <SelectValue>{(v: unknown) => String(v ?? value)}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        {SKILL_FAMILY_ORDER.map((family) => (
          <SelectGroup key={family}>
            <SelectLabel>{family}</SelectLabel>
            {SKILL_SCHOOLS_BY_FAMILY[family].map((school) => (
              <SelectItem key={school} value={school}>
                {school}
              </SelectItem>
            ))}
          </SelectGroup>
        ))}
      </SelectContent>
    </Select>
  );
}
