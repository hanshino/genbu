"use client";

import { useState, type ReactNode } from "react";
import { ChevronDownIcon } from "lucide-react";
import { Collapsible, CollapsiblePanel, CollapsibleTrigger } from "@/components/ui/collapsible";

/**
 * 道具頁掛單的展開區：預設收合，內容仍由伺服器渲染進 HTML（hiddenUntilFound），
 * 搜尋引擎抓得到，Ctrl+F 找到時會自動展開。
 */
export function ListingsCollapsible({ count, children }: { count: number; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="group flex min-h-11 items-center justify-between gap-3 rounded-lg border border-border/60 px-3 text-sm font-medium hover:bg-muted/50">
        {open ? "收合" : `顯示 ${count} 筆掛單`}
        <ChevronDownIcon
          className="size-4 shrink-0 text-muted-foreground transition-transform group-data-[panel-open]:rotate-180"
          aria-hidden
        />
      </CollapsibleTrigger>
      <CollapsiblePanel hiddenUntilFound>
        <div className="pt-3">{children}</div>
      </CollapsiblePanel>
    </Collapsible>
  );
}
