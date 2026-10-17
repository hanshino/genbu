import { useEffect, useRef, useState, type RefObject } from "react";

/** 遊戲視窗的倍率：寬度夠就用 2 / 1.5 / 1 倍（像素圖不糊），不夠就貼齊可用寬度。 */
export function scaleFor(width: number, base: number): number {
  if (width >= base * 2) return 2;
  if (width >= base * 1.5) return 1.5;
  if (width >= base) return 1;
  return Math.max(width, 200) / base;
}

/** 量外框的可用寬度，回傳外框的 ref 與視窗倍率。 */
export function useWindowScale<T extends HTMLElement>(
  baseWidth: number,
): [RefObject<T | null>, number] {
  const holder = useRef<T>(null);
  const [scale, setScale] = useState(1);
  useEffect(() => {
    const el = holder.current;
    if (!el) return;
    const measure = () => {
      const w = el.clientWidth;
      if (w > 0) setScale(scaleFor(w, baseWidth));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [baseWidth]);
  return [holder, scale];
}
