"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ChevronRightIcon,
  CircleAlertIcon,
  ClockIcon,
  InfoIcon,
  MinusIcon,
  PlusIcon,
  SwordIcon,
  SwordsIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsiblePanel, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Combobox,
  ComboboxCollection,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type { DamageSupport } from "@/configs/stat-sim-damage";
import {
  computeCombo,
  computeDamage,
  computeMarginal,
  expectedPerCast,
  groupFamilies,
  LEVEL_TOO_LOW,
  type ComboCounts,
  type DamageRange,
  type NormalMode,
  type SkillDamage,
} from "@/lib/stat-sim-damage";
import type {
  CharacterV1,
  DamageData,
  DamageMonster,
  GameData,
  PanelResult,
} from "@/lib/types/stat-sim";
import { cn } from "@/lib/utils";
import { STAT_LABELS, fmt } from "./labels";

const box = "overflow-hidden rounded-xl bg-card text-sm ring-1 ring-foreground/10";
const head = "flex items-baseline gap-2 border-b border-border/60 bg-muted/30 px-4 py-2.5";
const MONSTER_KEY = "genbu.stat-sim.damage-monster";
const comboKey = (characterId: string) => `genbu.stat-sim.damage-combo.${characterId}`;
const MAX_RESULTS = 50;
const MAX_COUNT = 999;
const NORMAL = "normal";

let request: Promise<DamageData> | null = null;
function loadDamageData(): Promise<DamageData> {
  request ??= fetch("/api/stat-sim/damage").then(async (res) => {
    if (!res.ok) throw new Error("無法取得傷害試算資料");
    return (await res.json()) as DamageData;
  });
  // 失敗時清掉，下次打開分頁可以重試。
  request.catch(() => {
    request = null;
  });
  return request;
}

interface SavedCombo {
  counts: ComboCounts;
  /** 加入連段的順序；物件的數字 key 會被自動排序，所以另外記。 */
  order: string[];
  levels: Record<number, number>;
  normalMode: NormalMode;
}
const EMPTY_COMBO: SavedCombo = { counts: {}, order: [], levels: {}, normalMode: "normal" };

/** 連段跟著角色存在這台瀏覽器；讀不到（無痕、封鎖）就從空的開始。 */
function readCombo(characterId: string): SavedCombo {
  try {
    const raw = localStorage.getItem(comboKey(characterId));
    if (!raw) return EMPTY_COMBO;
    const parsed = JSON.parse(raw) as Partial<SavedCombo>;
    const counts = parsed.counts ?? {};
    const order = (parsed.order ?? []).filter((key) => key in counts);
    return {
      counts,
      order: [...order, ...Object.keys(counts).filter((key) => !order.includes(key))],
      levels: parsed.levels ?? {},
      normalMode: parsed.normalMode === "critical" ? "critical" : "normal",
    };
  } catch {
    return EMPTY_COMBO;
  }
}

function save(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // 無痕模式或封鎖儲存時就不記住，不影響計算。
  }
}

function readMonsterId(): number | null {
  try {
    const raw = localStorage.getItem(MONSTER_KEY);
    return raw ? Number(raw) : null;
  } catch {
    return null;
  }
}

const SUPPORT_BADGE: Record<DamageSupport, { label: string; variant: "secondary" | "outline" }> = {
  verified: { label: "已實測", variant: "secondary" },
  presumed: { label: "推定", variant: "outline" },
  unsupported: { label: "尚未支援", variant: "outline" },
};

function SupportBadge({ support }: { support: DamageSupport }) {
  const { label, variant } = SUPPORT_BADGE[support];
  return (
    <Badge
      variant={variant}
      className={support === "unsupported" ? "border-dashed text-muted-foreground" : ""}
    >
      {label}
    </Badge>
  );
}

/** 「～」後可以換行，手機上窄欄才放得下。 */
const range = (r: DamageRange) =>
  r.min === r.max ? (
    fmt(r.min)
  ) : (
    <>
      {fmt(r.min)}～<wbr />
      {fmt(r.max)}
    </>
  );
