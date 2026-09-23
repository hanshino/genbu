import type { CSSProperties } from "react";
import type { GuideMeta, GuideStage } from "@/lib/guides";

/** 區段名稱與路標色（chart-1..5 = 朱砂 / 青瓷 / 靛青 / 鎏金 / 墨紫）。 */
export const STAGE_LABEL: Record<GuideStage, string> = {
  beginner: "新手起步",
  "sub-clan": "轉副門派",
  advanced: "進階任務",
  rebirth: "轉生",
  topic: "通用",
};

const STAGE_COLOR: Record<GuideStage | "soon", string> = {
  beginner: "var(--chart-2)",
  "sub-clan": "var(--chart-3)",
  advanced: "var(--chart-4)",
  rebirth: "var(--chart-1)",
  topic: "var(--primary)",
  soon: "var(--chart-5)",
};

/**
 * --stop 是區段色；--stop-ink 混一點墨色當文字色，
 * 鎏金這類淺色直接當字在宣紙底上對比不夠。
 */
export function stageStyle(stage: GuideStage | "soon"): CSSProperties {
  const color = STAGE_COLOR[stage];
  return {
    "--stop": color,
    "--stop-ink": `color-mix(in oklab, ${color} 72%, var(--foreground))`,
  } as CSSProperties;
}

export function levelRange(meta: Pick<GuideMeta, "levelMin" | "levelMax">): string | null {
  const { levelMin: min, levelMax: max } = meta;
  if (min != null && max != null) return `${min}–${max}`;
  if (min != null) return `${min}+`;
  if (max != null) return `1–${max}`;
  return null;
}

/** 等級區段色的 badge：邊框、底色、文字都從 --stop 調出來。 */
export const stopBadgeClass =
  "h-6 gap-1.5 border-(--stop)/30 bg-(--stop)/10 px-2.5 font-normal text-(--stop-ink)";
