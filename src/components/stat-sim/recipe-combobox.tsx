"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Combobox as ComboboxPrimitive } from "@base-ui/react";
import { CheckIcon, ChevronsUpDownIcon, FilterIcon, SearchIcon, SearchXIcon } from "lucide-react";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { STAT_KEYS, type SocketRecipe, type StatKey, type ValueRange } from "@/lib/types/stat-sim";
import { cn } from "@/lib/utils";
import { STAT_LABELS, formatRanges, signed } from "./labels";

/* ---------- 合併：同一隻怪的各種強化，效果一樣就併成一筆 ---------- */

const SUFFIXES = [
  "小真元強化",
  "大真元強化",
  "真元強化裝備",
  "真元強化",
  "強化裝備",
  "強化",
  "魂珠強化",
  "魂石強化",
];
/** 這幾種是同一隻怪的不同做法，單獨一種時寫「僅強化裝備」。 */
const VARIANTS = new Set(["小真元強化", "大真元強化", "真元強化裝備", "真元強化", "強化裝備"]);
// 「真元強化裝備」要排在「真元強化」「強化裝備」前面，否則會切成「入魔妖僧真元」。
const SUFFIX_RE = /(小真元強化|大真元強化|真元強化裝備|真元強化|強化裝備|魂珠強化|魂石強化|強化)$/;
/** 篩選 chip 的順序：先攻擊、再防禦、再六圍。 */
const CHIP_ORDER: StatKey[] = [
  "atk",
  "matk",
  "hit",
  "def",
  "mdef",
  "hp",
  "mp",
  "str",
  "pow",
  "vit",
  "dex",
  "agi",
  "wis",
  "critical",
  "dodge",
  "uncanny_dodge",
];
const EMPTY = "empty";

export function splitRecipeName(name: string): { stem: string; suffix: string | null } {
  const suffix = name.match(SUFFIX_RE)?.[1] ?? null;
  if (!suffix) return { stem: name, suffix };
  // 「吉魂珠強化」要留「吉魂珠」，只剩「吉」看不懂
  const cut = suffix === "魂珠強化" || suffix === "魂石強化" ? 2 : suffix.length;
  return { stem: name.slice(0, -cut) || name, suffix };
}

const fixedOf = (ranges: ValueRange[]) =>
  ranges.length === 1 && ranges[0][0] === ranges[0][1] ? ranges[0][0] : null;
const minOf = (ranges: ValueRange[]) => Math.min(...ranges.map((r) => r[0]));

export interface RecipeGroup {
  key: string;
  stem: string;
  recipes: SocketRecipe[];
  sub: string;
  random: boolean;
  effectText: string;
  /** 排序用：固定值，隨機取最小值。 */
  values: Partial<Record<StatKey, number>>;
}

export function groupRecipes(recipes: SocketRecipe[]): RecipeGroup[] {
  const map = new Map<string, { stem: string; recipes: SocketRecipe[]; suffixes: Set<string> }>();
  for (const recipe of recipes) {
    const { stem, suffix } = splitRecipeName(recipe.name);
    const sig = recipe.effects
      .map(
        (e) =>
          `${e.stat}:${JSON.stringify([...e.ranges].sort((x, y) => x[0] - y[0] || x[1] - y[1]))}`,
      )
      .sort()
      .join("|");
    const key = `${stem}\u0000${sig}`;
    const g = map.get(key) ?? { stem, recipes: [], suffixes: new Set<string>() };
    g.recipes.push(recipe);
    if (suffix) g.suffixes.add(suffix);
    map.set(key, g);
  }
  return [...map].map(([key, g]) => {
    const effects = g.recipes[0].effects;
    const random = effects.some((e) => fixedOf(e.ranges) == null);
    const suffixes = SUFFIXES.filter((s) => g.suffixes.has(s));
    const names =
      suffixes.length === 1 && VARIANTS.has(suffixes[0]) ? `僅${suffixes[0]}` : suffixes.join("／");
    return {
      key,
      stem: g.stem,
      recipes: g.recipes,
      sub: [names, random && "數值隨機"].filter(Boolean).join("　"),
      random,
      effectText: effects
        .map((e) => {
          const fixed = fixedOf(e.ranges);
          return `${STAT_LABELS[e.stat]} ${fixed != null ? signed(fixed) : formatRanges(e.ranges)}`;
        })
        .join("／"),
      values: Object.fromEntries(
        effects.map((e) => [e.stat, fixedOf(e.ranges) ?? minOf(e.ranges)]),
      ),
    };
  });
}

