import { getDb } from "@/lib/db";
import { getMagicIconMap, pickMagicIcon } from "@/lib/queries/images";
import type { CalcSkillLevel } from "@/lib/build-calc";

/** 主攻招的一級：學習等級、傷害參數、命中倍率與耗真氣。 */
export interface BuildSkillLevel extends CalcSkillLevel {
  level: number;
  /** 學這一級要的角色等級。 */
  charLevel: number;
  /** func_hit_p1，命中倍率（%）。 */
  hit: number;
  mp: number;
}

/** buff 的一級：extra_status 那個 status 的 param1..5。 */
export interface BuildBuffLevel {
  level: number;
  charLevel: number;
  params: [number, number, number, number, number];
  mp: number;
}

export interface BuildMagic<L> {
  id: number;
  name: string;
  iconUrl: string | null;
  levels: L[];
}

export type BuildSkill = BuildMagic<BuildSkillLevel>;
export type BuildBuff = BuildMagic<BuildBuffLevel>;

interface Row {
  id: number;
  name: string;
  level: number;
  char_level: number | null;
  func_dmg: number | null;
  p1: number | null;
  p2: number | null;
  p3: number | null;
  p4: number | null;
  hit: number | null;
  mp: number | null;
  s1: number | null;
  s2: number | null;
  s3: number | null;
  s4: number | null;
  s5: number | null;
}

// magic 沒有 PK、同 id 可能掛多個技能名：只取第 1 級那個名字的各級。
function rows(id: number): Row[] {
  const all = getDb()
    .prepare(
      `SELECT m.id, m.name, m.level, l.char_level, m.func_dmg, m.func_dmg_p1 AS p1, m.func_dmg_p2 AS p2,
              m.func_dmg_p3 AS p3, m.func_dmg_p4 AS p4, m.func_hit_p1 AS hit, m.spend_mp AS mp,
              s.param1 AS s1, s.param2 AS s2, s.param3 AS s3, s.param4 AS s4, s.param5 AS s5
       FROM magic m
       LEFT JOIN magic_learn l ON l.magic_id = m.id AND l.level = m.level
       LEFT JOIN status s ON s.id = m.extra_status
       WHERE m.id = ?
       ORDER BY m.level`,
    )
    .all(id) as Row[];
  return all.filter((r) => r.name === all[0]?.name && r.char_level != null);
}

function load<L>(ids: number[], level: (r: Row) => L): BuildMagic<L>[] {
  const icons = getMagicIconMap(ids);
  return ids.flatMap((id) => {
    const rs = rows(id);
    if (rs.length === 0) return [];
    return [
      {
        id,
        name: rs[0].name,
        iconUrl: pickMagicIcon(icons.get(id), rs.at(-1)!.level)?.url ?? null,
        levels: rs.map(level),
      },
    ];
  });
}

/** 主攻招各級（func_dmg 與參數）。 */
export function getBuildSkills(ids: number[]): BuildSkill[] {
  return load(ids, (r) => ({
    level: r.level,
    charLevel: r.char_level!,
    funcDmg: r.func_dmg ?? 0,
    p1: r.p1 ?? 0,
    p2: r.p2 ?? 0,
    p3: r.p3 ?? 0,
    p4: r.p4 ?? 0,
    hit: r.hit ?? 100,
    mp: r.mp ?? 0,
  }));
}

/** 輔助 buff 各級（extra_status 的 status 參數）。 */
export function getBuildBuffs(ids: number[]): BuildBuff[] {
  return load(ids, (r) => ({
    level: r.level,
    charLevel: r.char_level!,
    params: [r.s1 ?? 0, r.s2 ?? 0, r.s3 ?? 0, r.s4 ?? 0, r.s5 ?? 0],
    mp: r.mp ?? 0,
  }));
}
