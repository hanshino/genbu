import { SparklesIcon } from "lucide-react";
import Link from "next/link";
import { Fragment } from "react";
import { getBuildBuffs, getBuildSkills, type BuildSkillLevel } from "@/lib/queries/build-calc";
import type { CalcInput } from "@/lib/build-calc";
import type { SectId } from "@/lib/types/stat-sim";
import { BuildCalculatorClient } from "./build-calculator";
export { DungeonHitTable } from "./dungeon-hit-table";
import { MarginalChart as MarginalChartView } from "./marginal-chart";

const range = (a: number, b: number) => (a === b ? `${a}` : `${a} → ${b}`);

/**
 * 卡片上的傷害欄位，依 func_dmg 決定 p2..p4 的意思（見 src/lib/combat/damage.ts）：
 * 3 單次 × p1% 再加 p2、7 p3 段 × p1%、8 p4% 機率 p1% 否則 p2%、10 × p1% 再加 玄學 × p2。
 */
function damageRows(a: BuildSkillLevel, b: BuildSkillLevel): [string, string][] {
  switch (a.funcDmg) {
    case 3:
      return [
        ["倍率", `${range(a.p1, b.p1)}%`],
        ...(b.p2 > 0 ? [["固定加成", `+${range(a.p2, b.p2)}`] as [string, string]] : []),
      ];
    case 7:
      return [
        ["倍率", `${range(a.p1, b.p1)}%`],
        ["段數", `${range(a.p3, b.p3)} 段`],
      ];
    case 8:
      return [
        ["高傷", `${range(a.p1, b.p1)}%（${range(a.p4, b.p4)}% 機率）`],
        ["低傷", `${range(a.p2, b.p2)}%`],
      ];
    case 10:
      return [
        ["倍率", `${range(a.p1, b.p1)}%`],
        ["玄學係數", `× ${range(a.p2, b.p2)}`],
      ];
    default:
      return [["倍率", `${range(a.p1, b.p1)}%`]];
  }
}

/** 主攻招卡片：icon、開放等級、傷害參數、命中倍率（第 1 級 → 最高級）。 */
export function SkillCards({ ids, until }: { ids: number[]; until?: number[] }) {
  const skills = getBuildSkills(ids);
  return (
    <div className="my-5 grid gap-2.5 sm:grid-cols-3">
      {skills.map((s, i) => {
        const first = s.levels[0];
        const last = s.levels.at(-1)!;
        const to = until?.[i];
        return (
          <Link
            key={s.id}
            href={`/skills/${s.id}`}
            className="bg-card hover:bg-muted/50 focus-visible:ring-ring flex flex-col gap-2 rounded-xl border px-3.5 py-3 transition-colors outline-none focus-visible:ring-2"
          >
            <div className="flex items-center gap-2.5">
              {s.iconUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- 與 GuideRefTag 相同：hotlink 直連
                <img
                  src={s.iconUrl}
                  alt=""
                  width={36}
                  height={36}
                  className="bg-muted size-9 shrink-0 rounded-md border [image-rendering:pixelated]"
                />
              ) : (
                <SparklesIcon className="text-muted-foreground size-9 shrink-0 p-2" aria-hidden />
              )}
              <div className="min-w-0">
                <p className="font-heading leading-tight font-medium">{s.name}</p>
                <p className="text-muted-foreground text-xs tabular-nums">
                  {first.charLevel} 級{to ? `～${to} 級` : " 以上"}
                </p>
              </div>
            </div>
            <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-xs tabular-nums">
              {damageRows(first, last).map(([label, value]) => (
                <Fragment key={label}>
                  <dt className="text-muted-foreground">{label}</dt>
                  <dd>{value}</dd>
                </Fragment>
              ))}
              <dt className="text-muted-foreground">命中倍率</dt>
              <dd>{range(first.hit, last.hit)}%</dd>
            </dl>
          </Link>
        );
      })}
    </div>
  );
}

/** 文章裡的固定情境邊際效應圖。 */
export function MarginalChart({
  sect,
  skill,
  skillLevel,
  level,
  str,
  wis,
  gearStr = 0,
  gearWis = 0,
  jigong,
  jigongLevel,
}: {
  sect: SectId;
  skill: number;
  skillLevel: number;
  level: number;
  str: number;
  wis: number;
  gearStr?: number;
  gearWis?: number;
  jigong?: number;
  jigongLevel?: number;
}) {
  const s = getBuildSkills([skill])[0]?.levels.find((l) => l.level === skillLevel);
  if (!s) return null;
  const jg = jigong ? getBuildBuffs([jigong])[0]?.levels.find((l) => l.level === jigongLevel) : undefined;
  const input: CalcInput = {
    sectId: sect,
    level,
    strBase: str,
    wisBase: wis,
    gearStr,
    gearWis,
    skill: { funcDmg: s.funcDmg, p1: s.p1, p2: s.p2, p3: s.p3, p4: s.p4 },
    jigong: jg ? { p3: jg.params[2], p4: jg.params[3], p5: jg.params[4] } : null,
    huanjia: null,
  };
  return (
    <figure className="bg-card my-5 rounded-xl border px-2 pt-3 pb-2 sm:px-3">
      <MarginalChartView input={input} marks="values" />
    </figure>
  );
}

/** 配點計算器：主攻招依角色等級自動切換。 */
export function BuildCalculator({
  sect,
  skills,
  jigong,
  huanjia,
}: {
  sect: SectId;
  skills: number[];
  jigong: number[];
  huanjia: number[];
}) {
  return (
    <BuildCalculatorClient
      sectId={sect}
      skills={getBuildSkills(skills)}
      jigong={getBuildBuffs(jigong)}
      huanjia={getBuildBuffs(huanjia)}
    />
  );
}
