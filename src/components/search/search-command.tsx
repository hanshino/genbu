"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { SearchIcon, XIcon } from "lucide-react";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { buttonVariants } from "@/components/ui/button";
import { Autocomplete, AutocompleteInput } from "@/components/ui/autocomplete";
import { Kbd } from "@/components/ui/kbd";
import {
  SearchSuggestionList,
  rowToString,
  useSearchSuggestions,
} from "@/components/search/global-search";
import { cn } from "@/lib/utils";

// navbar 的全站搜尋：觸發鈕 + 搜尋面板 + 快捷鍵（/、Ctrl/⌘+K）。
// 首頁與 /search 本身就有大搜尋框，這兩頁不放觸發鈕，快捷鍵改成聚焦頁面上的框。

function isEditable(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName);
}

/** 全站搜尋快捷鍵。onTrigger 回傳前已 preventDefault。 */
export function useSearchHotkey(onTrigger: () => void) {
  const handler = useRef(onTrigger);
  useEffect(() => {
    handler.current = onTrigger;
  });

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const modK = (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k";
      const slash =
        e.key === "/" && !e.metaKey && !e.ctrlKey && !e.altKey && !isEditable(e.target);
      if (!modK && !slash) return;
      e.preventDefault();
      handler.current();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);
}

/** 頁面上已有的全站搜尋框（首頁、/search） */
export function focusPageSearch() {
  const input = document.querySelector<HTMLInputElement>('form[role="search"] input[name="q"]');
  input?.focus();
  input?.select();
}

export function SearchTrigger({ onOpen, compact }: { onOpen: () => void; compact?: boolean }) {
  if (compact) {
    return (
      <button
        type="button"
        aria-label="搜尋"
        onClick={onOpen}
        className={cn(buttonVariants({ variant: "ghost", size: "icon-sm" }))}
      >
        <SearchIcon className="size-5" aria-hidden />
      </button>
    );
  }
  return (
    <button
      type="button"
      aria-label="搜尋"
      aria-keyshortcuts="/ Control+K Meta+K"
      onClick={onOpen}
      className={cn(
        buttonVariants({ variant: "outline", size: "sm" }),
        "text-muted-foreground hover:text-foreground lg:w-44 lg:justify-start",
      )}
    >
      <SearchIcon aria-hidden />
      <span className="hidden flex-1 text-left font-normal lg:inline">搜尋…</span>
      <Kbd className="hidden lg:inline-flex">/</Kbd>
    </button>
  );
}

export function SearchDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop className="fixed inset-0 z-50 bg-black/30 backdrop-blur-sm data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0" />
        <DialogPrimitive.Popup
          className={cn(
            "fixed inset-0 z-50 flex flex-col bg-background duration-150",
            "sm:inset-auto sm:top-[12vh] sm:left-1/2 sm:max-h-[70vh] sm:w-full sm:max-w-xl sm:-translate-x-1/2 sm:rounded-xl sm:border sm:border-border/60 sm:bg-popover sm:shadow-xl",
            "data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0 sm:data-open:zoom-in-95 sm:data-closed:zoom-out-95",
          )}
        >
          <DialogPrimitive.Title className="sr-only">搜尋全站</DialogPrimitive.Title>
          {/* 關閉時卸載，下次開啟是乾淨的輸入框 */}
          {open && <SearchPanel onClose={() => onOpenChange(false)} />}
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

function SearchPanel({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const { query, trimmed, active, rows, setQuery } = useSearchSuggestions();

  return (
    <form
      action="/search"
      role="search"
      className="flex min-h-0 flex-1 flex-col"
      onSubmit={(e) => {
        e.preventDefault();
        if (!trimmed) return;
        onClose();
        router.push(`/search?q=${encodeURIComponent(trimmed)}`);
      }}
    >
      <Autocomplete
        name="q"
        mode="none"
        inline
        open
        items={rows}
        value={query}
        onValueChange={setQuery}
        itemToStringValue={rowToString}
      >
        <div className="flex items-center gap-2 border-b border-border/60 p-3">
          <AutocompleteInput
            type="text"
            inputMode="search"
            enterKeyHint="search"
            placeholder="搜尋道具、技能、怪物、頁面…"
            aria-label="搜尋全站"
            autoFocus
            className="h-10 flex-1 text-base sm:text-sm"
            showClear
          />
          {/* 沒有反白項目時 Base UI 讓 Enter 走表單原生送出；有 submit 鈕才保證會送出 */}
          <button type="submit" tabIndex={-1} aria-hidden className="sr-only" />
          <DialogPrimitive.Close
            aria-label="關閉搜尋"
            className={cn(buttonVariants({ variant: "ghost", size: "icon-sm" }))}
          >
            <XIcon aria-hidden />
          </DialogPrimitive.Close>
        </div>
        {/* inline 模式沒有 popup，AutocompleteEmpty 依附 popup 的 data-empty 才會顯示，這裡自己畫 */}
        {active && rows.length === 0 && (
          <p className="py-10 text-center text-sm text-muted-foreground">
            找不到「{trimmed}」相關結果
          </p>
        )}
        {active && rows.length > 0 && (
          <SearchSuggestionList
            trimmed={trimmed}
            onPick={onClose}
            className="max-h-none min-h-0 flex-1 p-2 sm:max-h-[calc(70vh-4.5rem)]"
          />
        )}
      </Autocomplete>
    </form>
  );
}
