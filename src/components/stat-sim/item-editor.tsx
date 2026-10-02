"use client";

import type { ReactNode } from "react";
import {
  CircleAlertIcon,
  DicesIcon,
  GemIcon,
  HammerIcon,
  HistoryIcon,
  LockIcon,
  SigmaIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  STAT_KEYS,
  type EnhancementPath,
  type EquippedItem,
  type GameData,
  type PanelBonus,
  type RandomRoll,
  type SimItem,
  type SocketFill,
  type SocketRecipe,
  type StatKey,
  type ValueRange,
} from "@/lib/types/stat-sim";
import { cn } from "@/lib/utils";
import { STAT_LABELS, fmt, formatBonus, selectOnFocus, signed, typeLabel } from "./labels";

/* ---------- 編輯中的草稿：輸入框保留字串，套用時才轉成 EquippedItem ---------- */

export interface SocketDraft {
  recipeId: number;
  stat: StatKey;
  value: string;
}

export interface Draft {
  itemId: number;
  enhancementLevel: number;
  manualBonuses: PanelBonus;
  /** 有 key 就是勾選；值是輸入框文字。 */
  rolls: Record<string, string>;
  sockets: (SocketDraft | null)[];
}

export const fromEquipped = (e: EquippedItem): Draft => ({
  itemId: e.itemId,
  enhancementLevel: e.enhancementLevel,
  manualBonuses: e.manualBonuses,
  rolls: Object.fromEntries((e.randomRolls ?? []).map((r) => [r.attribute, String(r.value)])),
  sockets: (e.sockets ?? []).map(
    (s) => s && { recipeId: s.recipeId, stat: s.stat, value: String(s.value) },
  ),
});

const parseInteger = (s: string) => (/^-?\d+$/.test(s.trim()) ? Number(s.trim()) : NaN);
const inRanges = (v: number, ranges: ValueRange[]) =>
  Number.isInteger(v) && ranges.some(([a, b]) => v >= a && v <= b);
const rangeText = ([a, b]: ValueRange) => (a === b ? `${a}` : `${a}–${b}`);
const sortRanges = (ranges: ValueRange[]) => [...ranges].sort((x, y) => x[0] - y[0] || x[1] - y[1]);

/** 「50–85」；相連或重疊的區段合併，其餘用「、」分開。 */
export function formatRanges(ranges: ValueRange[]): string {
  const merged: ValueRange[] = [];
  for (const [a, b] of sortRanges(ranges)) {
    const last = merged.at(-1);
    if (last && a <= last[1] + 1) last[1] = Math.max(last[1], b);
    else merged.push([a, b]);
  }
  return merged.map(rangeText).join("、");
}

const effectOf = (recipe: SocketRecipe, stat: StatKey) =>
  recipe.effects.find((e) => e.stat === stat) ?? recipe.effects[0];
const fixedValue = (ranges: ValueRange[]) =>
  ranges.length === 1 && ranges[0][0] === ranges[0][1] ? ranges[0][0] : null;

export const recipesFor = (item: SimItem, data: GameData): SocketRecipe[] =>
  item.socketCategory == null
    ? []
    : (data.socketRecipeIdsByCategory?.[item.socketCategory] ?? [])
        .map((id) => data.socketRecipes?.[id])
        .filter((r): r is SocketRecipe => !!r && r.effects.length > 0);

export interface Evaluated {
  rolls: RandomRoll[];
  sockets: (SocketFill | null)[];
  badRolls: Set<string>;
  badSockets: Set<number>;
  errorCount: number;
}

