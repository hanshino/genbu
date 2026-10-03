"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronRightIcon, CircleAlertIcon, InfoIcon, SwordsIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { DamageSupport } from "@/configs/stat-sim-damage";
import {
  computeDamage,
  computeMarginal,
  LEVEL_TOO_LOW,
  type DamageRange,
  type SkillDamage,
} from "@/lib/stat-sim-damage";
import type {
  CharacterV1,
  DamageData,
  DamageMonster,
  GameData,
  PanelResult,
} from "@/lib/types/stat-sim";
import { STAT_LABELS, fmt } from "./labels";

const box = "overflow-hidden rounded-xl bg-card text-sm ring-1 ring-foreground/10";
const head = "flex items-baseline gap-2 border-b border-border/60 bg-muted/30 px-4 py-2.5";
const MONSTER_KEY = "genbu.stat-sim.damage-monster";
const MAX_RESULTS = 50;

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

const totalMid = (s: SkillDamage) =>
  s.variants[0] ? ((s.variants[0].perHit.min + s.variants[0].perHit.max) / 2) * s.hits : 0;
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
const delta = (n: number | null) =>
  n == null ? "—" : n === 0 ? "0" : `+${Number.isInteger(n) ? fmt(n) : n.toFixed(1)}`;

function readMonsterId(): number | null {
  try {
    const raw = localStorage.getItem(MONSTER_KEY);
    return raw ? Number(raw) : null;
  } catch {
    return null;
  }
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

function SkillRow({ row, onLevel }: { row: SkillDamage; onLevel: (level: number) => void }) {
  return (
    <TableRow>
      <TableCell className="align-top">
        <div className="flex items-center gap-2">
          {row.skill.iconUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={row.skill.iconUrl} alt="" className="size-6 shrink-0 rounded-sm" />
          )}
          <span className="min-w-0 truncate">{row.skill.name}</span>
          {row.support !== "verified" && <SupportBadge support={row.support} />}
        </div>
        {row.reasons.length > 0 && (
          <p className="mt-1 text-xs whitespace-normal text-muted-foreground">
            {row.reasons.join("；")}
          </p>
        )}
      </TableCell>
      <TableCell className="align-top">
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
      </TableCell>
      <TableCell className="text-right align-top font-mono whitespace-normal">
        {row.variants.length === 0 ? (
          <span className="text-muted-foreground">—</span>
        ) : (
          row.variants.map((v) => (
            <div key={v.label}>
              {range(v.perHit)}
              {row.hits > 1 && (
                <span className="text-xs whitespace-nowrap text-muted-foreground">
                  {" "}
                  × {row.hits} 段
                </span>
              )}
              <div className="text-xs text-muted-foreground">
                {v.label}
                {v.chance != null && `（${v.chance}%）`}
              </div>
            </div>
          ))
        )}
      </TableCell>
    </TableRow>
  );
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
  const [skillLevels, setSkillLevels] = useState<Record<number, number>>({});
  const [focusSkill, setFocusSkill] = useState<number | null>(null);

  useEffect(() => {
    let alive = true;
    loadDamageData()
      .then((d) => {
        if (!alive) return;
        setDamageData(d);
        setMonsterId((current) => current ?? readMonsterId());
      })
      .catch((e: unknown) => alive && setLoadError(e instanceof Error ? e.message : String(e)));
    return () => {
      alive = false;
    };
  }, []);

  const monster = useMemo(
    () => damageData?.monsters.find((m) => m.id === monsterId) ?? null,
    [damageData, monsterId],
  );
  const input = useMemo(
    () =>
      damageData && monster && panel
        ? { character, data, panel, monster, skills: damageData.skills, skillLevels }
        : null,
    [character, data, panel, monster, damageData, skillLevels],
  );
  const result = useMemo(() => (input ? computeDamage(input) : null), [input]);
  const marginal = useMemo(() => (input ? computeMarginal(input) : null), [input]);
  const computable = result?.skills.filter((s) => s.variants.length > 0) ?? [];
  // 學不到的招還留在表上，調高等級就能算；其他尚未支援的收進下方。
  const listed =
    result?.skills.filter((s) => s.variants.length > 0 || s.reasons.includes(LEVEL_TOO_LOW)) ?? [];
  const hidden = result?.skills.filter((s) => !listed.includes(s)) ?? [];
  const strongest = computable.reduce<SkillDamage | null>(
    (best, s) => (best && totalMid(best) >= totalMid(s) ? best : s),
    null,
  );
  const focus = computable.find((s) => s.skill.id === focusSkill) ?? strongest;

  const pickMonster = (m: DamageMonster) => {
    setMonsterId(m.id);
    try {
      localStorage.setItem(MONSTER_KEY, String(m.id));
    } catch {
      // 無痕模式或封鎖儲存時就不記住，不影響計算。
    }
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
              {monster.name}　Lv{monster.level}・防禦 {fmt(monster.extraDef)}・護勁{" "}
              {fmt(monster.magicDef)}
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">選一隻怪，算出你打牠每下多少。</p>
          )}
        </div>
      </section>

      {!panel && <p className="text-sm text-muted-foreground">面板算不出來，請先修正基本資料。</p>}

      {result && (
        <>
          <section className={box} aria-label="傷害">
            <header className={head}>
              <SwordsIcon className="size-4 self-center text-muted-foreground" aria-hidden />
              <h2 className="font-heading text-sm font-semibold">每下傷害</h2>
              <span className="ml-auto truncate text-xs text-muted-foreground">
                {result.weapon.label}
              </span>
              <SupportBadge support={result.weapon.support} />
            </header>
            <div className="space-y-2 px-4 pt-3">
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
            <Table className="mt-1">
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-4">招式</TableHead>
                  <TableHead>等級</TableHead>
                  <TableHead className="pr-4 text-right">每下</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="[&_td:first-child]:pl-4 [&_td:last-child]:pr-4">
                {(["normal", "critical"] as const).map((kind) => (
                  <TableRow key={kind}>
                    <TableCell>{kind === "normal" ? "普攻" : "重擊"}</TableCell>
                    <TableCell className="text-muted-foreground">—</TableCell>
                    <TableCell className="text-right font-mono whitespace-normal">
                      {result[kind] ? (
                        range(result[kind])
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                {listed.map((row) => (
                  <SkillRow
                    key={row.skill.id}
                    row={row}
                    onLevel={(level) =>
                      setSkillLevels((prev) => ({ ...prev, [row.skill.id]: level }))
                    }
                  />
                ))}
              </TableBody>
            </Table>
            {result.skills.length === 0 && (
              <p className="px-4 pb-3 text-xs text-muted-foreground">
                目前門派沒有可列出的攻擊技能。
              </p>
            )}
            {hidden.length > 0 && (
              <Collapsible className="border-t border-border/60">
                <CollapsibleTrigger className="group flex items-center gap-2 px-4 py-2.5 text-xs text-muted-foreground hover:bg-muted/50">
                  <ChevronRightIcon
                    className="size-3.5 transition-transform group-data-[panel-open]:rotate-90"
                    aria-hidden
                  />
                  尚未支援的招式（{hidden.length}）
                </CollapsibleTrigger>
                <CollapsiblePanel>
                  <ul className="space-y-1.5 px-4 pb-3 text-xs">
                    {hidden.map((row) => (
                      <li key={row.skill.id} className="flex flex-wrap gap-x-2">
                        <span>{row.skill.name}</span>
                        <span className="text-muted-foreground">{row.reasons.join("；")}</span>
                      </li>
                    ))}
                  </ul>
                </CollapsiblePanel>
              </Collapsible>
            )}
          </section>

          {marginal && result.normal && (
            <section className={box} aria-label="加點效益">
              <header className={head}>
                <h2 className="font-heading text-sm font-semibold">再加 1 點</h2>
                <span className="text-xs text-muted-foreground">
                  每下多幾點（取傷害區間的中間值）
                </span>
              </header>
              {computable.length > 0 && (
                <div className="flex items-center gap-2 px-4 pt-3 text-xs text-muted-foreground">
                  比較技能
                  <Select
                    value={focus ? String(focus.skill.id) : ""}
                    onValueChange={(v) => v != null && setFocusSkill(Number(v))}
                  >
                    <SelectTrigger size="sm" className="min-w-0 bg-card" aria-label="比較技能">
                      <SelectValue>
                        {(v: unknown) =>
                          computable.find((s) => String(s.skill.id) === v)?.skill.name ?? ""
                        }
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {computable.map((s) => (
                        <SelectItem key={s.skill.id} value={String(s.skill.id)}>
                          {s.skill.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-4">屬性</TableHead>
                    <TableHead className="text-right">下一點成本</TableHead>
                    <TableHead className="text-right">普攻</TableHead>
                    {focus && (
                      <TableHead className="pr-4 text-right">
                        {focus.skill.name}
                        {focus.variants.length > 1 && `（${focus.variants[0].label}）`}
                      </TableHead>
                    )}
                  </TableRow>
                </TableHeader>
                <TableBody className="[&_td:first-child]:pl-4 [&_td:last-child]:pr-4">
                  {marginal.map((row) => (
                    <TableRow key={row.key}>
                      <TableCell>{STAT_LABELS[row.key]}</TableCell>
                      <TableCell className="text-right font-mono text-muted-foreground">
                        {row.nextCost}
                      </TableCell>
                      <TableCell className="text-right font-mono">{delta(row.normal)}</TableCell>
                      {focus && (
                        <TableCell className="text-right font-mono">
                          {delta(row.skills[focus.skill.id])}
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <p className="flex items-start gap-1.5 px-4 pb-3 text-xs leading-relaxed text-muted-foreground">
                <InfoIcon className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                單下傷害只看物攻或內勁，所以其他屬性是
                0。技巧、玄學影響重擊率，身法影響攻速，這兩項還沒算進來。
              </p>
            </section>
          )}

          <p className="text-xs leading-relaxed text-muted-foreground">
            公式來自封包逐下實測：傷害 ≈ 倍率 × (攻擊 + 武器) × K ÷ (K + 防禦) − 防禦 ÷ 2，K = 5 ×
            怪物等級 + 500。 同一種怪的不同隻之間會差幾點。武器真解對技能的影響還沒測過。
          </p>
        </>
      )}
    </div>
  );
}
