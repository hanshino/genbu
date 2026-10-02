"use client";

import { useState, type CSSProperties } from "react";
import { SECTS } from "@/configs/stat-sim";
import type { CharacterV1, PanelResult, StatValue, UiWindowLayout } from "@/lib/types/stat-sim";
import { cn } from "@/lib/utils";
import { STAT_LABELS, fmt, type ViewKey } from "./labels";
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

  return (
    <div className={styles.gw} data-testid="attribute-window">
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
            case "text": {
              const text =
                f.key === "name"
                  ? character.name
                  : f.key === "level"
                    ? String(character.level)
                    : f.key === "sect"
                      ? SECTS[character.sectId].name
                      : "";
              return (
                <span
                  key={i}
                  className={cn(styles.f, styles.v, styles.text)}
                  style={place(f.box, f.color)}
                >
                  {text}
                </span>
              );
            }
            case "attr": {
              const bare = character.attributes[f.key];
              const shown = gearMode ? panel?.attributes[f.key].value : bare;
              const label = STAT_LABELS[f.key];
              if (editing?.key === f.key) {
                return (
                  <span key={i} className={cn(styles.f, styles.v)} style={place(f.box, f.color)}>
                    <input
                      autoFocus
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
                  key={i}
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
            }
            case "next":
              return (
                <span
                  key={i}
                  className={cn(styles.f, styles.v, styles.ink)}
                  style={place(f.box, f.color)}
                  title={`${STAT_LABELS[f.key]}再加 1 點需要的屬性點`}
                >
                  {panel ? panel.points.nextCost[f.key] : ""}
                </span>
              );
            case "add": {
              const cost = panel?.points.nextCost[f.key] ?? Infinity;
              const can = !!panel && panel.points.remaining >= cost;
              return (
                <button
                  key={i}
                  type="button"
                  className={styles.add}
                  style={place(f.box)}
                  disabled={!can}
                  aria-label={`${STAT_LABELS[f.key]}加 1 點（需要 ${cost} 點）`}
                  title={can ? `${STAT_LABELS[f.key]} +1（需要 ${cost} 點）` : "剩餘屬性點不夠"}
                  onClick={() => onAdd(f.key)}
                >
                  {f.iconUrl && <img src={f.iconUrl} alt="" />}
                </button>
              );
            }
            case "points": {
              const left = panel?.points.remaining;
              return (
                <span
                  key={i}
                  className={cn(styles.f, styles.v, left != null && left < 0 && styles.neg)}
                  style={place(f.box, f.color)}
                  title="剩餘屬性點"
                  data-testid="remaining-points"
                >
                  {left == null ? "—" : fmt(left)}
                </span>
              );
            }
            case "stat": {
              const s = panel?.stats[f.key];
              if (!s) return null;
              return (
                <button
                  key={i}
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
            }
            case "bar": {
              const s = panel?.stats[f.key];
              if (!s) return null;
              return (
                <button
                  key={i}
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
            }
          }
        })}
      </div>
      {/* eslint-enable @next/next/no-img-element */}
    </div>
  );
}
