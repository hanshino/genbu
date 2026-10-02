import { itemAttributeNames } from "@/lib/constants/i18n";
import type { MeridianLevels, MeridianPoint, MeridianStatFlag } from "@/lib/types/meridian";

export const INITIAL_LEVELS: MeridianLevels = { 855: 1 };
export const EXP_PER_DANTIAN_BASE = 100_000_000;
export const QI_MAX = 100;
export const STAT_LABELS: Record<string, string> = {
  Atk: itemAttributeNames.atk, MAtk: itemAttributeNames.matk,
  ExtraDef: itemAttributeNames.def, MagicDef: itemAttributeNames.mdef,
  Hit: itemAttributeNames.hit, Dodge: itemAttributeNames.dodge,
  Critical: itemAttributeNames.critical, Encumbrance: "負重",
  HPMAX: "體力（上限）", MPMAX: "真氣（上限）",
  HP: "體力恢復（量）", MP: "真氣恢復（量）",
  HPRecover: "體力恢復間隔", MPRecover: "真氣恢復間隔",
  Str: itemAttributeNames.str, Pow: itemAttributeNames.pow, Vit: itemAttributeNames.vit,
  Dex: itemAttributeNames.dex, Agi: itemAttributeNames.agi, Wis: itemAttributeNames.wis,
  FireDef: "抗火", WaterDef: "抗水", LightningDef: "抗雷", EarthDef: "抗木",
  BleedRes: "抗失血", StunRes: "抗定身", ShapeRes: "抗變異", WeakenRes: "抗衰弱",
  Hurt: "減少受到傷害", EnemyDef: "減少敵方防禦", EnemyMDef: "減少敵方護勁",
  AtribChanlExp: "經脈消耗經驗值", AtribChanlProb: "穴位打通成功率",
  FireAttack: "FireAttack（意義未解）",
};

export function formatStat(stat: string, value: number, flag: MeridianStatFlag): string {
  const label = STAT_LABELS[stat] ?? stat;
  const signed = (n: number) => `${n < 0 ? "−" : "+"}${Math.abs(n)}`;
  if (stat === "HPRecover" || stat === "MPRecover") return `${label} ${signed(-value)} 秒`;
  const unit = flag === "AFFECT_RATIO" ? "%" : "";
  if (["Hurt", "EnemyDef", "EnemyMDef"].includes(stat)) return `${label} ${value}${unit}`;
  return `${label} ${signed(stat === "AtribChanlExp" ? -value : value)}${unit}`;
}

export function indexPoints(points: MeridianPoint[]): Map<number, MeridianPoint> {
  return new Map(points.map((point) => [point.id, point]));
}

export function levelOf(levels: MeridianLevels, id: number): number {
  return levels[id] ?? 0;
}

function checkedPoint(idx: Map<number, MeridianPoint>, id: number, level: number): MeridianPoint {
  const point = idx.get(id);
  if (!point || !Number.isInteger(level) || level < 0 || level > point.maxLevel) {
    throw new RangeError(`無效穴位或等級：${id} Lv${level}`);
  }
  return point;
}

export function missingPrereqs(
  idx: Map<number, MeridianPoint>, levels: MeridianLevels, id: number, targetLevel: number,
): { id: number; level: number }[] {
  const point = checkedPoint(idx, id, targetLevel);
  if (targetLevel === 0) return [];
  const level = point.levels.find((row) => row.level === targetLevel);
  if (!level) throw new RangeError(`查無穴位等級：${id} Lv${targetLevel}`);
  const prereqs = [...level.prereqs];
  if (targetLevel > 1) prereqs.push({ id, level: targetLevel - 1 });
  return prereqs.filter((req) => levelOf(levels, req.id) < req.level).map((req) => ({ ...req }));
}

export function raiseTo(
  idx: Map<number, MeridianPoint>, levels: MeridianLevels, id: number, targetLevel: number,
): MeridianLevels {
  checkedPoint(idx, id, targetLevel);
  const next: MeridianLevels = { ...levels, 855: Math.max(1, levelOf(levels, 855)) };
  const visiting = new Set<string>();
  function raise(pointId: number, target: number) {
    checkedPoint(idx, pointId, target);
    const key = `${pointId}:${target}`;
    if (visiting.has(key)) throw new Error(`穴位前置循環：${key}`);
    visiting.add(key);
    for (let level = levelOf(next, pointId) + 1; level <= target; level++) {
      for (const req of missingPrereqs(idx, next, pointId, level)) raise(req.id, req.level);
      next[pointId] = level;
    }
    visiting.delete(key);
  }
  raise(id, targetLevel);
  return next;
}

