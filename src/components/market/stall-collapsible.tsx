"use client";

import type { ReactNode } from "react";
import { ChevronDownIcon } from "lucide-react";
import { Collapsible, CollapsiblePanel, CollapsibleTrigger } from "@/components/ui/collapsible";

/** 攤位卡片的展開區：預設收合，從道具頁招牌連過來的那一攤預設展開。 */
export function StallCollapsible({
  defaultOpen,
  label,
  summary,
  children,
}: {
  defaultOpen: boolean;
  /** 給螢幕閱讀器的按鈕名稱，例如「缺錢 便宜賣的 9 筆掛單」 */
  label: string;
  summary: ReactNode;
  children: ReactNode;
}) {
  return (
    <Collapsible defaultOpen={defaultOpen}>
      <CollapsibleTrigger
        aria-label={label}
        className="group flex items-center gap-3 rounded-md px-1 py-1.5 hover:bg-muted/50"
      >
        <span className="min-w-0 flex-1">{summary}</span>
        <ChevronDownIcon
          className="size-4 shrink-0 text-muted-foreground transition-transform group-data-[panel-open]:rotate-180"
          aria-hidden
        />
      </CollapsibleTrigger>
      <CollapsiblePanel>
        <div className="pt-3">{children}</div>
      </CollapsiblePanel>
    </Collapsible>
  );
}
