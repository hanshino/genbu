"use client";

import { Fragment, useState, type CSSProperties, type ReactNode } from "react";
import { SECTS } from "@/configs/stat-sim";
import type { CharacterV1, PanelResult, StatValue, UiWindowLayout } from "@/lib/types/stat-sim";
import { cn } from "@/lib/utils";
import { STAT_LABELS, fmt, selectOnFocus, type ViewKey } from "./labels";
import styles from "./stat-sim.module.css";
import { place, type AttrField } from "./window-layout";

const valueText = (s: StatValue) => (s.value == null ? "—" : fmt(s.value));

function tipFor(label: string, s: StatValue, hiddenInGame = false) {
  const lines = [label];
  if (hiddenInGame) lines.push("遊戲中不顯示，這裡由模擬器推算");
  if (s.value == null) lines.push("無法計算");
  if (s.estimated) lines.push(...s.estimateReasons.map((r) => `估計：${r}`));
  lines.push("點一下看來源明細");
  return lines.join("\n");
}

type FieldOf<K extends AttrField["kind"]> = AttrField & { kind: K };

/** 各種欄位怎麼畫；標籤（label）由外框統一處理。 */
export interface AttributeWindowRenderers {
  text: (field: FieldOf<"text">, index: number) => ReactNode;
  attr: (field: FieldOf<"attr">, index: number) => ReactNode;
  next: (field: FieldOf<"next">, index: number) => ReactNode;
  add: (field: FieldOf<"add">, index: number) => ReactNode;
  points: (field: FieldOf<"points">, index: number) => ReactNode;
  stat: (field: FieldOf<"stat">, index: number) => ReactNode;
  bar: (field: FieldOf<"bar">, index: number) => ReactNode;
}

/** 一般的文字欄位（名字、等級、門派…）：靠左的純文字。 */
export function TextField({ field, text }: { field: FieldOf<"text">; text: string }) {
  return (
    <span className={cn(styles.f, styles.v, styles.text)} style={place(field.box, field.color)}>
      {text}
    </span>
  );
}

/**
 * 遊戲「基本屬性」視窗的外框：底圖加絕對定位的欄位，位置全由控制項座標決定。
 * 視窗寬度 = 外框寬度（--u = 100cqw / 底圖寬），所以呼叫端用外框的寬度決定倍率。
 * 模擬器與摸魚練功房共用，只有各欄位的畫法（renderers）不同。
 */
export function AttributeWindowFrame({
  layout,
  fields,
  renderers,
  testId = "attribute-window",
  className,
  style,
}: {
  layout: UiWindowLayout;
  fields: AttrField[];
  renderers: AttributeWindowRenderers;
  testId?: string;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <div className={cn(styles.gw, className)} style={style} data-testid={testId}>
      {/* eslint-disable @next/next/no-img-element -- 遊戲原圖 hotlink，需要 pixelated 與絕對定位 */}
      <img
        src={layout.backgroundUrl}
        alt={`遊戲${layout.name}視窗`}
        width={layout.width}
        height={layout.height}
        className={styles.bg}
      />
      <div className={styles.inner} style={{ "--bw": layout.width } as CSSProperties}>
        {fields.map((f, i) => {
          switch (f.kind) {
            case "label":
              // y < 10 的標籤是視窗標題列（「屬性」），用標題字樣
              return (
                <span
                  key={i}
                  aria-hidden
                  className={cn(styles.f, f.box.y < 10 ? styles.title : styles.label)}
                  style={place(f.box, f.box.y < 10 ? undefined : f.color)}
                >
                  {f.text}
                </span>
              );
            case "text":
              return <Fragment key={i}>{renderers.text(f, i)}</Fragment>;
            case "attr":
              return <Fragment key={i}>{renderers.attr(f, i)}</Fragment>;
            case "next":
              return <Fragment key={i}>{renderers.next(f, i)}</Fragment>;
            case "add":
              return <Fragment key={i}>{renderers.add(f, i)}</Fragment>;
            case "points":
              return <Fragment key={i}>{renderers.points(f, i)}</Fragment>;
            case "stat":
              return <Fragment key={i}>{renderers.stat(f, i)}</Fragment>;
            case "bar":
              return <Fragment key={i}>{renderers.bar(f, i)}</Fragment>;
          }
        })}
      </div>
      {/* eslint-enable @next/next/no-img-element */}
    </div>
  );
}

interface Props {
  layout: UiWindowLayout;
  fields: AttrField[];
  character: CharacterV1;
  panel: PanelResult | null;
  gearMode: boolean;
  selected: ViewKey;
  onSelect: (key: ViewKey) => void;
  onAdd: (key: keyof CharacterV1["attributes"]) => void;
  onEdit: (key: keyof CharacterV1["attributes"], typed: number) => void;
}