const round = (n: number) => fmt(Math.round(n));
/** 排行用的短數字：72,684 → 72.7k。 */
const compact = (n: number) =>
  n >= 1_000_000
    ? `${(n / 1_000_000).toFixed(2)}M`
    : n >= 1_000
      ? `${(n / 1_000).toFixed(1)}k`
      : round(n);

function SkillIcon({ url }: { url: string | null }) {
  if (!url) {
    return (
      <span className="flex size-6 shrink-0 items-center justify-center rounded-sm bg-muted text-muted-foreground">
        <SwordIcon className="size-3.5" aria-hidden />
      </span>
    );
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={url} alt="" className="size-6 shrink-0 rounded-sm" />;
}

function MonsterPicker({
  monsters,
  value,
  onChange,
}: {
  monsters: DamageMonster[];
  value: DamageMonster | null;
  onChange: (monster: DamageMonster) => void;
}) {
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => {
    const q = query.trim();
    const hits = q ? monsters.filter((m) => m.name.includes(q) || String(m.level) === q) : monsters;
    return hits.slice(0, MAX_RESULTS);
  }, [monsters, query]);
  return (
    <Combobox
      items={filtered}
      filter={null}
      value={value}
      itemToStringLabel={(m: DamageMonster) => m.name}
      inputValue={query}
      onInputValueChange={setQuery}
      onValueChange={(picked) => {
        if (!picked) return;
        onChange(picked as DamageMonster);
        setQuery("");
      }}
    >
      <ComboboxInput
        className="w-full"
        placeholder={value ? `${value.name} Lv${value.level}` : "搜尋怪物名稱或等級…"}
        aria-label="目標怪物"
      />
      <ComboboxContent>
        <ComboboxEmpty>查無符合「{query.trim()}」的怪物</ComboboxEmpty>
        <ComboboxList>
          <ComboboxCollection>
            {(m: DamageMonster) => (
              <ComboboxItem key={m.id} value={m}>
                <span className="flex-1 truncate">{m.name}</span>
                <span className="font-mono text-xs text-muted-foreground">
                  Lv{m.level}・防 {m.extraDef}／護 {m.magicDef}
                </span>
              </ComboboxItem>
            )}
          </ComboboxCollection>
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  );
}

