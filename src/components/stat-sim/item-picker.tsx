"use client";

import { useMemo, useState } from "react";
import { CheckIcon, SearchIcon, XIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogCloseButton,
  DialogFooter,
  DialogPopup,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  EQUIP_SLOTS,
  type EquipSlot,
  type EquippedItem,
  type GameData,
  type SimItem,
} from "@/lib/types/stat-sim";
import { cn } from "@/lib/utils";
import { BonusRows } from "./bonus-rows";
import { SLOT_LABELS, formatBonus, typeLabel } from "./labels";

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
      <DialogPopup className="flex max-h-[min(88vh,760px)] max-w-xl flex-col gap-0 p-0 max-sm:top-auto max-sm:bottom-0 max-sm:left-0 max-sm:max-w-none max-sm:translate-x-0 max-sm:translate-y-0 max-sm:rounded-b-none">
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
  const [draft, setDraft] = useState<EquippedItem | null>(current);
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
  const path =
    picked?.strongPathId != null ? data.enhancementsByPath[picked.strongPathId] : undefined;
  const choose = (item: SimItem) =>
    setDraft((prev) => ({
      itemId: item.id,
      enhancementLevel: Math.min(
        prev?.enhancementLevel ?? 0,
        item.strongPathId != null ? (data.enhancementsByPath[item.strongPathId]?.maxLevel ?? 0) : 0,
      ),
      manualBonuses: prev?.manualBonuses ?? {},
    }));

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

      <div className="shrink-0 px-4 pt-3 pb-2">
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
      </div>

      <div className="min-h-24 flex-1 overflow-y-auto px-4 pb-3">
        <div
          role="listbox"
          aria-label={`${SLOT_LABELS[slot]}道具`}
          className="grid grid-cols-[repeat(auto-fill,minmax(48px,1fr))] gap-2"
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

      <div className="max-h-[40%] shrink-0 overflow-y-auto border-t border-border/60 px-4 py-3">
        {picked && draft ? (
          <div className="space-y-3">
            <div>
              <div className="flex flex-wrap items-center gap-2 font-heading text-[15px] font-semibold">
                {picked.name}
                <Badge variant="secondary">{typeLabel(picked.typeName)}</Badge>
                <span className="font-sans text-xs font-normal text-muted-foreground">
                  Lv{picked.level}
                </span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {formatBonus(picked.stats) || "這件道具沒有會影響面板的數值"}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-medium text-muted-foreground">強化</span>
              <Select
                value={String(draft.enhancementLevel)}
                disabled={!path}
                onValueChange={(v) =>
                  v != null && setDraft({ ...draft, enhancementLevel: Number(v) })
                }
              >
                <SelectTrigger size="sm" className="w-28" aria-label="強化等級">
                  <SelectValue>
                    {(v: unknown) => (v === "0" ? "未強化" : `+${String(v)}`)}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: (path?.maxLevel ?? 0) + 1 }, (_, n) => (
                    <SelectItem key={n} value={String(n)}>
                      {n === 0 ? "未強化" : `+${n}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <span className="text-xs text-muted-foreground">
                {!path
                  ? "這件道具不能強化"
                  : draft.enhancementLevel > 0
                    ? formatBonus(path.levels[draft.enhancementLevel] ?? {})
                    : ""}
              </span>
            </div>
            <div>
              <p className="mb-2 text-xs font-medium text-muted-foreground">
                鑲嵌 / 隨機屬性（合計）
              </p>
              <BonusRows
                label="手動加值"
                value={draft.manualBonuses}
                onChange={(manualBonuses) => setDraft({ ...draft, manualBonuses })}
              />
            </div>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">
            {draft
              ? "找不到這件道具的資料，可以重新挑一件或直接卸下。"
              : "選一件道具，或按「卸下」清空這個部位。"}
          </p>
        )}
      </div>

      <DialogFooter className="mt-0 border-t border-border/60 bg-muted/30 px-4 py-3">
        <Button
          variant="outline"
          size="sm"
          className="mr-auto"
          disabled={!current}
          onClick={() => onApply(null)}
        >
          卸下
        </Button>
        <Button variant="ghost" size="sm" onClick={onClose}>
          取消
        </Button>
        <Button size="sm" disabled={!picked} onClick={() => draft && onApply(draft)}>
          套用
        </Button>
      </DialogFooter>
    </>
  );
}