export function lowerTo(
  idx: Map<number, MeridianPoint>, levels: MeridianLevels, id: number, targetLevel: number,
): MeridianLevels {
  checkedPoint(idx, id, targetLevel);
  const next: MeridianLevels = { ...levels, 855: Math.max(1, levelOf(levels, 855)) };
  next[id] = Math.min(levelOf(next, id), Math.max(id === 855 ? 1 : 0, targetLevel));
  // ponytail: 55 穴位直接掃到穩定；資料量擴大後才需要反向依賴索引。
  let changed: boolean;
  do {
    changed = false;
    for (const point of idx.values()) {
      for (let level = 1; level <= levelOf(next, point.id); level++) {
        if (missingPrereqs(idx, next, point.id, level).length) {
          next[point.id] = level - 1;
          changed = true;
          break;
        }
      }
    }
  } while (changed);
  return next;
}

export function fillAll(idx: Map<number, MeridianPoint>): MeridianLevels {
  return Object.fromEntries([...idx.values()].map((point) => [point.id, point.maxLevel]));
}

export function sumStats(
  idx: Map<number, MeridianPoint>, levels: MeridianLevels,
): { stat: string; value: number; flag: MeridianStatFlag }[] {
  const totals = new Map<string, { stat: string; value: number; flag: MeridianStatFlag }>();
  for (const point of idx.values()) {
    for (const level of point.levels) {
      if (level.level > levelOf(levels, point.id)) continue;
      for (const stat of level.stats) {
        const previous = totals.get(stat.stat);
        if (previous) previous.value += stat.value;
        else totals.set(stat.stat, { ...stat });
      }
    }
  }
  return [...totals.values()].filter((stat) => stat.value !== 0);
}

export function probBonus(idx: Map<number, MeridianPoint>, levels: MeridianLevels): number {
  return sumStats(idx, levels).find((stat) => stat.stat === "AtribChanlProb")?.value ?? 0;
}

export function expDiscount(idx: Map<number, MeridianPoint>, levels: MeridianLevels): number {
  return sumStats(idx, levels).find((stat) => stat.stat === "AtribChanlExp")?.value ?? 0;
}

export function expPerDantian(idx: Map<number, MeridianPoint>, levels: MeridianLevels): number {
  return EXP_PER_DANTIAN_BASE * (1 - expDiscount(idx, levels) / 100);
}

export function effectiveProb(base: number, bonus: number): number {
  return Math.min(100, base + bonus);
}

export function costBetween(
  idx: Map<number, MeridianPoint>, from: MeridianLevels, to: MeridianLevels,
): { min: number; expected: number; levels: number } {
  const total = { min: 0, expected: 0, levels: 0 };
  for (const point of idx.values()) {
    const start = levelOf(from, point.id);
    const end = levelOf(to, point.id);
    checkedPoint(idx, point.id, start);
    checkedPoint(idx, point.id, end);
    if (end < start) throw new RangeError("目標配置不可低於起始配置");
    for (const level of point.levels) {
      if (level.level <= start || level.level > end || level.cost === null) continue;
      total.min += level.cost;
      total.expected += level.cost / (effectiveProb(level.prob, 0) / 100);
      total.levels++;
    }
  }
  return total;
}

export function waterIconId(qi: number): number {
  if (qi <= 0) return 1295;
  if (qi >= QI_MAX) return 1302;
  const a = Math.max(1, Math.min(6, Math.floor(qi / 15)));
  return 1295 + a + (qi < 17 * a - 2 ? 0 : 1);
}

export interface PlayLogEntry {
  id: number; level: number; ok: boolean; cost: number; guaranteed: boolean;
}

export interface PlayState {
  levels: MeridianLevels;
  dantian: number;
  qi: number;
  spentDantian: number;
  spentExp: number;
  converted: number;
  attempts: number;
  successes: number;
  failures: number;
  log: PlayLogEntry[];
}

function checkedCount(value: number): number {
  if (!Number.isSafeInteger(value) || value < 0) throw new RangeError("數量必須是非負整數");
  return value;
}

export function initialPlayState(dantian = 500): PlayState {
  return {
    levels: { ...INITIAL_LEVELS }, dantian: checkedCount(dantian), qi: 0,
    spentDantian: 0, spentExp: 0, converted: 0, attempts: 0, successes: 0, failures: 0, log: [],
  };
}

export function convertExp(idx: Map<number, MeridianPoint>, state: PlayState, times: number): PlayState {
  checkedCount(times);
  return {
    ...state, dantian: state.dantian + times,
    spentExp: state.spentExp + times * expPerDantian(idx, state.levels),
    converted: state.converted + times,
  };
}

export type AttemptResult = {
  state: PlayState;
  outcome: "success" | "fail" | "blocked";
  reason?: "max" | "prereq" | "dantian" | "quest";
};

