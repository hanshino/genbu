"use client";

import { useEffect, useState } from "react";
import type { Box } from "@/lib/idle/create-layout";
import type { StripSet } from "@/lib/skill-effect";
import { TICK_MS } from "@/configs/idle";
import styles from "./character-create.module.css";

/** 紙娃娃可以切換的動作（目前只有 dir 1 的動作圖）：動作名、顯示用的名稱。 */
export const DOLL_ACTIONS = [
  { action: "wait", label: "待機" },
  { action: "walk", label: "走路" },
  { action: "attack1", label: "普通攻擊" },
  { action: "prepare", label: "備戰" },
  { action: "cast", label: "施法" },
  { action: "chop", label: "劈砍" },
  { action: "sweep", label: "橫掃" },
  { action: "stab", label: "突刺" },
  { action: "power_strike", label: "強力一擊" },
  { action: "defense", label: "防禦" },
] as const;

/** 這組動作圖有的動作（依 DOLL_ACTIONS 的順序）。 */
export function availableActions(strips: StripSet) {
  return DOLL_ACTIONS.filter((a) => strips[a.action]);
}

/**
 * 畫在遊戲視窗的紙娃娃畫框裡。腳底對齊 anchor（原作控制項 77 的位置），
 * 動作圖用 CSS 背景切格，跟著視窗的 --u 縮放（pixelated，不糊）。
 * reducedMotion 時只顯示每個動作的第一格。
 */
export function CreateDoll({
  strips,
  action,
  anchor,
  clip,
  reducedMotion,
}: {
  strips: StripSet;
  action: string;
  /** 腳底，視窗座標。 */
  anchor: { x: number; y: number };
  /** 畫框範圍，視窗座標；超出的部分裁掉。 */
  clip: Box;
  reducedMotion: boolean;
}) {
  const strip = strips[action] ?? strips.wait;
  // 動作換了就從第一格開始：index 連同它屬於哪個動作一起存，渲染時不用 effect 重設。
  const [frame, setFrame] = useState({ url: "", index: 0 });
  const index = strip && frame.url === strip.url ? frame.index : 0;

  useEffect(() => {
    if (!strip || reducedMotion || strip.frames < 2) return;
    let current = 0;
    let timer = 0;
    const next = () => {
      timer = window.setTimeout(() => {
        current = (current + 1) % strip.frames;
        setFrame({ url: strip.url, index: current });
        next();
      }, Math.max(1, strip.delays[current] ?? 6) * TICK_MS);
    };
    next();
    return () => window.clearTimeout(timer);
  }, [strip, reducedMotion]);

  if (!strip) return null;
  const u = (n: number) => `calc(var(--u) * ${n})`;
  return (
    <div
      className={styles.dollClip}
      style={{ left: u(clip.x), top: u(clip.y), width: u(clip.w), height: u(clip.h) }}
      aria-hidden
    >
      <div
        className={styles.dollSprite}
        style={{
          left: u(anchor.x - clip.x - strip.anchorX),
          top: u(anchor.y - clip.y - strip.anchorY),
          width: u(strip.cellW),
          height: u(strip.cellH),
          backgroundImage: `url(${strip.url})`,
          backgroundSize: `${u(strip.cellW * strip.frames)} ${u(strip.cellH)}`,
          backgroundPosition: `${u(-index * strip.cellW)} 0`,
        }}
      />
    </div>
  );
}
