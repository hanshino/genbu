"use client";

import { useId, useMemo, useState } from "react";
import { CheckIcon, CircleAlertIcon, SearchIcon, XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogCloseButton, DialogPopup, DialogTitle } from "@/components/ui/dialog";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  EQUIP_SLOTS,
  type EquipSlot,
  type EquippedItem,
  type GameData,
  type SimItem,
} from "@/lib/types/stat-sim";
import { cn } from "@/lib/utils";
import { ItemEditor, evaluate, fromEquipped, toEquipped, type Draft } from "./item-editor";
import { SLOT_LABELS } from "./labels";

/** 一次最多畫這麼多格；飾品有六百多件，其餘靠搜尋縮小範圍。 */
const GRID_LIMIT = 240;

interface Props {
  slot: EquipSlot | null;
  data: GameData;
  equipment: Record<EquipSlot, EquippedItem | null>;
  onSlotChange: (slot: EquipSlot) => void;
  onClose: () => void;
  onApply: (slot: EquipSlot, value: EquippedItem | null) => void;
}

/** 桌機是置中對話框，手機改成底部抽屜（同一個 Dialog，靠 max-sm 樣式切換）。 */
export function ItemPicker({ slot, data, equipment, onSlotChange, onClose, onApply }: Props) {
  return (
    <Dialog open={slot != null} onOpenChange={(open) => !open && onClose()}>
      <DialogPopup className="flex max-h-[min(90vh,840px)] max-w-xl flex-col gap-0 p-0 max-sm:top-auto max-sm:bottom-0 max-sm:left-0 max-sm:max-w-none max-sm:translate-x-0 max-sm:translate-y-0 max-sm:rounded-b-none">
        {slot && (
          <PickerBody
            key={slot}
            slot={slot}
            data={data}
            current={equipment[slot]}
            onSlotChange={onSlotChange}
            onClose={onClose}
            onApply={(value) => onApply(slot, value)}
          />
        )}
      </DialogPopup>
    </Dialog>
  );
}

