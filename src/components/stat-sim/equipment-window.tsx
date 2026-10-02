"use client";

import type { CSSProperties } from "react";
import { PersonStandingIcon } from "lucide-react";
import type { CharacterV1, EquipSlot, GameData, UiWindowLayout } from "@/lib/types/stat-sim";
import { SLOT_LABELS } from "./labels";
import styles from "./stat-sim.module.css";
import { place, type EquipFields } from "./window-layout";

interface Props {
  layout: UiWindowLayout;
  fields: EquipFields;
  character: CharacterV1;
  items: GameData["itemsById"];
  picking: EquipSlot | null;
  onPick: (slot: EquipSlot) => void;
}

export function EquipmentWindow({ layout, fields, character, items, picking, onPick }: Props) {
  const anchor = fields.dollAnchor;
  return (
    <div className={styles.gw} data-testid="equipment-window">
      {/* eslint-disable @next/next/no-img-element -- 遊戲原圖 hotlink，需要 pixelated 與絕對定位 */}
      <img
        src={layout.backgroundUrl}
        alt={`遊戲${layout.name}視窗`}
        width={layout.width}
        height={layout.height}
        className={styles.bg}
      />
      <div className={styles.inner} style={{ "--bw": layout.width } as CSSProperties}>
        {fields.title && (
          <span aria-hidden className={`${styles.f} ${styles.title}`} style={place(fields.title)}>
            {layout.name}
          </span>
        )}
        {/* ponytail: 紙娃娃先放剪影；接易容閣 DollPreview 需要依裝備另查外觀圖層，之後再做 */}
        {anchor && (
          <span
            aria-hidden
            className={styles.doll}
            style={place({ x: anchor.x - 40, y: anchor.y - 90, w: 80, h: 80 })}
          >
            <PersonStandingIcon className="size-1/2" strokeWidth={1.5} />
          </span>
        )}
        {fields.slots.map(({ slot, box }) => {
          const worn = character.equipment[slot];
          const item = worn ? items[worn.itemId] : undefined;
          const label = SLOT_LABELS[slot];
          return (
            <button
              key={slot}
              type="button"
              className={styles.slot}
              style={place(box)}
              aria-pressed={picking === slot}
              aria-label={`${label}：${item ? `${item.name} +${worn!.enhancementLevel}` : worn ? "找不到道具資料" : "未裝備"}`}
              title={
                item
                  ? `${label}：${item.name} +${worn!.enhancementLevel}`
                  : `${label}：點擊挑選道具`
              }
              onClick={() => onPick(slot)}
            >
              {worn &&
                (item?.iconUrl ? (
                  <img src={item.iconUrl} alt="" loading="lazy" />
                ) : (
                  <span className={styles.noicon} />
                ))}
              {worn && worn.enhancementLevel > 0 && (
                <span className={styles.plus}>+{worn.enhancementLevel}</span>
              )}
            </button>
          );
        })}
        {fields.page && (
          <button
            type="button"
            disabled
            className={styles.iconBtn}
            style={place(fields.page.box)}
            aria-label="預備欄（即將推出）"
            title="預備欄：即將推出，之後用來比較兩套裝備"
          >
            {fields.page.iconUrl && <img src={fields.page.iconUrl} alt="" />}
          </button>
        )}
        {fields.extra && (
          <button
            type="button"
            disabled
            className={styles.iconBtn}
            style={place(fields.extra.box)}
            aria-label="外裝欄（只影響外觀，未提供）"
            title="外裝欄只影響外觀，不影響數值，這裡不提供"
          >
            {fields.extra.iconUrl && <img src={fields.extra.iconUrl} alt="" />}
          </button>
        )}
      </div>
      {/* eslint-enable @next/next/no-img-element */}
    </div>
  );
}