function LevelSelect({ row, onLevel }: { row: SkillDamage; onLevel: (level: number) => void }) {
  return (
    <Select value={String(row.level)} onValueChange={(v) => v != null && onLevel(Number(v))}>
      <SelectTrigger
        size="sm"
        className="w-[4.5rem] bg-card px-2"
        aria-label={`${row.skill.name}等級`}
      >
        <SelectValue>{(v: unknown) => `Lv${String(v)}`}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        {row.level === 0 && (
          <SelectItem value="0" disabled>
            Lv0（還學不到）
          </SelectItem>
        )}
        {Array.from({ length: row.maxLevel }, (_, i) => row.maxLevel - i).map((n) => (
          <SelectItem key={n} value={String(n)}>
            Lv{n}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function AddButton({ name, onAdd }: { name: string; onAdd: () => void }) {
  return (
    <Button size="icon-sm" variant="secondary" aria-label={`加入連段：${name}`} onClick={onAdd}>
      <PlusIcon />
    </Button>
  );
}

/** 排行的一列：圖示、名稱、長條、每次施放的期望傷害、加入連段。 */
function RankRow({
  icon,
  name,
  sub,
  value,
  ratio,
  badge,
  onAdd,
}: {
  icon: string | null;
  name: string;
  sub?: React.ReactNode;
  value: number;
  ratio: number;
  badge?: React.ReactNode;
  onAdd: () => void;
}) {
  return (
    <li className="grid grid-cols-[minmax(0,9rem)_minmax(0,1fr)_3.5rem_2rem] items-center gap-2.5 border-t border-border/60 px-4 py-2">
      <div className="flex min-w-0 items-center gap-2">
        <SkillIcon url={icon} />
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="truncate font-medium">{name}</span>
            {badge}
          </div>
          {sub && <div className="truncate text-xs text-muted-foreground">{sub}</div>}
        </div>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden>
        <div
          className="h-full rounded-full bg-primary"
          style={{ width: `${Math.max(1, ratio * 100)}%` }}
        />
      </div>
      <span className="text-right font-mono">{compact(value)}</span>
      <AddButton name={name} onAdd={onAdd} />
    </li>
  );
}

function Stepper({
  name,
  count,
  onChange,
}: {
  name: string;
  count: number;
  onChange: (count: number) => void;
}) {
  return (
    <div className="flex h-8 items-center overflow-hidden rounded-md ring-1 ring-border">
      <Button
        size="icon-sm"
        variant="ghost"
        className="rounded-none"
        aria-label={`${name}減少一次`}
        onClick={() => onChange(count - 1)}
      >
        <MinusIcon />
      </Button>
      <input
        type="number"
        inputMode="numeric"
        min={0}
        max={MAX_COUNT}
        value={count}
        aria-label={`${name}次數`}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-full w-10 [appearance:textfield] bg-transparent text-center font-mono text-sm outline-none focus-visible:bg-muted/50 [&::-webkit-inner-spin-button]:appearance-none"
      />
      <Button
        size="icon-sm"
        variant="ghost"
        className="rounded-none"
        aria-label={`${name}增加一次`}
        onClick={() => onChange(count + 1)}
      >
        <PlusIcon />
      </Button>
    </div>
  );
}

function skillSummary(row: SkillDamage): string {
  const v = row.variants;
  if (v.length > 1) {
    return `期望 ${round(expectedPerCast(row)!)}（${v[0].chance}% 觸發）`;
  }
  const perHit = (v[0].perHit.min + v[0].perHit.max) / 2;
  return row.hits > 1 ? `${round(perHit)} × ${row.hits} 段` : round(perHit);
}

export function DamageTab({
  character,
  data,
  panel,
}: {
  character: CharacterV1;
  data: GameData;
  panel: PanelResult | null;
}) {
  const [damageData, setDamageData] = useState<DamageData | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [monsterId, setMonsterId] = useState<number | null>(null);
  const [combo, setCombo] = useState<SavedCombo>(EMPTY_COMBO);

  useEffect(() => {
    let alive = true;
    loadDamageData()
      .then((d) => {
        if (!alive) return;
        setDamageData(d);
        setMonsterId((current) => current ?? readMonsterId());
        setCombo(readCombo(character.id));
      })
      .catch((e: unknown) => alive && setLoadError(e instanceof Error ? e.message : String(e)));
    return () => {
      alive = false;
    };
    // 元件以角色 id 為 key 掛載，換角色會重新掛載，不需要跟著 character 重跑。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const updateCombo = (next: (prev: SavedCombo) => SavedCombo) =>
    setCombo((prev) => {
      const value = next(prev);
      save(comboKey(character.id), JSON.stringify(value));
      return value;
    });
  const setCount = (key: string, count: number) =>
    updateCombo((prev) => {
      const counts = { ...prev.counts };
      const n = Math.min(MAX_COUNT, Math.max(0, Math.floor(count) || 0));
      if (n === 0) delete counts[key];
      else counts[key] = n;
      const order =
        n === 0
          ? prev.order.filter((k) => k !== key)
          : prev.order.includes(key)
            ? prev.order
            : [...prev.order, key];
      return { ...prev, counts, order };
    });
  const add = (key: string) => setCount(key, (combo.counts[key] ?? 0) + 1);
  const setLevel = (id: number, level: number) =>
    updateCombo((prev) => ({ ...prev, levels: { ...prev.levels, [id]: level } }));

  const monster = useMemo(
    () => damageData?.monsters.find((m) => m.id === monsterId) ?? null,
    [damageData, monsterId],
  );
  const input = useMemo(
    () =>
      damageData && monster && panel
        ? {
            character,
            data,
            panel,
            monster,
            skills: damageData.skills,
            skillLevels: combo.levels,
          }
        : null,
    [character, data, panel, monster, damageData, combo.levels],
  );
  const result = useMemo(() => (input ? computeDamage(input) : null), [input]);
  const comboResult = useMemo(
    () => (result ? computeCombo(result, combo.counts, combo.normalMode) : null),
    [result, combo.counts, combo.normalMode],
  );
  const marginal = useMemo(
    () => (input ? computeMarginal(input, combo.counts, combo.normalMode) : null),
    [input, combo.counts, combo.normalMode],
  );

  const pickMonster = (m: DamageMonster) => {
    setMonsterId(m.id);
    save(MONSTER_KEY, String(m.id));
  };

  if (loadError) {
    return (
      <p role="alert" className="text-sm text-destructive">
        {loadError}，請重新整理頁面再試。
      </p>
    );
  }
  if (!damageData) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">正在載入怪物與技能資料…</p>
    );
  }

  const computable = result?.skills.filter((s) => s.variants.length > 0) ?? [];
  // 只是等級不夠的招留在「低階與還學不到」，調高等級就能算。
  const unsupported =
    result?.skills.filter(
      (s) => s.support === "unsupported" && !s.reasons.includes(LEVEL_TOO_LOW),
    ) ?? [];
  const { top, lower } = groupFamilies(
    result?.skills.filter((s) => !unsupported.includes(s)) ?? [],
  );
  const ranked = top
    .filter((s) => s.variants.length > 0)
    .sort((a, b) => expectedPerCast(b)! - expectedPerCast(a)!);
  const normalMid = result?.normal ? (result.normal.min + result.normal.max) / 2 : null;
  const best = Math.max(normalMid ?? 0, ...ranked.map((s) => expectedPerCast(s)!));
  const comboKeys = combo.order.filter(
    (key) => key === NORMAL || computable.some((s) => String(s.skill.id) === key),
  );
  const attack = result?.weapon.rule?.attack === "matk" ? "pow" : "str";

  return (
    <div className="space-y-4">
      <section className={box} aria-label="目標怪物">
        <header className={head}>
          <h2 className="font-heading text-sm font-semibold">目標怪物</h2>
        </header>
        <div className="space-y-2 px-4 py-3">
          <MonsterPicker monsters={damageData.monsters} value={monster} onChange={pickMonster} />
          {monster ? (
            <p className="text-xs text-muted-foreground">
              Lv{monster.level}・防禦 {fmt(monster.extraDef)}・護勁 {fmt(monster.magicDef)}・血量{" "}
              <span className="font-mono text-foreground">{fmt(monster.hp)}</span>
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">
              選一隻怪，算出你打牠每招多少、幾招打完。
            </p>
          )}
        </div>
      </section>

      {!panel && <p className="text-sm text-muted-foreground">面板算不出來，請先修正基本資料。</p>}

      {result && (
        <>
          <section className={box} aria-label="招式排行">
            <header className={head}>
              <SwordsIcon className="size-4 self-center text-muted-foreground" aria-hidden />
              <h2 className="font-heading text-sm font-semibold">招式排行</h2>
              <span className="text-xs text-muted-foreground">每次施放</span>
              <span className="ml-auto truncate text-xs text-muted-foreground">
                {result.weapon.label}
              </span>
              <SupportBadge support={result.weapon.support} />
            </header>
            <div className="space-y-1 px-4 pt-2.5 pb-2">
              {result.weapon.rule && result.weapon.attack != null && (
                <p className="text-xs text-muted-foreground">
                  {result.weapon.rule.attack === "atk" ? "物攻" : "內勁"}{" "}
                  {fmt(result.weapon.attack)}
                  {result.weapon.weaponDamage && result.weapon.weaponDamage.max > 0 && (
                    <> ＋ 武器 {range(result.weapon.weaponDamage)}</>
                  )}
                  ，打{result.weapon.rule.defense === "extraDef" ? "防禦" : "護勁"}{" "}
                  {fmt(result.defense)}
                </p>
              )}
              {[...result.weapon.reasons, ...result.caveats].map((text) => (
                <p key={text} className="flex items-start gap-1.5 text-xs text-muted-foreground">
                  <CircleAlertIcon className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                  {text}
                </p>
              ))}
            </div>
            <ul>
              {ranked.map((row) => (
                <RankRow
                  key={row.skill.id}
                  icon={row.skill.iconUrl}
                  name={row.skill.name}
                  sub={`Lv${row.level}`}
                  value={expectedPerCast(row)!}
                  ratio={expectedPerCast(row)! / best}
                  badge={row.support === "presumed" && <SupportBadge support="presumed" />}
                  onAdd={() => add(String(row.skill.id))}
                />
              ))}
              {normalMid != null && result.critical && (
                <RankRow
                  icon={null}
                  name="普攻"
                  sub={`重擊 ${round((result.critical.min + result.critical.max) / 2)}`}
                  value={normalMid}
                  ratio={normalMid / best}
                  onAdd={() => add(NORMAL)}
                />
              )}
            </ul>
            {result.weapon.support === "unsupported" && (
              <p className="px-4 pb-3 text-xs text-muted-foreground">目前的武器無法試算。</p>
            )}
            {lower.length > 0 && (
              <Collapsible className="border-t border-border/60">
                <CollapsibleTrigger className="group flex items-center gap-2 px-4 py-2.5 text-xs text-muted-foreground hover:bg-muted/50">
                  <ChevronRightIcon
                    className="size-3.5 transition-transform group-data-[panel-open]:rotate-90"
                    aria-hidden
                  />
                  低階與還學不到的招式（{lower.length}）
                </CollapsibleTrigger>
                <CollapsiblePanel>
                  <ul className="pb-1">
                    {lower.map((row) => (
                      <li
                        key={row.skill.id}
                        className="flex items-center gap-2 border-t border-border/40 px-4 py-2"
                      >
                        <SkillIcon url={row.skill.iconUrl} />
                        <span className="min-w-0 flex-1 truncate">{row.skill.name}</span>
                        <LevelSelect row={row} onLevel={(lv) => setLevel(row.skill.id, lv)} />
                        <span className="w-14 text-right font-mono text-xs text-muted-foreground">
                          {row.variants.length > 0 ? compact(expectedPerCast(row)!) : "—"}
                        </span>
                        {row.variants.length > 0 ? (
                          <AddButton
                            name={row.skill.name}
                            onAdd={() => add(String(row.skill.id))}
                          />
                        ) : (
                          <span className="w-8" />
                        )}
                      </li>
                    ))}
                  </ul>
                </CollapsiblePanel>
              </Collapsible>
            )}
            {unsupported.length > 0 && (
              <Collapsible className="border-t border-border/60">
                <CollapsibleTrigger className="group flex items-center gap-2 px-4 py-2.5 text-xs text-muted-foreground hover:bg-muted/50">
                  <ChevronRightIcon
                    className="size-3.5 transition-transform group-data-[panel-open]:rotate-90"
                    aria-hidden
                  />
                  尚未支援的招式（{unsupported.length}）
                </CollapsibleTrigger>
                <CollapsiblePanel>
                  <ul className="space-y-2 px-4 pb-3 text-xs">
                    {unsupported.map((row) => (
                      <li key={row.skill.id} className="flex items-start gap-2">
                        <SkillIcon url={row.skill.iconUrl} />
                        <div className="min-w-0">
                          <div className="text-sm">{row.skill.name}</div>
                          <div className="text-muted-foreground">{row.reasons.join("；")}</div>
                        </div>
                      </li>
                    ))}
                  </ul>
                </CollapsiblePanel>
              </Collapsible>
            )}
          </section>

          <section className={box} aria-label="連段試算">
            <header className={head}>
              <h2 className="font-heading text-sm font-semibold">連段試算</h2>
              <span className="text-xs text-muted-foreground">一輪的內容</span>
              {comboKeys.length > 0 && (
                <Button
                  size="xs"
                  variant="ghost"
                  className="ml-auto self-center"
                  onClick={() => updateCombo((prev) => ({ ...prev, counts: {}, order: [] }))}
                >
                  清空
                </Button>
              )}
            </header>
            {comboKeys.length === 0 ? (
              <p className="px-4 py-6 text-center text-xs text-muted-foreground">
                按排行旁的 <PlusIcon className="inline size-3.5 align-[-2px]" aria-label="加號" />{" "}
                把招式加進來，算一輪打多少、幾輪打完。
              </p>
            ) : (
              <>
                <ul>
                  {comboKeys.map((key) => {
                    const count = combo.counts[key];
                    const line = comboResult?.lines.find((l) => l.key === key);
                    const row = computable.find((s) => String(s.skill.id) === key);
                    const name = row ? row.skill.name : "普攻";
                    return (
                      <li
                        key={key}
                        className="grid grid-cols-[minmax(0,1fr)_auto_5.5rem] items-center gap-2.5 border-t border-border/60 px-4 py-2 first:border-t-0"
                      >
                        <div className="flex min-w-0 items-center gap-2">
                          <SkillIcon url={row?.skill.iconUrl ?? null} />
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="truncate font-medium">{name}</span>
                            </div>
                            {row ? (
                              <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                                <LevelSelect
                                  row={row}
                                  onLevel={(lv) => setLevel(row.skill.id, lv)}
                                />
                                <span className="font-mono">{skillSummary(row)}</span>
                              </div>
                            ) : null}
                          </div>
                        </div>
                        <Stepper name={name} count={count} onChange={(n) => setCount(key, n)} />
                        <span className="text-right font-mono">
                          {line ? round(line.expected) : "—"}
                        </span>
                        {!row && (
                          <div className="col-span-full flex flex-wrap items-center gap-2 pl-8">
                            <ToggleGroup
                              aria-label="普攻重擊"
                              value={[combo.normalMode]}
                              onValueChange={(v) =>
                                v[0] &&
                                updateCombo((prev) => ({ ...prev, normalMode: v[0] as NormalMode }))
                              }
                            >
                              <ToggleGroupItem value="normal" size="sm">
                                不計重擊
                              </ToggleGroupItem>
                              <ToggleGroupItem value="critical" size="sm">
                                全重擊
                              </ToggleGroupItem>
                            </ToggleGroup>
                            <span className="text-xs text-muted-foreground">只有普攻會重擊</span>
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>

                {comboResult && comboResult.lines.length > 0 && (
                  <div className="space-y-3 border-t border-border bg-muted/20 px-4 py-3.5">
                    <div className="flex items-baseline gap-2">
                      <span className="font-semibold">一輪期望</span>
                      <span className="ml-auto font-mono text-xl font-medium">
                        {round(comboResult.total.expected)}
                      </span>
                    </div>
                    <p className="-mt-2 text-right font-mono text-xs text-muted-foreground">
                      最差 {fmt(comboResult.total.min)}～最好 {fmt(comboResult.total.max)}
                    </p>
                    <div className="space-y-1">
                      <div
                        role="meter"
                        aria-label="一輪打掉的血量"
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-valuenow={Math.round(comboResult.progress * 100)}
                        className="h-2.5 overflow-hidden rounded-full bg-muted"
                      >
                        <div
                          className="h-full rounded-full bg-primary"
                          style={{ width: `${comboResult.progress * 100}%` }}
                        />
                      </div>
                      <div className="flex text-xs text-muted-foreground">
                        <span>打掉 {Math.round(comboResult.progress * 100)}%</span>
                        <span className="ml-auto">
                          剩 <span className="font-mono">{round(comboResult.remaining)}</span>
                        </span>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="rounded-lg bg-card px-3 py-2 ring-1 ring-foreground/10">
                        <div className="text-xs text-muted-foreground">打完需要</div>
                        <div>
                          <span className="font-mono text-lg font-medium">
                            {comboResult.rounds == null
                              ? "—"
                              : comboResult.rounds < 10
                                ? comboResult.rounds.toFixed(1)
                                : fmt(Math.ceil(comboResult.rounds))}
                          </span>{" "}
                          輪
                        </div>
                      </div>
                      <div className="rounded-lg bg-card px-3 py-2 ring-1 ring-foreground/10">
                        <div className="text-xs text-muted-foreground">一輪真氣</div>
                        <div>
                          <span
                            className={cn(
                              "font-mono text-lg font-medium",
                              panel?.stats.mp.value != null &&
                                comboResult.mp > panel.stats.mp.value &&
                                "text-destructive",
                            )}
                          >
                            {fmt(comboResult.mp)}
                          </span>
                          {panel?.stats.mp.value != null && (
                            <span className="font-mono text-xs text-muted-foreground">
                              {" "}
                              ／ {fmt(panel.stats.mp.value)}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {marginal && (
                  <div className="space-y-1.5 border-t border-border/60 px-4 py-3">
                    <div className="text-[13px] font-medium">再加 1 點，這一輪多</div>
                    {marginal
                      .filter((m) => m.key === attack || (m.combo ?? 0) !== 0)
                      .map((m) => (
                        <div key={m.key} className="flex items-baseline gap-2 text-[13px]">
                          <span>{STAT_LABELS[m.key]}</span>
                          <span className="font-mono text-xs text-muted-foreground">
                            成本 {m.nextCost}
                          </span>
                          <span className="ml-auto font-mono font-medium text-primary">
                            {m.combo == null ? "—" : `+${round(m.combo)}`}
                            {m.combo != null && comboResult && comboResult.total.expected > 0 && (
                              <span className="text-xs font-normal text-muted-foreground">
                                （+{((m.combo / comboResult.total.expected) * 100).toFixed(2)}%）
                              </span>
                            )}
                          </span>
                        </div>
                      ))}
                    <p className="flex items-start gap-1.5 text-xs leading-relaxed text-muted-foreground">
                      <InfoIcon className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                      {marginal
                        .filter((m) => m.key !== attack && (m.combo ?? 0) === 0)
                        .filter((m) => m.key !== "dex" && m.key !== "wis" && m.key !== "agi")
                        .map((m) => STAT_LABELS[m.key])
                        .join("、")}
                      ：0。技巧、玄學只影響普攻的重擊率（技能不會重擊），身法影響攻速，都還沒算進來。
                    </p>
                  </div>
                )}
              </>
            )}
          </section>

          <section
            className="flex items-center gap-2.5 rounded-xl border border-dashed border-border px-4 py-3"
            aria-label="DPS（之後開放）"
          >
            <ClockIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            <div className="min-w-0 flex-1">
              <div className="text-[13px] font-medium text-muted-foreground">DPS・打完要幾秒</div>
              <div className="text-xs text-muted-foreground">
                要先實測招式硬直（stun）和普攻間隔
              </div>
            </div>
            <Badge variant="outline" className="border-dashed text-muted-foreground">
              之後開放
            </Badge>
          </section>

          <p className="text-xs leading-relaxed text-muted-foreground">
            公式來自封包逐下實測：傷害 ≈ 倍率 × (攻擊 + 武器) × K ÷ (K + 防禦) − 防禦 ÷ 2，K = 5 ×
            怪物等級 +
            500。機率觸發的招式取期望值。同一種怪的不同隻之間會差幾點。武器真解對技能的影響還沒測過。
          </p>
        </>
      )}
    </div>
  );
}
