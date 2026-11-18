"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { SearchIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

const ALL = "all";

/** /market 的搜尋與類型篩選，狀態都放在網址上（q、group），改了就回第一頁。 */
export function MarketFilters({
  initialQuery,
  group,
  groups,
  placeholder,
}: {
  initialQuery: string;
  group: string;
  /** 這次掃描裡實際出現的類型群組（沿用 itemTypeGroups 的 id 與標籤） */
  groups: { id: string; label: string }[];
  placeholder: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState(initialQuery);
  const [composing, setComposing] = useState(false);
  const [, startTransition] = useTransition();
  // 自己推上網址、還沒落地的 q。網址的 q 變成其中一個＝是自己打字造成的，不能回頭蓋掉輸入框
  //（網址落地時使用者可能已經又打了字）；不在裡面＝上一頁、下一頁等外部跳轉，輸入框要跟上。
  const pushedQueries = useRef<string[]>([]);

  function push(next: { q?: string; group?: string }) {
    const params = new URLSearchParams(searchParams.toString());
    const changed =
      (next.q !== undefined && next.q.trim() !== (params.get("q") ?? "")) ||
      (next.group !== undefined &&
        (next.group === ALL ? "" : next.group) !== (params.get("group") ?? ""));
    // 掛載時 debounce 也會跑一次；條件沒變就不要動網址，否則會洗掉頁碼與展開中的攤位。
    if (!changed) return;
    if (next.q !== undefined) {
      pushedQueries.current.push(next.q.trim());
      if (next.q.trim()) params.set("q", next.q.trim());
      else params.delete("q");
    }
    if (next.group !== undefined) {
      if (next.group && next.group !== ALL) params.set("group", next.group);
      else params.delete("group");
    }
    params.delete("page");
    params.delete("stall");
    startTransition(() => router.push(`${pathname}${params.size > 0 ? `?${params}` : ""}`));
  }

  useEffect(() => {
    const own = pushedQueries.current.indexOf(initialQuery);
    if (own >= 0) {
      pushedQueries.current.splice(0, own + 1);
      return;
    }
    pushedQueries.current = [];
    setQuery(initialQuery);
  }, [initialQuery]);

  // 打字停 300ms 才更新網址；注音選字中不送。
  useEffect(() => {
    if (composing) return;
    const timer = setTimeout(() => push({ q: query }), 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, composing]);

  return (
    <div className="flex flex-col gap-3">
      <div className="relative sm:max-w-xs">
        <SearchIcon
          className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <Input
          type="search"
          aria-label={placeholder}
          placeholder={placeholder}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onCompositionStart={() => setComposing(true)}
          onCompositionEnd={() => setComposing(false)}
          className="pl-8"
        />
      </div>
      {groups.length > 1 && (
        <ToggleGroup
          aria-label="道具類型"
          value={[group || ALL]}
          onValueChange={(value) => {
            if (value[0]) push({ group: value[0] });
          }}
          className="h-auto max-w-full flex-wrap"
        >
          <ToggleGroupItem value={ALL}>全部</ToggleGroupItem>
          {groups.map((g) => (
            <ToggleGroupItem key={g.id} value={g.id}>
              {g.label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      )}
    </div>
  );
}