function PickerBody({
  slot,
  data,
  current,
  onSlotChange,
  onClose,
  onApply,
}: {
  slot: EquipSlot;
  data: GameData;
  current: EquippedItem | null;
  onSlotChange: (slot: EquipSlot) => void;
  onClose: () => void;
  onApply: (value: EquippedItem | null) => void;
}) {
  const [q, setQ] = useState("");
  const idBase = useId();
  const [draft, setDraft] = useState<Draft | null>(current && fromEquipped(current));
  const candidates = useMemo(
    () =>
      Object.values(data.itemsById)
        .filter((item) => item.slotHint?.includes(slot))
        .sort((a, b) => b.level - a.level || a.id - b.id),
    [data.itemsById, slot],
  );
  const kw = q.trim().toLowerCase();
  const visible = kw
    ? candidates.filter((item) => item.name.toLowerCase().includes(kw) || String(item.id) === kw)
    : candidates;
  const shown = visible.slice(0, GRID_LIMIT);
  const picked = draft ? data.itemsById[draft.itemId] : undefined;
  const ev = picked && draft ? evaluate(draft, picked, data) : undefined;
  const errorCount = ev?.errorCount ?? 0;
  // 換成別件時隨機素質、插槽、舊版合計都歸零；挑回原本那件就還原存檔內容。
  const choose = (item: SimItem) =>
    setDraft((prev) => {
      if (prev?.itemId === item.id) return prev;
      if (current?.itemId === item.id) return fromEquipped(current);
      return {
        itemId: item.id,
        enhancementLevel: Math.min(
          prev?.enhancementLevel ?? 0,
          item.strongPathId != null
            ? (data.enhancementsByPath[item.strongPathId]?.maxLevel ?? 0)
            : 0,
        ),
        manualBonuses: {},
        rolls: {},
        sockets: [],
      };
    });

  const cellClass =
    "relative grid aspect-square place-items-center overflow-hidden rounded-lg border border-border bg-background p-[3px] transition-colors outline-none hover:border-foreground/25 hover:bg-muted/55 focus-visible:ring-3 focus-visible:ring-ring/50 aria-selected:border-2 aria-selected:border-primary aria-selected:bg-primary/[0.08] aria-selected:p-[2px]";

  return (
    <>
      <div className="border-b border-border/60 px-4 pt-4 pb-3">
        <DialogTitle className="font-heading text-base">挑選道具 — {SLOT_LABELS[slot]}</DialogTitle>
        <DialogCloseButton />
        <ToggleGroup
          aria-label="裝備部位"
          className="mt-3 flex-wrap"
          value={[slot]}
          onValueChange={(v) => v[0] && onSlotChange(v[0] as EquipSlot)}
        >
          {EQUIP_SLOTS.map((s) => (
            <ToggleGroupItem key={s} value={s} size="sm">
              {SLOT_LABELS[s]}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="border-b border-border/60 px-4 pt-3 pb-3">
          <InputGroup className="h-8">
            <InputGroupAddon>
              <SearchIcon aria-hidden />
            </InputGroupAddon>
            <InputGroupInput
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="搜尋道具名稱或 ID…"
              aria-label={`搜尋${SLOT_LABELS[slot]}道具`}
            />
            {q && (
              <InputGroupAddon align="inline-end">
                <InputGroupButton size="icon-xs" aria-label="清除搜尋" onClick={() => setQ("")}>
                  <XIcon aria-hidden />
                </InputGroupButton>
              </InputGroupAddon>
            )}
          </InputGroup>
          <p className="mt-2 text-xs text-muted-foreground tabular-nums">
            {visible.length > shown.length
              ? `符合 ${visible.length} 件，先列出等級最高的 ${shown.length} 件，請用搜尋縮小範圍`
              : `共 ${visible.length} 件`}
          </p>
          <div
            role="listbox"
            aria-label={`${SLOT_LABELS[slot]}道具`}
            className="mt-2 grid max-h-44 grid-cols-[repeat(auto-fill,minmax(48px,1fr))] gap-2 overflow-y-auto p-0.5 sm:max-h-52"
          >
            {shown.map((item) => {
              const on = draft?.itemId === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  role="option"
                  aria-selected={on}
                  aria-label={item.name}
                  title={`${item.name}（Lv${item.level}）`}
                  className={cn(
                    cellClass,
                    "group/cell",
                    !item.iconUrl && "bg-muted text-muted-foreground",
                  )}
                  onClick={() => choose(item)}
                >
                  {item.iconUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element -- 像素原圖 hotlink
                    <img
                      src={item.iconUrl}
                      alt=""
                      loading="lazy"
                      decoding="async"
                      className="h-auto max-h-10 w-auto max-w-10 [image-rendering:pixelated]"
                    />
                  ) : (
                    <span className="text-[11px]">{item.name.slice(0, 2)}</span>
                  )}
                  {on && (
                    <CheckIcon
                      className="absolute bottom-0.5 left-0.5 size-3 stroke-3 text-primary"
                      aria-hidden
                    />
                  )}
                </button>
              );
            })}
            {shown.length === 0 && (
              <p className="col-span-full py-6 text-center text-sm text-muted-foreground">
                找不到符合的道具。
              </p>
            )}
          </div>
        </div>

        <div className="px-4">
          {picked && draft ? (
            <ItemEditor
              idBase={idBase}
              item={picked}
              data={data}
              draft={draft}
              ev={ev!}
              onChange={setDraft}
            />
          ) : (
            <p className="py-4 text-xs text-muted-foreground">
              {draft
                ? "找不到這件道具的資料，可以重新挑一件或直接卸下。"
                : "選一件道具，或按「卸下」清空這個部位。"}
            </p>
          )}
        </div>
      </div>

      <div className="shrink-0 space-y-2 border-t border-border/60 bg-muted/30 px-4 py-3">
        {errorCount > 0 && (
          <p className="flex items-center gap-1.5 text-xs text-destructive">
            <CircleAlertIcon className="size-3.5 shrink-0" aria-hidden />有 {errorCount} 項需修正
          </p>
        )}
        <div className="flex gap-2">
          {current && (
            <Button variant="ghost" onClick={() => onApply(null)}>
              卸下
            </Button>
          )}
          <Button variant="outline" className="flex-1" onClick={onClose}>
            取消
          </Button>
          <Button
            className="flex-1"
            disabled={!picked || errorCount > 0}
            onClick={() => draft && ev && onApply(toEquipped(draft, ev))}
          >
            套用
          </Button>
        </div>
      </div>
    </>
  );
}
