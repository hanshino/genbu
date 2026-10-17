import { EXP_LEVEL_GAP, POST_CAST_TICKS, SEARCH_TICKS } from "@/configs/idle";
import { CRIT, hitChance, MISS, playerHit, type SkillLike } from "@/lib/combat/damage";
import { computeHitRequirement } from "@/lib/calc/hit-requirement";
import { levelPoints } from "@/lib/stat-sim";
import { buildCombatant, type Combatant } from "./character";
import { SeededRng } from "./rng";
import { activeSkill, monsterTarget, type ActiveSkill } from "./skills";
import type {
  AdvanceOptions,
  AdvanceResult,
  IdleData,
  IdleEvent,
  IdleMonster,
  IdlePhase,
  IdleState,
  IdleSummary,
  PendingHit,
} from "./types";

/**
 * 放置引擎：純函式、確定性、不碰 DB / DOM / Date.now；亂數全部來自 state.seed。
 *
 * 時間以 tick 計，並且「按階段邊界跳」而不是逐 tick：每一步消耗 min(剩餘 ticks, 到下一個邊界的 ticks)，
 * 邊界 = 找怪結束、施放中的下一個命中、施放結束、施放後間隔結束。階段與其剩餘 ticks 都存在 state.phase，
 * 所以 advance(s, a + b) 等於 advance(advance(s, a), b)：是否處理邊界只取決於 (state, 剩餘 ticks)，
 * 切在哪裡不影響結果。events 與快轉共用同一個迴圈，collectEvents 只決定要不要把事件放進陣列。
 *
 * 多段命中：每次施放只呼叫一次 playerHit（一次命中判定，與 tthol-combat 相同）。它回傳的 segments 數
 * 就是這招的段數（DB 查證：func_dmg 3/4/6/7/8/10/12-19/48/50/51 的時間軸命中事件數 = 段數 = hit_count），
 * 所以第 i 段落在時間軸第 i 個命中 tick，不會對每個命中事件再叫一次 playerHit（那樣段數會重複計）。
 * miss 時整次施放只有一個 miss，落在第一個命中 tick。時間軸命中數比段數少時，多的段數疊在最後一個命中 tick。
 * extra_hit_pct（機率多一擊的時間軸）v1 忽略，一律用 hit_count 那條。
 * 怪物在施放中途死亡不中斷施放，之後的命中是 overkill：不發事件、不計入統計。
 */

/** 升到下一級所需經驗。規格預設：char_levels.exp 是從 L 升到 L+1 所需（Lv1 = 29）；要改成累計值只改這裡。 */
export function expToNext(level: number, data: IdleData): number {
  return data.levelExp[level] ?? Number.POSITIVE_INFINITY;
}

/** 擊殺經驗：比怪高超過 EXP_LEVEL_GAP 級只拿 1。 */
export function killExp(level: number, monster: Pick<IdleMonster, "level" | "dropExp">): number {
  return level - monster.level > EXP_LEVEL_GAP ? 1 : monster.dropExp;
}

/** 玩家配點或換技能後呼叫：命中不足的暫停解除，重新找怪。其他階段不動。 */
export function resumeIfBlocked(state: IdleState): IdleState {
  if (state.phase.kind !== "blocked") return state;
  return { ...state, phase: { kind: "searching", remaining: SEARCH_TICKS } };
}

function cloneState(state: IdleState): IdleState {
  return {
    ...state,
    attributes: { ...state.attributes },
    phase: { ...state.phase } as IdlePhase,
    stats: { ...state.stats },
  };
}

interface Context {
  combatant: Combatant;
  skill: ActiveSkill | null;
}

function buildContext(state: IdleState, data: IdleData): Context {
  const combatant = buildCombatant(state, data);
  return { combatant, skill: activeSkill(data, state.level, combatant, state.skillId) };
}

/** 依出現權重（monster_spawns 每列一份）抽一隻怪。 */
function pickMonster(data: IdleData, rng: SeededRng): IdleMonster {
  let total = 0;
  for (const spawn of data.spawns) total += spawn.weight;
  let roll = rng.randrange(total);
  for (const spawn of data.spawns) {
    if (roll < spawn.weight) return data.monsters[spawn.monsterId];
    roll -= spawn.weight;
  }
  return data.monsters[data.spawns[data.spawns.length - 1].monsterId];
}

