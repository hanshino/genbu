"use client";

import { useEffect, useState } from "react";
import { CheckIcon, CopyIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * 複製攤主名稱，貼進遊戲內搜尋。
 *
 * clipboard API 在非 https、權限被拒或舊瀏覽器上會丟錯或不存在，一律吞掉改顯示「無法複製」，
 * 名稱本身就印在旁邊，玩家還能自己選取。
 */
export function CopyNameButton({ name }: { name: string }) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");

  useEffect(() => {
    if (state === "idle") return;
    const timer = setTimeout(() => setState("idle"), 2000);
    return () => clearTimeout(timer);
  }, [state]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(name);
      setState("copied");
    } catch {
      setState("failed");
    }
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="xs"
      onClick={copy}
      aria-label={`複製攤主名稱 ${name}`}
      className="bg-background"
    >
      {state === "copied" ? <CheckIcon aria-hidden /> : <CopyIcon aria-hidden />}
      <span aria-live="polite">
        {state === "copied" ? "已複製" : state === "failed" ? "無法複製" : "複製"}
      </span>
    </Button>
  );
}
