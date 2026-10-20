"use client";

import { useId, useState, type ReactNode } from "react";
import { ChevronDownIcon, SwordIcon, SparklesIcon, ScaleIcon } from "lucide-react";
import { calculate, GAIN_WINDOW, type CalcInput } from "@/lib/build-calc";
import type { BuildBuff, BuildSkill } from "@/lib/queries/build-calc";
import type { SectId } from "@/lib/types/stat-sim";
import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible, CollapsiblePanel, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";
import { curveRows } from "./curve";
import { MarginalChart } from "./marginal-chart";

const MAX_LEVEL = 200;

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));
const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

/** 角色等級學得到的最高一級；一級都學不到回傳 null。 */
function maxLearnable<L extends { level: number; charLevel: number }>(levels: L[], charLevel: number) {
  return levels.filter((l) => l.charLevel <= charLevel).at(-1) ?? null;
}

/** 這個等級打的主攻招：學得到的裡面最晚開放的那招。 */
function mainSkill(skills: BuildSkill[], level: number): BuildSkill {
  return skills.filter((s) => s.levels[0].charLevel <= level).at(-1) ?? skills[0];
}

function NumberField({
  label,
  value,
  onChange,
  min = 0,
  max = 999,
  hint,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  min?: number;
  max?: number;
  hint?: string;
}) {
  const id = useId();
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <label htmlFor={id} className="text-muted-foreground text-xs">
        {label}
      </label>
      <Input
        id={id}
        type="number"
        inputMode="numeric"
        min={min}
        max={max}
        value={value}
        onChange={(e) => {
          const n = Number(e.target.value);
          if (Number.isFinite(n)) onChange(clamp(Math.floor(n), min, max));
        }}
        className="tabular-nums"
      />
      {hint && <span className="text-muted-foreground text-[11px] leading-tight">{hint}</span>}
    </div>
  );
}

