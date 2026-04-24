"use client";

import { useRouter } from "next/navigation";

// 使用 router.replace 切換等級 → 不會在 history 堆新 entry。
// 這樣詳情頁的「返回技能列表」用 router.back() 會直接回到列表頁，而不是上一個選過的等級。
export function LevelSwitcher({
  skillId,
  levels,
  currentLevel,
}: {
  skillId: number;
  levels: readonly number[];
  currentLevel: number;
}) {
  const router = useRouter();
  if (levels.length <= 1) return null;
  return (
    <div className="flex flex-wrap items-center gap-1 text-xs">
      <span className="mr-1 text-muted-foreground">切換等級</span>
      {levels.map((lv) => {
        const isActive = lv === currentLevel;
        const href = `/skills/${skillId}?level=${lv}`;
        return (
          <a
            key={lv}
            href={href}
            aria-current={isActive ? "true" : undefined}
            onClick={(e) => {
              if (isActive) {
                e.preventDefault();
                return;
              }
              e.preventDefault();
              router.replace(href);
            }}
            className={
              isActive
                ? "rounded-md border border-primary bg-primary/10 px-2 py-0.5 font-medium text-primary"
                : "rounded-md border border-border/60 px-2 py-0.5 text-muted-foreground hover:bg-muted/50"
            }
          >
            {lv}
          </a>
        );
      })}
    </div>
  );
}
