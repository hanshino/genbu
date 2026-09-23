import { PenLineIcon } from "lucide-react";
import { cn } from "@/lib/utils";

// ponytail: 目前只有一位作者，簡介寫死；多作者時改成查表。
const BIO = "老玩家，在巴哈姆特寫過回鍋攻略。這裡是我重新走一次的紀錄。";

export function AuthorCard({ name = "罕", className }: { name?: string; className?: string }) {
  return (
    <div
      className={cn("bg-card flex items-center gap-3.5 rounded-xl border px-4 py-3.5", className)}
    >
      <span
        aria-hidden
        className="border-primary text-primary font-heading grid size-12 shrink-0 -rotate-3 place-items-center rounded-[9px] border-2 text-2xl"
      >
        {name.slice(0, 1)}
      </span>
      <span className="min-w-0">
        <span className="font-heading flex items-center gap-2 text-base">
          {name}
          <PenLineIcon className="text-muted-foreground size-3.5" aria-hidden />
        </span>
        <span className="text-muted-foreground block text-[13px] leading-relaxed">{BIO}</span>
      </span>
    </div>
  );
}