function Highlight({ text, q }: { text: string; q: string }) {
  const at = q ? text.toLowerCase().indexOf(q) : -1;
  if (at < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, at)}
      <mark className="rounded-[3px] bg-amber-200/70 px-px text-foreground dark:bg-amber-500/30">
        {text.slice(at, at + q.length)}
      </mark>
      {text.slice(at + q.length)}
    </>
  );
}

/* ---------- 元件 ---------- */

interface Props {
  /** 「第 1 槽」，也用在無障礙名稱。 */
  label: string;
  recipes: SocketRecipe[];
  /** 目前插的配方；舊存檔的 id 不在清單裡也能顯示。 */
  value: SocketRecipe | undefined;
  disabled?: boolean;
  onChange: (recipe: SocketRecipe | null) => void;
}

/** 桌機是錨定在按鈕下的 popover，手機改成貼底的 sheet（同一個 popup，靠 max-sm 樣式切換）。 */
export function RecipeCombobox({ label, recipes, value, disabled, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [chip, setChip] = useState<StatKey | null>(null);
  const chipRefs = useRef(new Map<string, HTMLButtonElement>());
  const listRef = useRef<HTMLDivElement>(null);

  const groups = useMemo(() => groupRecipes(recipes), [recipes]);
  const chips = useMemo(() => {
    const present = new Set(groups.flatMap((g) => Object.keys(g.values) as StatKey[]));
    return [...new Set([...CHIP_ORDER, ...STAT_KEYS])].filter((k) => present.has(k));
  }, [groups]);
  const byKey = useMemo(() => new Map(groups.map((g) => [g.key, g])), [groups]);
  const selected = value && groups.find((g) => g.recipes.some((r) => r.id === value.id));

  const kw = q.trim().toLowerCase();
  const visible = groups
    .filter((g) => chip == null || g.values[chip] != null)
    .filter(
      (g) =>
        !kw ||
        g.stem.toLowerCase().includes(kw) ||
        g.recipes.some((r) => r.name.toLowerCase().includes(kw)) ||
        Object.keys(g.values).some((k) => STAT_LABELS[k as StatKey].includes(kw)),
    )
    .sort(
      (a, b) =>
        (chip ? b.values[chip]! - a.values[chip]! : 0) ||
        a.stem.localeCompare(b.stem, "zh-Hant-TW") ||
        a.effectText.localeCompare(b.effectText, "zh-Hant-TW"),
    );
  const rows = visible.length ? [EMPTY, ...visible.map((g) => g.key)] : [];
  const scope = [chip && STAT_LABELS[chip], kw && `「${q.trim()}」`].filter(Boolean).join(" · ");

  useEffect(() => {
    if (open)
      chipRefs.current
        .get(chip ?? EMPTY)
        ?.scrollIntoView?.({ block: "nearest", inline: "nearest" });
  }, [chip, open]);

  // 重新打開時把已選的那筆捲到清單中間，不然照名稱排可能落在畫面外
  useEffect(() => {
    if (!open) return;
    const frame = requestAnimationFrame(() => {
      const list = listRef.current;
      const row = list?.querySelector<HTMLElement>("[data-selected]");
      if (list && row) list.scrollTop = row.offsetTop - (list.clientHeight - row.offsetHeight) / 2;
    });
    return () => cancelAnimationFrame(frame);
  }, [open]);

  return (
    <ComboboxPrimitive.Root
      items={rows}
      filter={null}
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setQ("");
      }}
      value={selected?.key ?? EMPTY}
      onValueChange={(key) => {
        if (key == null) return;
        const g = byKey.get(key as string);
        // 同一組效果相同，留著原本那筆 id，不必重填數值
        onChange(g ? (g.recipes.find((r) => r.id === value?.id) ?? g.recipes[0]) : null);
      }}
      inputValue={q}
      onInputValueChange={(v, details) => details.reason === "input-change" && setQ(v)}
      itemToStringLabel={(key: string) => byKey.get(key)?.stem ?? "空槽"}
      disabled={disabled}
    >
      <ComboboxPrimitive.Trigger
        aria-label={`${label}配方`}
        className="grid h-8 w-full grid-cols-[minmax(0,1fr)_1rem] items-center gap-2 rounded-lg border border-input bg-transparent px-2.5 text-left text-sm transition-colors outline-none hover:bg-muted/40 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 data-popup-open:border-ring data-popup-open:ring-3 data-popup-open:ring-ring/30 dark:bg-input/30"
      >
        {value ? (
          <span className="flex min-w-0 items-baseline gap-1.5">
            <span className="truncate font-medium">{selected?.stem ?? value.name}</span>
            {selected && (
              <span className="shrink-0 text-xs whitespace-nowrap text-muted-foreground tabular-nums">
                · {selected.effectText}
              </span>
            )}
          </span>
        ) : (
          <span className="truncate text-muted-foreground">空槽</span>
        )}
        <ChevronsUpDownIcon className="size-4 text-muted-foreground" aria-hidden />
      </ComboboxPrimitive.Trigger>

      <ComboboxPrimitive.Portal>
        {/* 手機 sheet 的遮罩；點了算外部點擊，會關閉 */}
        <div aria-hidden className="fixed inset-0 z-50 bg-black/30 sm:hidden" />
        <ComboboxPrimitive.Positioner
          side="bottom"
          align="start"
          sideOffset={6}
          className="isolate z-50 max-sm:inset-x-0! max-sm:top-auto! max-sm:bottom-0! max-sm:fixed! max-sm:transform-none!"
        >
          <ComboboxPrimitive.Popup
            aria-label={`${label}配方清單`}
            className="relative flex w-[max(var(--anchor-width),22rem)] max-w-(--available-width) origin-(--transform-origin) flex-col overflow-hidden rounded-lg bg-popover text-popover-foreground shadow-lg ring-1 ring-foreground/10 duration-100 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95 max-sm:max-h-[85vh] max-sm:w-full max-sm:max-w-none max-sm:rounded-b-none max-sm:pt-3 max-sm:data-open:slide-in-from-bottom-8 max-sm:data-open:zoom-in-100"
          >
            <span
              aria-hidden
              className="absolute top-1.5 left-1/2 h-1 w-9 -translate-x-1/2 rounded-full bg-muted-foreground/30 sm:hidden"
            />
            <div className="border-b border-border/60 p-2.5">
              <InputGroup className="h-8">
                <InputGroupAddon>
                  <SearchIcon aria-hidden />
                </InputGroupAddon>
                <ComboboxPrimitive.Input
                  render={<InputGroupInput />}
                  placeholder="搜尋怪物名稱或屬性"
                  aria-label="搜尋配方"
                />
              </InputGroup>
            </div>

            <div className="relative border-b border-border/60 bg-muted/30 after:pointer-events-none after:absolute after:inset-y-0 after:right-0 after:w-10 after:bg-linear-to-r after:from-transparent after:to-popover">
              <div
                role="group"
                aria-label="屬性篩選"
                className="flex gap-1.5 overflow-x-auto px-2.5 py-2 [scrollbar-width:thin] after:w-6 after:shrink-0"
              >
                {[null, ...chips].map((k) => (
                  <button
                    key={k ?? EMPTY}
                    ref={(el) => {
                      if (el) chipRefs.current.set(k ?? EMPTY, el);
                      else chipRefs.current.delete(k ?? EMPTY);
                    }}
                    type="button"
                    aria-pressed={chip === k}
                    // 不搶走搜尋框的焦點，方向鍵仍能操作清單
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => setChip(k)}
                    className="h-6 shrink-0 rounded-full border border-border bg-background px-2.5 text-xs whitespace-nowrap text-muted-foreground transition-colors outline-none hover:border-foreground/25 hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 aria-pressed:border-primary aria-pressed:bg-primary aria-pressed:font-medium aria-pressed:text-primary-foreground"
                  >
                    {k ? STAT_LABELS[k] : "全部"}
                  </button>
                ))}
              </div>
            </div>

            <p
              className="flex items-center gap-1.5 border-b border-border/60 px-3 py-1.5 text-[11px] text-muted-foreground"
              data-testid="recipe-count"
            >
              {kw ? (
                <SearchIcon className="size-3" aria-hidden />
              ) : (
                <FilterIcon className="size-3" aria-hidden />
              )}
              <span>
                {scope || "全部"} ·{" "}
                <b className="font-medium text-foreground/80 tabular-nums">{visible.length}</b> 筆
              </span>
              {visible.length > 0 && groups.length < recipes.length && (
                <span className="ml-auto text-[10.5px]">效果一樣的配方已合併</span>
              )}
            </p>

            {/* List 一直掛著：清單變空時卸載會把焦點弄丟，Esc 就會跑去關整個裝備視窗 */}
            <ComboboxPrimitive.Empty className="px-4 py-8 text-center text-sm text-muted-foreground empty:hidden">
              {rows.length === 0 && (
                <>
                  <SearchXIcon className="mx-auto mb-2 size-5 opacity-60" aria-hidden />
                  找不到符合的配方，換個關鍵字或把屬性改回「全部」。
                </>
              )}
            </ComboboxPrimitive.Empty>
            <div
              className={cn(
                "relative after:pointer-events-none after:absolute after:inset-x-0 after:bottom-0 after:h-8 after:bg-linear-to-b after:from-transparent after:to-popover",
                rows.length === 0 && "hidden",
              )}
            >
              <ComboboxPrimitive.List
                ref={listRef}
                className="relative h-72 overflow-y-auto overscroll-contain pb-6 [scrollbar-width:thin] max-sm:h-[45vh]"
              >
                {rows.map((key) => {
                  const g = byKey.get(key);
                  return (
                    <ComboboxPrimitive.Item
                      key={key}
                      value={key}
                      className={cn(
                        "group/opt grid cursor-default grid-cols-[1rem_minmax(0,1fr)_auto] items-center gap-2.5 border-b border-border/40 px-3 py-2 text-sm outline-none select-none last:border-b-0",
                        // 三種狀態要一眼分得出來：空槽無底色＋虛線分隔、hover muted、已選 secondary（較深）＋紅條＋勾
                        "data-highlighted:bg-muted",
                        "data-[selected]:bg-secondary data-[selected]:shadow-[inset_3px_0_0_var(--color-primary)] data-[selected]:data-highlighted:bg-secondary",
                        !g && "border-dashed border-border",
                      )}
                    >
                      <CheckIcon
                        className="size-4 stroke-3 text-primary opacity-0 group-data-[selected]/opt:opacity-100"
                        aria-hidden
                      />
                      {g ? (
                        <>
                          <span className="min-w-0">
                            <span className="block truncate font-medium group-data-[selected]/opt:font-semibold">
                              <Highlight text={g.stem} q={kw} />
                            </span>
                            {g.sub && (
                              <span className="mt-0.5 block truncate text-[11px] text-muted-foreground">
                                {g.sub}
                              </span>
                            )}
                          </span>
                          <span
                            className={cn(
                              "text-xs whitespace-nowrap tabular-nums",
                              g.random ? "text-primary" : "text-foreground",
                            )}
                          >
                            {g.effectText}
                          </span>
                        </>
                      ) : (
                        <>
                          <span className="text-muted-foreground">空槽</span>
                          <span className="text-xs text-muted-foreground/70">不插配方</span>
                        </>
                      )}
                    </ComboboxPrimitive.Item>
                  );
                })}
              </ComboboxPrimitive.List>
            </div>
          </ComboboxPrimitive.Popup>
        </ComboboxPrimitive.Positioner>
      </ComboboxPrimitive.Portal>
    </ComboboxPrimitive.Root>
  );
}
