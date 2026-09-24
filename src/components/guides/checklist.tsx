"use client";

import { createContext, useContext, useSyncExternalStore, type ReactNode } from "react";
import { PackageIcon } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";

const PREFIX = "genbu:checklist:";
const EVENT = "genbu:checklist";

function subscribe(cb: () => void) {
  window.addEventListener("storage", cb);
  window.addEventListener(EVENT, cb);
  return () => {
    window.removeEventListener("storage", cb);
    window.removeEventListener(EVENT, cb);
  };
}

function parse(raw: string | null): string[] {
  try {
    const v = JSON.parse(raw ?? "[]");
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

/**
 * 伺服器與 hydration 期間一律回傳空字串（全未勾），
 * mount 後才讀 localStorage，不會 hydration mismatch。
 */
function useChecked(key: string) {
  const raw = useSyncExternalStore(
    subscribe,
    () => localStorage.getItem(key) ?? "",
    () => "",
  );
  const checked = parse(raw || null);
  const toggle = (label: string) => {
    const next = checked.includes(label) ? checked.filter((l) => l !== label) : [...checked, label];
    try {
      localStorage.setItem(key, JSON.stringify(next));
    } catch {
      // 無痕模式或容量滿：勾選只是方便，寫不進去就算了
    }
    window.dispatchEvent(new Event(EVENT));
  };
  return { checked, toggle };
}

const Ctx = createContext<ReturnType<typeof useChecked> | null>(null);

export function ChecklistRoot({
  storageKey,
  title = "材料清單",
  labels,
  children,
}: {
  storageKey: string;
  title?: string;
  labels: string[];
  children: ReactNode;
}) {
  const state = useChecked(PREFIX + storageKey);
  // 只算目前清單裡還存在的項目，文章改過品項後舊的勾選不會灌水
  const done = state.checked.filter((l) => labels.includes(l)).length;
  return (
    <div className="bg-card my-5 overflow-hidden rounded-xl border">
      <div className="bg-muted font-heading flex items-center gap-2.5 border-b px-4 py-3 text-[14.5px]">
        <PackageIcon className="text-muted-foreground size-4" aria-hidden />
        {title}
        <span className="text-muted-foreground ml-auto font-sans text-[12.5px]" aria-live="polite">
          已備齊 <span className="font-mono">{done}</span> /{" "}
          <span className="font-mono">{labels.length}</span>
        </span>
      </div>
      <Ctx.Provider value={state}>
        <ul className="divide-y">{children}</ul>
      </Ctx.Provider>
    </div>
  );
}

export function Check({ label, children }: { label: string; children?: ReactNode }) {
  const ctx = useContext(Ctx);
  const on = ctx?.checked.includes(label) ?? false;
  return (
    // 說明文字可能含資料標籤（button），不能包進 label，所以 label 用 contents 只包勾選框與品名
    <li className="hover:bg-muted/60 grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 px-4 py-3 motion-safe:transition-colors">
      <label className="contents cursor-pointer">
        <Checkbox checked={on} onCheckedChange={() => ctx?.toggle(label)} className="mt-1" />
        <span
          className={
            "font-heading cursor-pointer text-[15.5px] leading-snug" +
            (on ? " decoration-foreground/40 line-through" : "")
          }
        >
          {label}
        </span>
      </label>
      {children && (
        <span className="text-muted-foreground col-start-2 text-[13.5px] leading-relaxed [&_p]:m-0">
          {children}
        </span>
      )}
    </li>
  );
}
