"use client";

import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

type Values<K extends string> = Record<K, string>;

function read<K extends string>(search: string, keys: readonly K[]): Values<K> {
  const sp = new URLSearchParams(search);
  return Object.fromEntries(keys.map((k) => [k, sp.get(k) ?? ""])) as Values<K>;
}

function serialize<K extends string>(v: Values<K>, keys: readonly K[]): string {
  return keys.map((k) => v[k]).join("\u0000");
}

/**
 * 純 client 過濾列表的篩選狀態 ↔ URL query 同步（任務 / 地圖列表用）。
 *
 * - 值一律是字串，"" = 預設值，寫入時直接從 URL 移除該 key；其他 query 與 #hash 原樣保留。
 * - 每次變更「立即」native history.replaceState（Next 會同步 useSearchParams）：不堆 history、
 *   不打 server、不捲動。刻意不 debounce：reload 的目標 URL 在導航開始時就決定，
 *   beforeunload / pagehide 裡補寫都來不及（實測過），延遲寫入也會在 Back 後覆寫到上一個 entry。
 *   純 client 過濾本來每個按鍵就會 re-render，多一次 replaceState 成本可忽略。
 * - IME 組字中不寫，組字結束才寫完整文字，不打斷輸入法。
 * - 只在使用者操作時寫入，掛載時不寫，避免初始 render 蓋掉 URL。
 * - popstate（back/forward，含只差 #hash 的 entry）一律丟棄未寫入的組字並從當前 URL 重建；
 *   其他外部 URL 變動靠 useSearchParams 同步，自己寫入的回音則略過。
 *
 * `keys` 必須是 module-level 常數（參考穩定）。
 */
export function useUrlFilters<K extends string>(keys: readonly K[]) {
  const searchParams = useSearchParams();
  const [values, setValues] = useState(() => read(searchParams.toString(), keys));
  const valuesRef = useRef(values);
  const composingRef = useRef(false);
  const lastWrittenRef = useRef(serialize(values, keys));

  const write = useCallback(
    (next: Values<K>) => {
      const params = new URLSearchParams(window.location.search);
      const written = {} as Values<K>;
      for (const k of keys) {
        written[k] = next[k].trim();
        if (written[k]) params.set(k, written[k]);
        else params.delete(k);
      }
      // 記下寫進 URL 的（trim 後）值，回音比對才不會把使用者尾端空白洗掉。
      lastWrittenRef.current = serialize(written, keys);
      const qs = params.toString();
      const { pathname, search, hash } = window.location;
      const url = `${pathname}${qs ? `?${qs}` : ""}${hash}`;
      if (url === `${pathname}${search}${hash}`) return;
      try {
        // 傳 null：Next 的 patch 看到自家 __NA state 會跳過 router 同步，useSearchParams 就不會更新。
        window.history.replaceState(null, "", url);
      } catch {
        // ponytail: Safari 等瀏覽器對 replaceState 有頻率上限，超過會丟 SecurityError 或被忽略；
        // 略過這次，下一次輸入會帶著完整狀態重寫。真的撞到再考慮合併寫入。
      }
    },
    [keys],
  );

  const syncFrom = useCallback(
    (search: string) => {
      const fromUrl = read(search, keys);
      lastWrittenRef.current = serialize(fromUrl, keys);
      valuesRef.current = fromUrl;
      setValues(fromUrl);
    },
    [keys],
  );

  useEffect(() => {
    const onPop = () => {
      composingRef.current = false;
      syncFrom(window.location.search);
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [syncFrom]);

  // 非 popstate 的外部 URL 變動（例如站內 Link 帶 query 進來）→ 同步回 controls。
  const urlKey = keys.map((k) => searchParams.get(k) ?? "").join("\u0000");
  useEffect(() => {
    if (urlKey !== lastWrittenRef.current) syncFrom(searchParams.toString());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlKey]);

  const update = useCallback(
    (patch: Partial<Values<K>>) => {
      const next = { ...valuesRef.current, ...patch };
      valuesRef.current = next;
      setValues(next);
      if (!composingRef.current) write(next);
    },
    [write],
  );

  // 文字輸入框 spread 這組 handler，組字期間不寫 URL。
  const composition = {
    onCompositionStart: () => {
      composingRef.current = true;
    },
    onCompositionEnd: () => {
      if (!composingRef.current) return; // 組字中被 popstate 打斷：以目的 URL 為準
      composingRef.current = false;
      write(valuesRef.current);
    },
  };

  return { values, update, composition };
}