export function advance(
  state: IdleState,
  ticks: number,
  data: IdleData,
  opts: AdvanceOptions = {},
): AdvanceResult {
  if (!Number.isSafeInteger(ticks) || ticks < 0) throw new RangeError("ticks 必須是大於等於 0 的整數");
  if (data.spawns.length === 0) throw new RangeError("這張地圖沒有怪物");
  const s = cloneState(state);
  const events: IdleEvent[] | null = opts.collectEvents ? [] : null;
  const rng = new SeededRng(s.seed);
  const before = { ...s.stats };
  const levelBefore = s.level;
  const pointsBefore = s.unspentPoints;
  let ctx = buildContext(s, data);
  s.skillLevel = ctx.skill ? ctx.skill.level : 0;
  let t = 0;
  let left = ticks;

  const startSearch = () => {
    s.phase = { kind: "searching", remaining: SEARCH_TICKS };
    if (events) events.push({ t, type: "search-start" });
  };

  const startCast = (monster: IdleMonster, hp: number) => {
    const target = monsterTarget(monster);
    const { attacker } = ctx.combatant;
    const skill: SkillLike | null = ctx.skill ? ctx.skill.data : null;
    if (hitChance(attacker, target, skill) === 0) {
      const p1 = skill?.funcHitP1 || 100;
      const required = computeHitRequirement(target.baseDodge, p1, p1).maxRequired;
      s.phase = { kind: "blocked", monsterId: monster.id, required };
      if (events) events.push({ t, type: "hit-too-low", required, current: attacker.hit });
      return;
    }
    const segments = playerHit(attacker, target, skill, rng);
    const { normalAttack } = ctx.combatant;
    const hitTicks = ctx.skill ? ctx.skill.data.hitTicks : [normalAttack.hitTick];
    const castTicks = ctx.skill ? ctx.skill.data.castTicks : normalAttack.castTicks;
    const at = (i: number) => Math.min(castTicks, hitTicks[Math.min(i, hitTicks.length - 1)]);
    const pending: PendingHit[] =
      segments[0][0] === MISS
        ? [{ at: at(0), kind: "miss", damage: 0 }]
        : segments.map(([kind, damage], i): PendingHit => ({ at: at(i), kind: kind === CRIT ? "crit" : "hit", damage }));
    const skillId = ctx.skill ? ctx.skill.skillId : null;
    s.phase = { kind: "casting", monsterId: monster.id, hp, skillId, elapsed: 0, castTicks, pending, next: 0 };
    if (events) events.push({ t, type: "cast", skillId, castTicks });
  };

  const gainExp = (amount: number) => {
    s.exp += amount;
    let leveled = false;
    for (;;) {
      const need = expToNext(s.level, data);
      if (!(s.exp >= need)) break;
      s.exp -= need;
      s.level += 1;
      const points = levelPoints(s.level) - levelPoints(s.level - 1);
      s.unspentPoints += points;
      leveled = true;
      if (events) events.push({ t, type: "level-up", level: s.level, points });
    }
    if (leveled) {
      ctx = buildContext(s, data);
      s.skillLevel = ctx.skill ? ctx.skill.level : 0;
    }
  };

  const kill = (monster: IdleMonster) => {
    const exp = killExp(s.level, monster);
    const money = rng.randint(monster.dropMoneyMin, Math.max(monster.dropMoneyMin, monster.dropMoneyMax));
    s.stats.kills += 1;
    s.stats.exp += exp;
    s.stats.money += money;
    s.money += money;
    if (events) events.push({ t, type: "kill", monsterId: monster.id, exp, money });
    gainExp(exp);
  };

  while (left > 0) {
    const phase = s.phase;
    if (phase.kind === "blocked") {
      // 命中不足：什麼都不會發生，直接吃掉剩下的 ticks，不空轉。
      t += left;
      left = 0;
    } else if (phase.kind === "searching" || phase.kind === "post-cast") {
      if (phase.remaining > left) {
        phase.remaining -= left;
        t += left;
        left = 0;
        continue;
      }
      left -= phase.remaining;
      t += phase.remaining;
      if (phase.kind === "searching") {
        const monster = pickMonster(data, rng);
        if (events) events.push({ t, type: "encounter", monsterId: monster.id });
        startCast(monster, monster.hp);
      } else {
        startCast(data.monsters[phase.monsterId], phase.hp);
      }
    } else {
      const nextAt = phase.next < phase.pending.length ? phase.pending[phase.next].at : phase.castTicks;
      const delta = nextAt - phase.elapsed;
      if (delta > left) {
        phase.elapsed += left;
        t += left;
        left = 0;
        continue;
      }
      left -= delta;
      t += delta;
      phase.elapsed = nextAt;
      if (phase.next < phase.pending.length) {
        const hit = phase.pending[phase.next];
        phase.next += 1;
        if (phase.hp <= 0) continue; // overkill
        const monster = data.monsters[phase.monsterId];
        if (hit.kind === "miss") {
          s.stats.misses += 1;
          if (events) events.push({ t, type: "miss" });
          continue;
        }
        s.stats.hits += 1;
        s.stats.damage += Math.min(hit.damage, phase.hp);
        phase.hp = Math.max(0, phase.hp - hit.damage);
        if (events) events.push({ t, type: "hit", damage: hit.damage, kind: hit.kind });
        if (phase.hp === 0) kill(monster);
      } else if (phase.hp <= 0) {
        startSearch();
      } else {
        // 技能施放後休息 POST_CAST_TICKS；普攻的週期已經是兩次揮擊的間隔，接著直接揮下一次。
        const rest = phase.skillId == null ? 0 : POST_CAST_TICKS;
        s.phase = { kind: "post-cast", monsterId: phase.monsterId, hp: phase.hp, remaining: rest };
      }
    }
  }

  s.seed = rng.state;
  const summary: IdleSummary = {
    ticks,
    kills: s.stats.kills - before.kills,
    exp: s.stats.exp - before.exp,
    money: s.stats.money - before.money,
    hits: s.stats.hits - before.hits,
    misses: s.stats.misses - before.misses,
    damage: s.stats.damage - before.damage,
    levelBefore,
    levelAfter: s.level,
    levelUps: s.level - levelBefore,
    pointsGained: s.unspentPoints - pointsBefore,
    blocked: s.phase.kind === "blocked",
  };
  return { state: s, events: events ?? [], summary };
}