export function evaluate(draft: Draft, item: SimItem, data: GameData): Evaluated {
  const rolls: RandomRoll[] = [];
  const badRolls = new Set<string>();
  for (const opt of item.randomOptions ?? []) {
    const raw = draft.rolls[opt.attribute];
    if (raw === undefined) continue;
    const value = parseInteger(raw);
    if (inRanges(value, opt.ranges)) rolls.push({ attribute: opt.attribute, value });
    else badRolls.add(opt.attribute);
  }
  const badSockets = new Set<number>();
  const sockets = Array.from({ length: item.socketCount ?? 0 }, (_, i): SocketFill | null => {
    const fill = draft.sockets[i];
    const recipe = fill && data.socketRecipes?.[fill.recipeId];
    if (!fill || !recipe?.effects.length) return null;
    const effect = effectOf(recipe, fill.stat);
    const value = fixedValue(effect.ranges) ?? parseInteger(fill.value);
    if (inRanges(value, effect.ranges)) return { recipeId: recipe.id, stat: effect.stat, value };
    badSockets.add(i);
    return null;
  });
  return { rolls, sockets, badRolls, badSockets, errorCount: badRolls.size + badSockets.size };
}

/** 空的 randomRolls / sockets 不寫入，舊存檔格式維持不變。 */
export function toEquipped(draft: Draft, ev: Evaluated): EquippedItem {
  const out: EquippedItem = {
    itemId: draft.itemId,
    enhancementLevel: draft.enhancementLevel,
    manualBonuses: draft.manualBonuses,
  };
  if (ev.rolls.length) out.randomRolls = ev.rolls;
  if (ev.sockets.some(Boolean)) out.sockets = ev.sockets;
  return out;
}

/* ---------- 畫面 ---------- */

function Section({
  icon,
  title,
  badge,
  note,
  children,
}: {
  icon: ReactNode;
  title: string;
  badge?: ReactNode;
  note?: string;
  children: ReactNode;
}) {
  return (
    <section aria-label={title} className="border-b border-border/60 py-4 last:border-b-0">
      <h4 className="flex items-center gap-2 text-sm font-semibold [&>svg]:size-3.5 [&>svg]:text-muted-foreground">
        {icon}
        {title}
        {badge != null && (
          <Badge variant="secondary" className="ml-auto font-normal">
            {badge}
          </Badge>
        )}
      </h4>
      {note && <p className="mt-1 text-xs text-muted-foreground">{note}</p>}
      <div className="mt-3">{children}</div>
    </section>
  );
}

function FieldError({ id, ranges }: { id: string; ranges: ValueRange[] }) {
  return (
    <p id={id} className="col-span-full flex items-center gap-1.5 text-xs text-destructive">
      <CircleAlertIcon className="size-3.5 shrink-0" aria-hidden />
      需介於 {formatRanges(ranges)}
    </p>
  );
}

const valueInput = "h-8 text-right tabular-nums";

interface Props {
  idBase: string;
  item: SimItem;
  data: GameData;
  draft: Draft;
  ev: Evaluated;
  onChange: (draft: Draft) => void;
}