export function attemptBreak(
  idx: Map<number, MeridianPoint>, state: PlayState, id: number, rng: () => number = Math.random,
): AttemptResult {
  const point = idx.get(id);
  const target = levelOf(state.levels, id) + 1;
  const blocked = (reason: AttemptResult["reason"]): AttemptResult => ({ state, outcome: "blocked", reason });
  if (!point || target > point.maxLevel) return blocked("max");
  const level = point.levels.find((row) => row.level === target);
  if (!level || level.cost === null) return blocked("quest");
  if (missingPrereqs(idx, state.levels, id, target).length) return blocked("prereq");
  if (state.dantian < level.cost) return blocked("dantian");
  const guaranteed = state.qi >= QI_MAX;
  const ok = guaranteed || rng() * 100 < effectiveProb(level.prob, probBonus(idx, state.levels));
  const next: PlayState = {
    ...state,
    levels: ok ? { ...state.levels, [id]: target } : { ...state.levels },
    dantian: state.dantian - level.cost,
    qi: guaranteed ? 0 : ok ? state.qi : Math.min(QI_MAX, state.qi + 1),
    spentDantian: state.spentDantian + level.cost,
    attempts: state.attempts + 1,
    successes: state.successes + Number(ok),
    failures: state.failures + Number(!ok),
    log: [{ id, level: target, ok, cost: level.cost, guaranteed }, ...state.log].slice(0, 50),
  };
  return { state: next, outcome: ok ? "success" : "fail" };
}

/* ---------- 保存與分享 ---------- */

/** 只列等級高於 INITIAL_LEVELS 的穴位，依 id 排序：`930.20,955.20` */
export function encodePlan(levels: MeridianLevels): string {
  return Object.entries(levels)
    .map(([id, level]) => [Number(id), level] as const)
    .filter(([id, level]) => Number.isInteger(level) && level > levelOf(INITIAL_LEVELS, id))
    .sort((a, b) => a[0] - b[0])
    .map(([id, level]) => `${id}.${level}`)
    .join(",");
}

/**
 * 解析 encodePlan 的字串（網址 ?p= 或 localStorage）。壞字串／未知 id 直接丟掉，等級夾在
 * INITIAL..maxLevel，最後從 INITIAL_LEVELS 依 id 用 raiseTo 重建：前置不足會自動補齊，結果一定合法。
 */
export function decodePlan(idx: Map<number, MeridianPoint>, raw: unknown): MeridianLevels {
  let levels: MeridianLevels = { ...INITIAL_LEVELS };
  // ponytail: 55 穴位 × "id.lv," 不會超過 1KB，超長就當垃圾
  if (typeof raw !== "string" || raw.length > 2000) return levels;
  const wanted = new Map<number, number>();
  for (const part of raw.split(",")) {
    const m = /^(\d{1,6})\.(\d{1,3})$/.exec(part.trim());
    const point = m ? idx.get(Number(m[1])) : undefined;
    if (!m || !point) continue;
    const level = Math.min(point.maxLevel, Number(m[2]));
    wanted.set(point.id, Math.max(wanted.get(point.id) ?? 0, level));
  }
  for (const [id, level] of [...wanted].sort((a, b) => a[0] - b[0])) {
    if (level <= levelOf(levels, id)) continue;
    try {
      levels = raiseTo(idx, levels, id, level);
    } catch {
      // 資料有前置循環才會到這裡；略過這一筆
    }
  }
  return levels;
}

const nonNegInt = (v: unknown, fallback = 0) =>
  typeof v === "number" && Number.isSafeInteger(v) && v >= 0 ? v : fallback;

/** 從 localStorage 讀回的物件還原 PlayState；levels 存成 encodePlan 字串。不是物件就回 null。 */
export function restorePlayState(idx: Map<number, MeridianPoint>, raw: unknown): PlayState | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  const log = (Array.isArray(o.log) ? o.log : [])
    .filter((e): e is PlayLogEntry => {
      if (!e || typeof e !== "object") return false;
      const x = e as Record<string, unknown>;
      const point = typeof x.id === "number" ? idx.get(x.id) : undefined;
      return !!point && typeof x.level === "number" && Number.isInteger(x.level)
        && x.level >= 1 && x.level <= point.maxLevel && typeof x.ok === "boolean"
        && typeof x.guaranteed === "boolean" && nonNegInt(x.cost, -1) >= 0;
    })
    .slice(0, 50)
    .map(({ id, level, ok, cost, guaranteed }) => ({ id, level, ok, cost, guaranteed }));
  return {
    levels: decodePlan(idx, o.levels),
    dantian: nonNegInt(o.dantian),
    qi: Math.min(QI_MAX, nonNegInt(o.qi)),
    spentDantian: nonNegInt(o.spentDantian),
    spentExp: typeof o.spentExp === "number" && Number.isFinite(o.spentExp) && o.spentExp >= 0 ? o.spentExp : 0,
    converted: nonNegInt(o.converted),
    attempts: nonNegInt(o.attempts),
    successes: nonNegInt(o.successes),
    failures: nonNegInt(o.failures),
    log,
  };
}
