"use client";

import { useEffect, useRef, type MutableRefObject, type ReactNode } from "react";
import type { EffectSprite } from "@/lib/skill-effect";
import type { IdleData } from "@/lib/idle/types";
import type { IdleSceneAssets } from "@/lib/queries/idle";
import { timelineFor } from "./bundles";
import type { Runtime } from "./runtime";
import { drawIdleScene, loadBackdrop, preloadStrips } from "./scene-draw";

const NO_SPRITES = new Map<string, EffectSprite>();

interface IdleSceneProps {
  rt: MutableRefObject<Runtime>;
  data: IdleData;
  scene: IdleSceneAssets;
  reducedMotion: boolean;
  /** 遊戲迴圈每幀呼叫 drawRef.current 重畫。 */
  drawRef: MutableRefObject<(() => void) | null>;
  children?: ReactNode;
}

/** 場景：畫布不跟網站主題走（加算混合的特效需要固定的底色），上面疊 DOM 的狀態與提示。 */
export function IdleScene({ rt, data, scene, reducedMotion, drawRef, children }: IdleSceneProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const size = useRef({ w: 0, h: 0, dpr: 1 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      size.current = { w: rect.width, h: rect.height, dpr };
      canvas.width = Math.max(1, Math.round(rect.width * dpr));
      canvas.height = Math.max(1, Math.round(rect.height * dpr));
    };
    resize();
    const ro = new ResizeObserver(() => {
      resize();
      drawRef.current?.();
    });
    ro.observe(canvas);
    return () => ro.disconnect();
  }, [drawRef]);

  // 動作圖先載；背景是整張地圖（5 MB），等畫面空閒再載，載好前先用沙地底色。
  useEffect(() => {
    preloadStrips([scene.casterStrips, ...Object.values(scene.monsterStrips)], () => {});
    const url = scene.map?.url;
    if (!url) return;
    const start = () => void loadBackdrop(url);
    const id = window.setTimeout(start, 400);
    return () => window.clearTimeout(id);
  }, [scene]);

  useEffect(() => {
    drawRef.current = () => {
      const ctx = canvasRef.current?.getContext("2d");
      const { w, h, dpr } = size.current;
      if (!ctx || w === 0) return;
      const { state, fx, clock } = rt.current;
      const phase = state.phase;
      const effect =
        phase.kind === "casting" && phase.skillId != null ? timelineFor(phase.skillId, state.skillLevel, state.gender) : null;
      drawIdleScene(
        ctx,
        {
          state,
          data,
          fx,
          clock,
          casterStrips: scene.casterStrips,
          monsterStrips: scene.monsterStrips,
          timeline: effect?.timeline ?? null,
          sprites: effect?.sprites ?? NO_SPRITES,
          reducedMotion,
        },
        w,
        h,
        dpr,
      );
    };
    drawRef.current();
    return () => {
      drawRef.current = null;
    };
  }, [rt, data, scene, reducedMotion, drawRef]);

  return (
    <div className="relative h-[220px] w-full overflow-hidden bg-[#c9b27c] sm:h-[360px]">
      <canvas ref={canvasRef} role="img" aria-label="掛機場景" className="absolute inset-0 size-full" />
      {children}
    </div>
  );
}