export function ItemEditor({ idBase, item, data, draft, ev, onChange }: Props) {
  const path: EnhancementPath | undefined =
    item.strongPathId != null ? data.enhancementsByPath[item.strongPathId] : undefined;
  const enhanceBonus = path?.levels[draft.enhancementLevel] ?? {};
  const options = item.randomOptions ?? [];
  const socketCount = item.socketCount ?? 0;
  const recipes = recipesFor(item, data);
  const legacy = formatBonus(draft.manualBonuses);

  const setRoll = (attribute: string, value: string | undefined) => {
    const rolls = { ...draft.rolls };
    if (value === undefined) delete rolls[attribute];
    else rolls[attribute] = value;
    onChange({ ...draft, rolls });
  };
  const setSocket = (i: number, fill: SocketDraft | null) =>
    onChange({
      ...draft,
      sockets: Array.from({ length: socketCount }, (_, j) =>
        j === i ? fill : (draft.sockets[j] ?? null),
      ),
    });
  const fillFor = (recipe: SocketRecipe, stat: StatKey): SocketDraft => {
    const effect = effectOf(recipe, stat);
    const min = Math.min(...effect.ranges.map((r) => r[0]));
    return {
      recipeId: recipe.id,
      stat: effect.stat,
      value: Number.isFinite(min) ? String(min) : "",
    };
  };

  /* 本件合計：先照隨機素質的順序，其餘照 STAT_KEYS。 */
  const parts = new Map<StatKey, { source: string; amount: number }[]>();
  const add = (stat: StatKey, source: string, amount: number) => {
    if (!amount) return;
    parts.set(stat, [...(parts.get(stat) ?? []), { source, amount }]);
  };
  for (const key of STAT_KEYS) add(key, "固定", item.stats[key] ?? 0);
  for (const r of ev.rolls) {
    const stat = options.find((o) => o.attribute === r.attribute)?.stat;
    if (stat) add(stat, "隨機", r.value);
  }
  for (const key of STAT_KEYS) add(key, "強化", enhanceBonus[key] ?? 0);
  for (const s of ev.sockets) if (s) add(s.stat, "插槽", s.value);
  const pending = new Set<StatKey>([
    ...options.filter((o) => ev.badRolls.has(o.attribute)).map((o) => o.stat),
    ...[...ev.badSockets].flatMap((i) => {
      const fill = draft.sockets[i];
      const recipe = fill && data.socketRecipes?.[fill.recipeId];
      return recipe ? [effectOf(recipe, fill.stat).stat] : [];
    }),
  ]);
  const order = [...new Set<StatKey>([...options.map((o) => o.stat), ...STAT_KEYS])].filter(
    (k) => parts.has(k) || pending.has(k),
  );
  const fixedStats = STAT_KEYS.filter((k) => item.stats[k]);

  return (
    <>
      <div className="flex items-start gap-3 border-b border-border/60 py-4">
        <span className="grid size-11 shrink-0 place-items-center rounded-lg border border-border/60 bg-muted/40 text-[11px] text-muted-foreground">
          {item.iconUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- 像素原圖 hotlink
            <img
              src={item.iconUrl}
              alt=""
              className="h-auto max-h-9 w-auto max-w-9 [image-rendering:pixelated]"
            />
          ) : (
            item.name.slice(0, 2)
          )}
        </span>
        <div className="min-w-0">
          <p className="font-heading text-[15px] font-semibold">{item.name}</p>
          <div className="mt-1 flex flex-wrap gap-1.5">
            <Badge variant="secondary">{typeLabel(item.typeName)}</Badge>
            <Badge variant="secondary">Lv{item.level}</Badge>
            {socketCount > 0 && <Badge variant="outline">插槽 {socketCount}</Badge>}
          </div>
        </div>
      </div>

      <Section icon={<LockIcon aria-hidden />} title="固定素質" badge="唯讀">
        {fixedStats.length ? (
          <ul className="flex flex-wrap gap-x-5 gap-y-1 text-sm">
            {fixedStats.map((k) => (
              <li key={k} className="flex items-baseline gap-2">
                <span className="text-muted-foreground">{STAT_LABELS[k]}</span>
                <span className="font-medium tabular-nums">{signed(item.stats[k]!)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-muted-foreground">這件道具沒有固定素質。</p>
        )}
      </Section>

      {options.length > 0 && (
        <Section
          icon={<DicesIcon aria-hidden />}
          title="隨機素質"
          badge={`已勾 ${Object.keys(draft.rolls).length} 項`}
          note="勾選遊戲裡實際出現的素質，再填上數值；沒勾的不會算進去。"
        >
          <div className="flex flex-col gap-2">
            {options.map((opt, i) => {
              const raw = draft.rolls[opt.attribute];
              const on = raw !== undefined;
              const bad = ev.badRolls.has(opt.attribute);
              const errId = `${idBase}-roll-${i}`;
              return (
                <div
                  key={opt.attribute}
                  className={cn(
                    "grid grid-cols-[minmax(0,1fr)_5.5rem] items-center gap-x-3 gap-y-1.5 rounded-lg border px-3 py-2 transition-colors",
                    !on && "border-border/60 hover:bg-muted/30",
                    on && !bad && "border-border bg-muted/50",
                    bad && "border-destructive/50 bg-destructive/5",
                  )}
                >
                  <label className="flex min-w-0 cursor-pointer items-center gap-3">
                    <Checkbox
                      checked={on}
                      onCheckedChange={(checked) =>
                        setRoll(
                          opt.attribute,
                          checked ? String(opt.ranges[0]?.[0] ?? "") : undefined,
                        )
                      }
                    />
                    <span className="flex min-w-0 flex-wrap items-baseline gap-x-3">
                      <span className={cn("text-sm", on ? "font-medium" : "text-muted-foreground")}>
                        {opt.attribute}
                      </span>
                      <span className="text-[11px] whitespace-nowrap text-muted-foreground tabular-nums">
                        {formatRanges(opt.ranges)}
                      </span>
                    </span>
                  </label>
                  <Input
                    inputMode="numeric"
                    aria-label={`${opt.attribute}數值`}
                    placeholder="—"
                    disabled={!on}
                    value={raw ?? ""}
                    aria-invalid={bad || undefined}
                    aria-describedby={bad ? errId : undefined}
                    onFocus={selectOnFocus}
                    onChange={(e) => setRoll(opt.attribute, e.target.value)}
                    className={valueInput}
                  />
                  {bad && <FieldError id={errId} ranges={opt.ranges} />}
                </div>
              );
            })}
          </div>
        </Section>
      )}

      <Section icon={<HammerIcon aria-hidden />} title="強化">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <Select
            value={String(draft.enhancementLevel)}
            disabled={!path}
            onValueChange={(v) => v != null && onChange({ ...draft, enhancementLevel: Number(v) })}
          >
            <SelectTrigger className="w-28" aria-label="強化等級">
              <SelectValue>{(v: unknown) => (v === "0" ? "未強化" : `+${String(v)}`)}</SelectValue>
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
                ? formatBonus(enhanceBonus)
                : ""}
          </span>
        </div>
      </Section>

      {socketCount > 0 && (
        <Section
          icon={<GemIcon aria-hidden />}
          title="插槽"
          badge={`${draft.sockets.slice(0, socketCount).filter(Boolean).length} / ${socketCount} 已填`}
          note={
            recipes.length
              ? "一槽一個配方。固定效果直接帶入，隨機的請填遊戲裡實際的數值。"
              : "這類裝備查無可插的配方。"
          }
        >
          <div className="flex flex-col gap-2">
            {Array.from({ length: socketCount }, (_, i) => {
              const fill = draft.sockets[i] ?? null;
              const recipe = fill ? data.socketRecipes?.[fill.recipeId] : undefined;
              const effect =
                fill && recipe?.effects.length ? effectOf(recipe, fill.stat) : undefined;
              const fixed = effect ? fixedValue(effect.ranges) : null;
              const bad = ev.badSockets.has(i);
              const errId = `${idBase}-socket-${i}`;
              const label = `第 ${i + 1} 槽`;
              const value = fixed == null && effect ? parseInteger(fill!.value) : NaN;
              return (
                <div
                  key={i}
                  className={cn(
                    "overflow-hidden rounded-lg border",
                    !recipe && "border-dashed border-border/80",
                    recipe && !bad && "border-border/60",
                    bad && "border-destructive/50",
                  )}
                >
                  <div className="grid grid-cols-[4.5rem_minmax(0,1fr)] items-center gap-3 px-3 py-2">
                    <span className="flex items-center gap-1.5 text-xs whitespace-nowrap text-muted-foreground">
                      <GemIcon className="size-3.5 shrink-0" aria-hidden />
                      {label}
                    </span>
                    <Select
                      value={recipe ? String(recipe.id) : "empty"}
                      disabled={!recipes.length}
                      onValueChange={(v) => {
                        const next = recipes.find((r) => String(r.id) === v);
                        setSocket(i, next ? fillFor(next, next.effects[0].stat) : null);
                      }}
                    >
                      <SelectTrigger className="w-full" aria-label={`${label}配方`}>
                        <SelectValue>
                          {(v: unknown) =>
                            v === "empty"
                              ? "空槽"
                              : (recipes.find((r) => String(r.id) === v)?.name ?? "空槽")
                          }
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="empty">空槽</SelectItem>
                        {recipes.map((r) => (
                          <SelectItem key={r.id} value={String(r.id)}>
                            {r.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {recipe && effect && (
                    <div
                      className={cn(
                        "grid grid-cols-[minmax(0,1fr)_5.5rem] items-center gap-x-3 gap-y-1.5 border-t px-3 py-2",
                        bad
                          ? "border-destructive/30 bg-destructive/5"
                          : "border-border/60 bg-muted/40",
                      )}
                    >
                      {recipe.effects.length > 1 ? (
                        <Select
                          value={effect.stat}
                          onValueChange={(v) => v && setSocket(i, fillFor(recipe, v as StatKey))}
                        >
                          <SelectTrigger className="w-full" aria-label={`${label}屬性`}>
                            <SelectValue>{(v: unknown) => STAT_LABELS[v as StatKey]}</SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            {recipe.effects.map((e) => (
                              <SelectItem key={e.stat} value={e.stat}>
                                {STAT_LABELS[e.stat]}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <span className="flex items-center gap-2 text-sm">
                          {fixed != null && (
                            <LockIcon className="size-3.5 text-muted-foreground" aria-hidden />
                          )}
                          {STAT_LABELS[effect.stat]}
                        </span>
                      )}
                      {fixed != null ? (
                        <span className="text-right text-sm font-medium tabular-nums">
                          {signed(fixed)}
                        </span>
                      ) : (
                        <Input
                          inputMode="numeric"
                          aria-label={`${label}數值`}
                          value={fill!.value}
                          aria-invalid={bad || undefined}
                          aria-describedby={bad ? errId : undefined}
                          onFocus={selectOnFocus}
                          onChange={(e) => setSocket(i, { ...fill!, value: e.target.value })}
                          className={cn(valueInput, "bg-background")}
                        />
                      )}
                      {fixed == null && (
                        <p className="col-span-full flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground tabular-nums">
                          <span>{effect.ranges.length > 1 ? "檔位" : "範圍"}</span>
                          {sortRanges(effect.ranges).map((r) => {
                            const current = inRanges(value, [r]);
                            return (
                              <span
                                key={rangeText(r)}
                                className={cn(
                                  "whitespace-nowrap",
                                  current && "font-medium text-foreground",
                                )}
                              >
                                {rangeText(r)}
                                {current && effect.ranges.length > 1 && "（目前）"}
                              </span>
                            );
                          })}
                        </p>
                      )}
                      {bad && <FieldError id={errId} ranges={effect.ranges} />}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </Section>
      )}

      <Section icon={<SigmaIcon aria-hidden />} title="本件合計">
        {order.length ? (
          <ul className="divide-y divide-border/60 overflow-hidden rounded-lg border border-border/60 bg-muted/30">
            {order.map((k) => {
              const list = parts.get(k) ?? [];
              const total = list.reduce((s, p) => s + p.amount, 0);
              const waiting = pending.has(k);
              return (
                <li key={k} className="flex items-baseline gap-2 px-3 py-1.5 text-sm">
                  <span>{STAT_LABELS[k]}</span>
                  <span
                    className={cn(
                      "text-[11px]",
                      waiting ? "text-destructive" : "text-muted-foreground",
                    )}
                  >
                    {waiting
                      ? "數值待修正"
                      : list.length === 1
                        ? list[0].source
                        : list.map((p) => `${p.source} ${fmt(p.amount)}`).join(" ＋ ")}
                  </span>
                  <span className="flex-1 -translate-y-1 border-b border-dotted border-border" />
                  <span
                    className={cn("font-medium tabular-nums", waiting && "text-muted-foreground")}
                  >
                    {signed(total)}
                  </span>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-xs text-muted-foreground">這件道具目前沒有會影響面板的數值。</p>
        )}
        {legacy && (
          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border border-border/60 bg-muted/40 px-3 py-2">
            <p className="flex min-w-0 flex-1 basis-full items-start gap-2 text-xs text-muted-foreground sm:basis-auto">
              <HistoryIcon className="mt-0.5 size-3.5 shrink-0" aria-hidden />
              <span>此裝備有舊版手動合計（{legacy}），本件合計不含這筆，面板會另外加上。</span>
            </p>
            <Button
              size="sm"
              variant="outline"
              onClick={() => onChange({ ...draft, manualBonuses: {} })}
            >
              清除舊合計
            </Button>
          </div>
        )}
      </Section>
    </>
  );
}