function LevelSelect({
  label,
  levels,
  value,
  onChange,
  disabled,
}: {
  label: string;
  levels: number[];
  value: number;
  onChange: (n: number) => void;
  disabled?: boolean;
}) {
  return (
    <Select value={String(value)} onValueChange={(v) => v != null && onChange(Number(v))} disabled={disabled}>
      <SelectTrigger className="w-[88px]" aria-label={label}>
        <SelectValue>{(v: unknown) => `Lv ${v}`}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        {levels.map((l) => (
          <SelectItem key={l} value={String(l)}>
            Lv {l}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/** 激攻／幻甲：勾選、符陣或靈壇、等級。等級上限跟著角色等級走。 */
function BuffPicker({
  title,
  hint,
  buffs,
  charLevel,
  state,
  onChange,
}: {
  title: string;
  hint: string;
  buffs: BuildBuff[];
  charLevel: number;
  state: BuffState;
  onChange: (s: BuffState) => void;
}) {
  const id = useId();
  const usable = buffs.filter((b) => b.levels[0].charLevel <= charLevel);
  const buff = usable.find((b) => b.id === state.id) ?? usable.at(-1) ?? null;
  const top = buff ? maxLearnable(buff.levels, charLevel)!.level : 0;
  const level = buff ? Math.min(state.level ?? top, top) : 0;
  const on = state.on && buff != null;
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border/60 px-3 py-2.5">
      <div className="flex items-center gap-2">
        <Checkbox
          id={id}
          checked={on}
          disabled={!buff}
          onCheckedChange={(c) => onChange({ ...state, on: c === true })}
        />
        <label htmlFor={id} className={cn("text-sm font-medium", !buff && "text-muted-foreground")}>
          {title}
        </label>
        <span className="text-muted-foreground ml-auto text-[11px]">{buff ? hint : `${buffs[0]?.levels[0].charLevel ?? "?"} 級才學得到`}</span>
      </div>
      {buff && (
        <div className={cn("flex flex-wrap items-center gap-2", !on && "opacity-50")}>
          <ToggleGroup
            value={[String(buff.id)]}
            onValueChange={(v) => v[0] && onChange({ ...state, id: Number(v[0]), level: null })}
            disabled={!on}
          >
            {usable.map((b) => (
              <ToggleGroupItem key={b.id} value={String(b.id)} size="sm">
                {b.name.slice(-2)}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
          <LevelSelect
            label={`${title}等級`}
            levels={buff.levels.filter((l) => l.charLevel <= charLevel).map((l) => l.level)}
            value={level}
            onChange={(n) => onChange({ ...state, id: buff.id, level: n })}
            disabled={!on}
          />
        </div>
      )}
    </div>
  );
}

interface BuffState {
  on: boolean;
  id: number | null;
  /** null = 這個角色等級學得到的最高級。 */
  level: number | null;
}

/** 選中的 buff 那一級的 status 參數；沒勾或學不到回傳 null。 */
function resolveBuff(buffs: BuildBuff[], charLevel: number, state: BuffState) {
  if (!state.on) return null;
  const usable = buffs.filter((b) => b.levels[0].charLevel <= charLevel);
  const buff = usable.find((b) => b.id === state.id) ?? usable.at(-1);
  if (!buff) return null;
  const top = maxLearnable(buff.levels, charLevel)!;
  const lv = buff.levels.find((l) => l.level === Math.min(state.level ?? top.level, top.level)) ?? top;
  return { buff, level: lv };
}

function GainTile({
  title,
  icon,
  color,
  gain,
  best,
  children,
}: {
  title: string;
  icon: ReactNode;
  color: string;
  gain: ReturnType<typeof calculate>["str"];
  best: boolean;
  children?: ReactNode;
}) {
  return (
    <div
      className={cn(
        "bg-card flex flex-col gap-1 rounded-lg border px-3.5 py-3",
        best ? "border-foreground/40" : "border-border/60",
      )}
    >
      <div className="flex items-center gap-1.5 text-sm font-medium">
        <span className="size-2.5 rounded-full" style={{ background: color }} aria-hidden />
        {icon}
        {title} +1
      </div>
      <p className="font-heading text-2xl tabular-nums">
        +{fmt(gain.damage)}
        <span className="text-muted-foreground ml-1 text-xs font-normal">傷害</span>
      </p>
      <p className="text-muted-foreground text-xs tabular-nums">
        這點花 {gain.cost} 個屬性點；接下來 {GAIN_WINDOW} 點平均，每個屬性點{" "}
        <span className="whitespace-nowrap">+{fmt(Math.round(gain.perPoint * 10) / 10)}</span>
        {gain.estimated && "（加點成本是估計值）"}
      </p>
      {children}
    </div>
  );
}

export function BuildCalculatorClient({
  sectId,
  skills,
  jigong,
  huanjia,
}: {
  sectId: SectId;
  skills: BuildSkill[];
  jigong: BuildBuff[];
  huanjia: BuildBuff[];
}) {
  const [level, setLevel] = useState(160);
  const [skillLevel, setSkillLevel] = useState<number | null>(null);
  const [str, setStr] = useState(57);
  const [wis, setWis] = useState(94);
  const [gearStr, setGearStr] = useState(0);
  const [gearWis, setGearWis] = useState(0);
  const [jg, setJg] = useState<BuffState>({ on: true, id: null, level: null });
  const [hj, setHj] = useState<BuffState>({ on: false, id: null, level: null });

  const skill = mainSkill(skills, level);
  const learnable = skill.levels.filter((l) => l.charLevel <= level);
  const skillTop = learnable.at(-1) ?? skill.levels[0];
  const skillLv =
    skill.levels.find((l) => l.level === Math.min(skillLevel ?? skillTop.level, skillTop.level)) ?? skillTop;
  const jgSel = resolveBuff(jigong, level, jg);
  const hjSel = resolveBuff(huanjia, level, hj);

  const input: CalcInput = {
      sectId,
      level,
      strBase: str,
      wisBase: wis,
      gearStr,
      gearWis,
      skill: { funcDmg: skillLv.funcDmg, p1: skillLv.p1, p2: skillLv.p2, p3: skillLv.p3, p4: skillLv.p4 },
      jigong: jgSel ? { p3: jgSel.level.params[2], p4: jgSel.level.params[3], p5: jgSel.level.params[4] } : null,
      huanjia: hjSel ? { p1: hjSel.level.params[0], p2: hjSel.level.params[1], p3: hjSel.level.params[2] } : null,
  };
  const r = calculate(input);
  const verdict =
    r.pick === "even" ? "兩邊差不多，點哪個都行" : r.pick === "str" ? "下一點點外功" : "下一點點玄學";
  const ratio = r.pick === "even" ? null : Math.max(r.str.perPoint, r.wis.perPoint) / Math.min(r.str.perPoint, r.wis.perPoint);

  return (
    <section
      aria-label="配點計算器"
      className="bg-card/40 my-6 flex flex-col gap-4 rounded-xl border px-4 py-4 sm:px-5"
    >
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <NumberField label="角色等級" value={level} onChange={setLevel} min={1} max={MAX_LEVEL} />
        <div className="flex min-w-0 flex-col gap-1">
          <span className="text-muted-foreground text-xs">主攻招</span>
          <div className="flex items-center gap-2">
            <span className="truncate text-sm">{skill.name}</span>
            <LevelSelect
              label={`${skill.name}等級`}
              levels={learnable.map((l) => l.level)}
              value={skillLv.level}
              onChange={setSkillLevel}
            />
          </div>
        </div>
        <div className="hidden sm:block" />
        <NumberField label="自己點的外功" value={str} onChange={setStr} min={1} hint="不含裝備" />
        <NumberField label="自己點的玄學" value={wis} onChange={setWis} min={1} hint="不含裝備" />
        <div className="hidden sm:block" />
        <NumberField label="裝備外功" value={gearStr} onChange={setGearStr} hint="裝備、被動加的" />
        <NumberField label="裝備玄學" value={gearWis} onChange={setGearWis} hint="裝備、被動加的" />
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <BuffPicker
          title="自己放激攻"
          hint="隊友放的不用勾"
          buffs={jigong}
          charLevel={level}
          state={jg}
          onChange={setJg}
        />
        <BuffPicker
          title="自己放幻甲"
          hint="只影響防禦"
          buffs={huanjia}
          charLevel={level}
          state={hj}
          onChange={setHj}
        />
      </div>

      <div className="flex items-center gap-2 border-t pt-4" aria-live="polite">
        <ScaleIcon className="text-muted-foreground size-5 shrink-0" aria-hidden />
        <p className="font-heading text-lg font-semibold">{verdict}</p>
        {ratio != null && (
          <span className="text-muted-foreground text-sm tabular-nums">每點傷害多 {Math.round((ratio - 1) * 100)}%</span>
        )}
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <GainTile
          title="外功"
          icon={<SwordIcon className="size-3.5" aria-hidden />}
          color="var(--chart-1)"
          gain={r.str}
          best={r.pick === "str"}
        />
        <GainTile
          title="玄學"
          icon={<SparklesIcon className="size-3.5" aria-hidden />}
          color="var(--chart-3)"
          gain={r.wis}
          best={r.pick === "wis"}
        >
          <p className="text-muted-foreground text-xs tabular-nums">
            另外真氣 +{r.wisExtras.mp}、護勁 +{r.wisExtras.mdef}
            {r.wisExtras.huanjia != null && `、幻甲約 +${r.wisExtras.huanjia}`}
          </p>
        </GainTile>
      </div>

      <div>
        <p className="mb-1 text-sm font-medium">每花 1 個屬性點多幾點傷害</p>
        <p className="text-muted-foreground mb-2 text-xs">
          外功線只動外功、玄學線只動玄學，另一項固定在你填的值。圓點是你現在的位置，哪條線的圓點比較高，下一點就點哪邊。每點的值取接下來 {GAIN_WINDOW} 點的平均。
        </p>
        <MarginalChart input={input} />
      </div>

      <Collapsible>
        <CollapsibleTrigger className="group text-muted-foreground hover:text-foreground flex items-center gap-1 text-sm">
          <ChevronDownIcon className="size-4 transition-transform group-data-[panel-open]:rotate-180" aria-hidden />
          展開看數據
        </CollapsibleTrigger>
        <CollapsiblePanel>
          <p className="text-muted-foreground mt-2 text-xs tabular-nums">
            目前{skill.name} Lv{skillLv.level} 一發約 {Math.round(r.damage).toLocaleString()}（未扣怪物防禦、不含武器傷害）
          </p>
          <div className="bg-card mt-2 overflow-hidden rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>點到</TableHead>
                  <TableHead className="text-right">外功每點 +傷害</TableHead>
                  <TableHead className="text-right">玄學每點 +傷害</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {curveRows(input).map((p) => (
                  <TableRow key={p.value}>
                    <TableCell className="tabular-nums">{p.value}</TableCell>
                    <TableCell className="text-right tabular-nums">{fmt(Math.round(p.str * 10) / 10)}</TableCell>
                    <TableCell className="text-right tabular-nums">{fmt(Math.round(p.wis * 10) / 10)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CollapsiblePanel>
      </Collapsible>
    </section>
  );
}