export function AttributeWindow({
  layout,
  fields,
  character,
  panel,
  gearMode,
  selected,
  onSelect,
  onAdd,
  onEdit,
}: Props) {
  const [editing, setEditing] = useState<{
    key: keyof CharacterV1["attributes"];
    draft: string;
  } | null>(null);
  const commit = () => {
    if (!editing) return;
    const typed = Number(editing.draft);
    setEditing(null);
    if (editing.draft.trim() !== "" && Number.isSafeInteger(typed)) onEdit(editing.key, typed);
  };

  const renderers: AttributeWindowRenderers = {
    text: (f) => {
      const text =
        f.key === "name"
          ? character.name
          : f.key === "level"
            ? String(character.level)
            : f.key === "sect"
              ? SECTS[character.sectId].name
              : "";
      return <TextField field={f} text={text} />;
    },
    attr: (f) => {
      const bare = character.attributes[f.key];
      const shown = gearMode ? panel?.attributes[f.key].value : bare;
      const label = STAT_LABELS[f.key];
      if (editing?.key === f.key) {
        return (
          <span className={cn(styles.f, styles.v)} style={place(f.box, f.color)}>
            <input
              autoFocus
              onFocus={selectOnFocus}
              inputMode="numeric"
              className={styles.edit}
              aria-label={`輸入${gearMode ? "含裝" : "不含裝"}${label}`}
              value={editing.draft}
              onChange={(e) => setEditing({ key: f.key, draft: e.target.value })}
              onBlur={commit}
              onKeyDown={(e) => {
                if (e.key === "Enter") commit();
                if (e.key === "Escape") setEditing(null);
              }}
            />
          </span>
        );
      }
      return (
        <button
          type="button"
          className={cn(styles.f, styles.v, styles.ink)}
          style={place(f.box, f.color)}
          aria-label={`${label} ${shown ?? "—"}，點擊輸入${gearMode ? "含裝" : "不含裝"}數值`}
          title={`${label}：點擊輸入${gearMode ? "含裝" : "不含裝"}數值`}
          onClick={() => {
            onSelect(f.key);
            setEditing({ key: f.key, draft: String(shown ?? bare) });
          }}
        >
          {shown == null ? "—" : fmt(shown)}
        </button>
      );
    },
    next: (f) => (
      <span
        className={cn(styles.f, styles.v, styles.ink)}
        style={place(f.box, f.color)}
        title={`${STAT_LABELS[f.key]}再加 1 點需要的屬性點`}
      >
        {panel ? panel.points.nextCost[f.key] : ""}
      </span>
    ),
    add: (f) => {
      const cost = panel?.points.nextCost[f.key] ?? Infinity;
      const can = !!panel && panel.points.remaining >= cost;
      return (
        <button
          type="button"
          className={styles.add}
          style={place(f.box)}
          disabled={!can}
          aria-label={`${STAT_LABELS[f.key]}加 1 點（需要 ${cost} 點）`}
          title={can ? `${STAT_LABELS[f.key]} +1（需要 ${cost} 點）` : "剩餘屬性點不夠"}
          onClick={() => onAdd(f.key)}
        >
          {f.iconUrl && (
            // eslint-disable-next-line @next/next/no-img-element -- 遊戲原圖 hotlink，需要 pixelated
            <img src={f.iconUrl} alt="" />
          )}
        </button>
      );
    },
    points: (f) => {
      const left = panel?.points.remaining;
      return (
        <span
          className={cn(styles.f, styles.v, left != null && left < 0 && styles.neg)}
          style={place(f.box, f.color)}
          title="剩餘屬性點"
          data-testid="remaining-points"
        >
          {left == null ? "—" : fmt(left)}
        </span>
      );
    },
    stat: (f) => {
      const s = panel?.stats[f.key];
      if (!s) return null;
      return (
        <button
          type="button"
          className={cn(styles.f, styles.v, f.hiddenInGame && styles.hidden)}
          style={place(f.box, f.color)}
          aria-pressed={selected === f.key}
          aria-label={`${STAT_LABELS[f.key]} ${valueText(s)}`}
          title={tipFor(STAT_LABELS[f.key], s, f.hiddenInGame)}
          onClick={() => onSelect(f.key)}
        >
          {(f.hiddenInGame || s.estimated) && (
            <span className={styles.corner} aria-hidden>
              {s.estimated ? "估" : "算"}
            </span>
          )}
          {valueText(s)}
        </button>
      );
    },
    bar: (f) => {
      const s = panel?.stats[f.key];
      if (!s) return null;
      return (
        <button
          type="button"
          className={cn(styles.f, styles.v, styles.bar, styles[f.key])}
          style={{ ...place(f.box), padding: 0 }}
          aria-pressed={selected === f.key}
          aria-label={`${STAT_LABELS[f.key]} ${valueText(s)}`}
          title={tipFor(STAT_LABELS[f.key], s)}
          onClick={() => onSelect(f.key)}
        >
          {s.estimated && (
            <span className={styles.corner} aria-hidden>
              估
            </span>
          )}
          {valueText(s)}
        </button>
      );
    },
  };

  return <AttributeWindowFrame layout={layout} fields={fields} renderers={renderers} />;
}
