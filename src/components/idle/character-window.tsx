"use client";

import { useMemo, type CSSProperties } from "react";
import {
  AttributeWindowFrame,
  TextField,
  type AttributeWindowRenderers,
} from "@/components/stat-sim/attribute-window";
import { STAT_LABELS, fmt } from "@/components/stat-sim/labels";
import styles from "@/components/stat-sim/stat-sim.module.css";
import { attributeFields, place, type TextKey } from "@/components/stat-sim/window-layout";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { NOVICE_SECT_ID } from "@/configs/idle";
import { SECTS } from "@/configs/stat-sim";
import type { AttributeKey, PanelResult, UiWindowLayout } from "@/lib/types/stat-sim";
import type { IdleState } from "@/lib/idle/types";
import { cn } from "@/lib/utils";

const NOVICE_SECT_NAME = "入門弟子";

const sectName = (state: IdleState) =>
  state.sectId === NOVICE_SECT_ID ? NOVICE_SECT_NAME : (SECTS[state.sectId]?.name ?? "—");

const birthdayText = (state: IdleState) =>
  state.birthday ? `${state.birthday.month} 月 ${state.birthday.day} 日` : "";

/** 稱號與魅力值這個版本還沒有，照原作視窗留白（顯示「—」）。 */
function textFor(key: TextKey | null, state: IdleState, need: number): string {
  switch (key) {
    case "name":
      return state.name ?? "";
    case "title":
    case "charm":
      return "—";
    case "exp":
      return Number.isFinite(need)
        ? `${fmt(state.exp)} / ${fmt(need)}`
        : `${fmt(state.exp)}（已滿）`;
    case "level":
      return String(state.level);
    case "sect":
      return sectName(state);
    case "birthday":
      return birthdayText(state);
    default:
      return "";
  }
}

export interface CharacterWindowProps {
  layout: UiWindowLayout;
  state: IdleState;
  /** 面板：含尚未確認的加點，攻速已換成放置引擎用的攻速等級。 */
  panel: PanelResult;
  /** 目前等級升到下一級需要的經驗。 */
  need: number;
  /** 尚未確認的加點（每項 N 點）。 */
  pending: Partial<Record<AttributeKey, number>>;
  /** 加完草稿後剩下的屬性點。 */
  pointsLeft: number;
  busy: boolean;
  canAdd: (key: AttributeKey) => boolean;
  /** 再加一點要花幾點（含草稿）。 */
  costOf: (key: AttributeKey) => number;
  onAdd: (key: AttributeKey) => void;
  /** 攻速欄的說明（揮擊週期）。 */
  attackSpeedHint: string;
  /** 視窗倍率（見 window-scale.ts）；寬度 = 底圖寬 × 倍率。 */
  scale: number;
}

/**
 * 遊戲「基本屬性」視窗（與屬性模擬器同一個外框與版面），放在角色分頁。
 * 倍率由外層量好傳進來：桌面 2 / 1.5 / 1 倍，手機貼齊寬度（像素圖，不出現橫向捲動）。
 */
export function CharacterWindow({
  layout,
  state,
  panel,
  need,
  pending,
  pointsLeft,
  busy,
  canAdd,
  costOf,
  onAdd,
  attackSpeedHint,
  scale,
}: CharacterWindowProps) {
  // 「進階」是原作視窗的進階屬性鈕，這裡沒有對應功能，連它的標籤一起拿掉。
  const fields = useMemo(
    () => attributeFields(layout).filter((f) => !(f.kind === "label" && f.text === "進階")),
    [layout],
  );

  const renderers: AttributeWindowRenderers = {
    text: (f) => <TextField field={f} text={textFor(f.key, state, need)} />,
    attr: (f) => (
      <output
        className={cn(styles.f, styles.v, styles.ink)}
        style={place(f.box, f.color)}
        aria-label={`${STAT_LABELS[f.key]} ${state.attributes[f.key]}`}
      >
        {state.attributes[f.key]}
      </output>
    ),
    next: (f) => {
      const n = pending[f.key] ?? 0;
      return (
        <output
          className={cn(styles.f, styles.v, styles.pending)}
          style={place(f.box, f.color)}
          aria-label={n > 0 ? `${STAT_LABELS[f.key]}待加 ${n} 點` : undefined}
          aria-hidden={n > 0 ? undefined : true}
        >
          {n > 0 ? `+${n}` : ""}
        </output>
      );
    },
    add: (f) => {
      const label = STAT_LABELS[f.key];
      const cost = costOf(f.key);
      const can = canAdd(f.key) && !busy;
      return (
        <Tooltip>
          <TooltipTrigger
            render={
              <button
                type="button"
                className={cn(styles.add, styles.touch)}
                style={place(f.box)}
                disabled={!can}
                aria-label={`${label}加 1 點（需要 ${cost} 點）`}
                onClick={() => onAdd(f.key)}
              />
            }
          >
            {f.iconUrl && (
              // eslint-disable-next-line @next/next/no-img-element -- 遊戲原圖 hotlink，需要 pixelated
              <img src={f.iconUrl} alt="" />
            )}
          </TooltipTrigger>
          <TooltipContent>
            {label} +1：下一點需要 {cost} 屬性點
          </TooltipContent>
        </Tooltip>
      );
    },
    points: (f) => (
      <output
        className={cn(styles.f, styles.v, pointsLeft < 0 && styles.neg)}
        style={place(f.box, f.color)}
        aria-label={`剩餘屬性點 ${pointsLeft}`}
        title="剩餘屬性點"
        data-testid="remaining-points"
      >
        {fmt(pointsLeft)}
      </output>
    ),
    stat: (f) => {
      const s = panel.stats[f.key];
      const text = s.value == null ? "—" : fmt(Math.floor(s.value));
      return (
        <output
          className={cn(styles.f, styles.v)}
          style={place(f.box, f.color)}
          aria-label={`${STAT_LABELS[f.key]} ${text}`}
          title={f.key === "attack_speed" ? attackSpeedHint : undefined}
        >
          {text}
        </output>
      );
    },
    bar: (f) => {
      const s = panel.stats[f.key];
      return (
        <output
          className={cn(styles.f, styles.v, styles.bar, styles[f.key])}
          style={{ ...place(f.box), padding: 0 }}
          aria-label={`${STAT_LABELS[f.key]} ${s.value == null ? "—" : fmt(Math.floor(s.value))}`}
        >
          {s.value == null ? "—" : fmt(Math.floor(s.value))}
        </output>
      );
    },
  };

  const style: CSSProperties = { width: layout.width * scale };
  return (
    <AttributeWindowFrame
      layout={layout}
      fields={fields}
      renderers={renderers}
      testId="idle-attribute-window"
      className="mx-auto"
      style={style}
    />
  );
}
