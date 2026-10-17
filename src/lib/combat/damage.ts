/**
 * 玩家對怪物的一次攻擊：傷害、命中、重擊與 MP，全部是純函式。
 *
 * 逐行移植自 tthol-combat `src/tthol_combat/damage.py`（commit 3e6e777482987b257043d4113331ae1a916af18b）。
 * 數字以 `src/lib/combat/__tests__/vectors.json` 作為黃金測資對拍，兩邊必須保持一致。
 *
 * 重新同步（tthol-combat 的 damage.py 改了之後）：
 *   1. 在 genbu 根目錄執行 `npm run combat:vectors`
 *      （= uv run --project ../tthol-combat python scripts/combat/gen_vectors.py，
 *        會把 tthol-combat 的 git commit 寫進 vectors.json）。
 *   2. 依 Python 的差異修改本檔，並更新上面的 commit。
 *   3. `npx vitest run src/lib/combat` 直到通過。
 * 不要在這裡獨立改公式；公式與常數的出處都在 tthol-combat。
 *
 * 原文件說明：
 *   dmg = ⌊m·B·K / (K + D)⌋ − ⌊D / 2⌋,  K = 5·防禦方等級 + 500,
 *   B = 物攻 + 武器傷害 roll；內勁攻擊則為 內勁 + pdamage（內勁傷害力）roll；
 *   D = 防禦方的 防禦（內勁攻擊為 護勁）；m = 普攻 1、重擊 2、技能為 func_dmg_p1 / 100。
 *   技能用哪一種由 func_dmg 決定（INNER_DMG）；普攻是否為內勁看武器是否只有 pdamage（手套、氣劍）。
 *   全程整數：對整數 n，⌊x − n⌋ = ⌊x⌋ − n，所以擬合結果（▲吹箭客 普攻 134、重擊 283）可精確重現。
 *
 * 整數語意（與 Python 逐一對應）：
 *   - Python `//` 是向下取整除法，負數時與 Math.trunc 不同 → floorDiv。
 *   - Python `int()` 向零截斷 → Math.trunc。
 *   - 數值皆為 JS number；所有中間值須落在 2^53 之內（遊戲面板數值遠小於此）。
 *
 * 所有隨機抽取都經由 `r` 參數；`outcomes` / `expectedDamage` / `damageRange` 套用同樣規則但不抽籤，
 * 供規劃使用（tthol-headless 用它們挑技能）。
 */

// ---------------------------------------------------------------------------
// 隨機數
// ---------------------------------------------------------------------------

/** 只包含 Python 版實際呼叫的兩個方法（random.Random.randrange(n) / randint(a, b)）。 */
export interface Rng {
  /** [0, stop) 的整數，等同 Python `r.randrange(stop)`。 */
  randrange(stop: number): number;
  /** [a, b] 的整數（含兩端），等同 Python `r.randint(a, b)`。 */
  randint(a: number, b: number): number;
}

/** 以 Math.random 實作的預設 Rng。 */
export const mathRng: Rng = {
  randrange: (stop) => Math.floor(Math.random() * stop),
  randint: (a, b) => a + Math.floor(Math.random() * (b - a + 1)),
};

/** 對應 Python 的模組層 `rng = random.Random()`。 */
export const rng: Rng = mathRng;

// ---------------------------------------------------------------------------
// 整數 / 浮點輔助
// ---------------------------------------------------------------------------

/** Python `a // b`（整數）：向下取整，餘數與除數同號。 */
export function floorDiv(a: number, b: number): number {
  const mod = ((a % b) + b) % b;
  return (a - mod) / b;
}

/**
 * Python 浮點 `a // b`（CPython float_floor_div）：以 fmod 求餘數再修正，與 Math.floor(a / b) 在
 * 邊界上可能差 1，因此照 CPython 的做法逐步實作。
 */
export function floatFloorDiv(a: number, b: number): number {
  let mod = a % b;
  let div = (a - mod) / b;
  if (mod !== 0 && b < 0 !== mod < 0) {
    mod += b;
    div -= 1;
  }
  if (div !== 0) {
    let floordiv = Math.floor(div);
    if (div - floordiv > 0.5) floordiv += 1;
    return floordiv;
  }
  const q = a / b;
  return q < 0 || Object.is(q, -0) ? -0 : 0;
}

function sum(xs: readonly number[]): number {
  let s = 0;
  for (const x of xs) s += x;
  return s;
}

// ---------------------------------------------------------------------------
// 常數
// ---------------------------------------------------------------------------

// S->C 43 封包的 segment 型別（tthol-emulator sc/world.py；tthol-headless hits.csv README）
export const HIT = 0;
export const CRIT = 1;
export const MISS = 2;

// 閃躲以下，命中率從 100 %（命中 = 閃躲）呈直線下降，到 閃躲 = DODGE_OUT × 命中 時為 HIT_MIN，之後維持
// （使用者 2026-10-17，依實際遊玩手感：差很多就沒有運氣成分，接近才有；取代原本 命中 / 閃躲 加 5 % 下限，
// 那會讓 閃躲 1198 還被 命中 270 的怪打中 22 %）
export const HIT_MIN = 0;
export const DODGE_OUT = 1.5;
export const CRIT_MAX = 100; // 重擊 超過 100 以 100 計（tthol-data，屬性說明文字）

// 以 內勁 攻擊、對 護勁 的 func_dmg 種類（tthol-data 2026-10-12，來自每種的說明文字；702 / 703 / 744 / 797
// 以 22 萬筆官方命中擬合，tthol-headless hits.csv）：4 明玉功掌法 / 天外天毒 / 靈種，6 毒舌（無視防禦），
// 16 咒術，17 內勁 + 玄學（神火 / 紅蓮 / 冰），19 蔓陀靈種。15（怒擊 / 破空斬）加上 物攻 與 內勁
// （「物攻和內勁總和」）。其餘皆為 物攻（3 / 7 / 8 / 10 / 12 / 13 已擬合，14 為猜測，50 麒麟）；
// 48 / 51（麒麟）有固定 B（KYLIN_FIXED_BASE），仍對 防禦
export const INNER_DMG: ReadonlySet<number> = new Set([4, 6, 16, 17, 19]);
export const DMG_BOTH = 15;
// func_dmg 種類：3 單次 × p1 %，4 相同（以 千瘡百孔 擬合），7 p3 次 × p1 %，8 以 p4 % 機率 p1、否則 p2，
// 6 防禦無視（以 毒舌亂神 擬合）；其他一律視為 3（猜測）
export const DMG_DEFENCE_IGNORED = 6;
export const DMG_MULTI = 7;
export const DMG_CHANCE = 8;
// func_dmg 3 在防禦前加上 p2，與 DMG_WIS 的 玄學 項相同（tthol-data 2026-10-14，44.7 萬筆官方命中：斷空劍法
// p2 200 恆比範圍高 200·K/(K+D)；加上 p2 後 星雲 99.9 %、斷空 100 %、裂空 96.5 %、爆裂猛擊 97.4 % 落在範圍內）
export const DMG_FLAT = 3;
// func_dmg 10（匕首 刺擊：致命 / 無間滅擊 / 幽冥刺擊，「還會因玄學屬性而有額外傷害加成」）：防禦前再加
// 玄學 × p2，3 個技能精確吻合（官方命中，tthol-headless xuanxue-20261013：幽冥刺擊 p2 150，6 個角色
// 11 個 玄學 值 72..189；無間滅擊 p2 120 與 致命刺擊 p2 18 在 玄學 69）
export const DMG_WIS = 10;
// func_dmg 17（神火 / 紅蓮 / 怒火 / 玄冰，「會根據施術者的玄學而有更好的效果」）：再加 p2 × 100·玄學 / (玄學 + 49)，
// 飽和曲線（擬合，非精確：3 個角色 6 個技能的 4 個 玄學 值 15 / 95 / 100 / 123，95 % 命中落在範圍內；
// tthol-headless xuanxue-20261013）
export const DMG_WIS_CURVE = 17;
export const WIS_CURVE_HALF = 49;
// func_dmg 14（拳 奔龍 228 / 翔龍 378 / 553，「此外也會因身法屬性而有額外加成」，p2 90..900）：
// 身法 × p2 / AGI_DIV 併入基底 B，並與其一起被 p1 放大。以一次官方測試擬合（bahamut bsn 6960 sn 5235，
// 2018-05-21，翔龍 Lv1 p1 1600 p2 360，打近 0 防禦的 海馬：武器 平均 1003 + 物攻 724，身法 216，9 次命中
// 平均 52070）：此形式得 52515（+0.9 %，留給 海馬 的防禦）；先前猜的「身法 × p2 在倍率之外」得 105392。
// 只有一個資料點：有更多資料時再重擬合（使用者決定，2026-10-17）
export const DMG_AGI = 14;
export const AGI_DIV = 50;
// func_dmg 48（雙劍連擊 / 速擊 / 瞬擊，迅雷破滅 / 滅寂：「四連擊」 / 「三次傷害」）：p3 次，每次為
// 內勁（無武器 roll）的 p1 % + 防禦前的 p2，沒有 玄學 項。以 Lv198 麒麟 的 831 Lv10 官方 831 筆命中精確吻合
// （tthol-headless 2026-10-15：內勁 263 -> 334 讓每個 segment 移動 4.2 × 71；物攻 / 外功 / 玄學 / 命中 / 技巧
// 的變動不影響）
export const DMG_KYLIN_MULTI = 48;
export const DMG_MULTI_KINDS: ReadonlySet<number> = new Set([DMG_MULTI, DMG_KYLIN_MULTI]);
// func_dmg 50（麒麟 技能，「玄學屬性也會有額外加成」，p2 200..300，連 Lv1 技能也是）：防禦前加上固定的
// 玄學 × p2 / 100 × 外功，不被 p1 放大（擬合：Lv198 麒麟 在 玄學 95 / 103 / 106、外功 132..154、
// p2 200 / 220 / 240 的官方 func 50 命中，tthol-headless 2026-10-15；用 外功 而非 物攻：卸下坐騎時兩者分家）。
// 命中仍比範圍高 2..4 %（懷疑是 842 卸胄 降低了怪物 防禦）
export const DMG_KYLIN_WIS: ReadonlySet<number> = new Set([50]);
// func_dmg 51（828..830）：50 的 內功 版，防禦前加上固定的 玄學 × p2 / 100 × 內力（內力 1 與 11 時精確吻合，
// 官方命中，tthol-headless 2026-10-15）。其 B 沒有武器 roll：內勁 263 時 779.4、334 時 843.4，不受 外功 /
// 物攻 / 命中 / 技巧 / 身法 / HP 影響。0.9 × 內勁 + 543 吻合兩點；只有兩點，所以形式是猜測
export const DMG_KYLIN_FLAT = 51;
export const KYLIN_FIXED_BASE: ReadonlySet<number> = new Set([DMG_KYLIN_MULTI, DMG_KYLIN_FLAT]);
// 各 func_dmg 種類被確認的程度（tthol-emulator docs/server-only-data.md，2026-10-13）：exact = CE 量測點或
// 官方命中全部落在範圍內；fitted = 大多數官方命中落在範圍內；其餘為猜測。
export const EXACT_DMG: ReadonlySet<number> = new Set([3, 4, 6, 7, 8, 10]);
export const FITTED_DMG: ReadonlySet<number> = new Set([17, 50]);

// ---------------------------------------------------------------------------
// 型別
// ---------------------------------------------------------------------------

/** 傷害公式讀取的 magic 欄位（對應 Python 的 SkillLike Protocol）。 */
export interface SkillLike {
  readonly funcDmg: number;
  readonly p1: number;
  readonly p2: number;
  readonly p3: number;
  readonly p4: number;
  readonly funcHitP1: number;
}

/** 施放消耗 MP 讀取的欄位（對應 MpLike）。 */
export interface MpLike {
  readonly spendMp: number;
  readonly spendFlag: number;
}

/** 玩家攻擊讀取的 npc 欄位（對應 TargetLike）。 */
export interface TargetLike {
  readonly level: number;
  readonly extraDef: number;
  readonly magicDef: number;
  readonly baseDodge: number;
}

/**
 * 技能的一個等級（magic row）：func_dmg、func_dmg_p1..p4、func_hit_p1、spend_mp、spend_flag。
 * funcHitP1：命中率倍率，百分比（0 = 未給）；spendFlag：1 = spendMp 是施放者 MP 上限的百分比
 * （金鐘罩、八卦神武陣 Lv6..10）。
 */
export type Skill = SkillLike & MpLike;

/** 怪物這一側：等級、防禦（extraDef）、護勁（magicDef）、閃躲（baseDodge）。 */
export type Target = TargetLike;

/** 玩家這一側（含裝備與 buff 的面板值；所持武器的 roll 與類型）。 */
export interface Attacker {
  readonly level: number;
  /** 物攻（07 id 41） */
  readonly atk: number;
  /** 內勁（42） */
  readonly matk: number;
  /** 命中（45） */
  readonly hit: number;
  /** 重擊（47），百分比 */
  readonly crit: number;
  readonly weaponMin: number;
  readonly weaponMax: number;
  readonly weaponType: string;
  /** 武器的 內勁傷害力 roll（items.pdamage_*） */
  readonly pweaponMin: number;
  readonly pweaponMax: number;
  /** 玄學（07 id 40），含裝備的面板值 */
  readonly wis: number;
  /** 外功（07 id 35），含裝備的面板值（Python 的 str_） */
  readonly str: number;
  /** 內力（07 id 36），含裝備的面板值（Python 的 int_） */
  readonly int: number;
  /** 身法（07 id 38），含裝備的面板值 */
  readonly agi: number;
}

/** 一次攻擊命中時可能的一種落點：機率（0..1，不含 miss）、其 43 segment 型別、總傷害的下限 / 上限。 */
export interface Outcome {
  readonly p: number;
  readonly kind: number;
  readonly lo: number;
  readonly hi: number;
}

/** Skill 的建構器，欄位預設值同 Python dataclass。 */
export function makeSkill(init: Partial<Skill> & Pick<Skill, "funcDmg" | "p1">): Skill {
  return { p2: 0, p3: 0, p4: 0, funcHitP1: 0, spendMp: 0, spendFlag: 0, ...init };
}

/** Target 的建構器，欄位預設值同 Python dataclass。 */
export function makeTarget(
  init: Partial<Target> & Pick<Target, "level" | "extraDef" | "magicDef">,
): Target {
  return { baseDodge: 0, ...init };
}

/** Attacker 的建構器，欄位預設值同 Python dataclass。 */
export function makeAttacker(
  init: Partial<Attacker> & Pick<Attacker, "level" | "atk" | "matk" | "hit" | "crit">,
): Attacker {
  return {
    weaponMin: 0,
    weaponMax: 0,
    weaponType: "",
    pweaponMin: 0,
    pweaponMax: 0,
    wis: 0,
    str: 0,
    int: 0,
    agi: 0,
    ...init,
  };
}

// ---------------------------------------------------------------------------
// Attacker 的方法（Python 的 Attacker.roll / roll_range / inner_swing）
// ---------------------------------------------------------------------------

/** `roll` 的 (低, 高)。 */
export function rollRange(a: Attacker, inner: boolean): [number, number] {
  const [lo, hi] = inner ? [a.pweaponMin, a.pweaponMax] : [a.weaponMin, a.weaponMax];
  return hi ? [lo, Math.max(lo, hi)] : [0, 0];
}

/** B 中武器的部分：內勁 攻擊為 rand(pdamage)，否則 rand(damage)；空手為 0。 */
export function roll(a: Attacker, r: Rng, inner: boolean): number {
  const [lo, hi] = rollRange(a, inner);
  return hi ? r.randint(lo, hi) : 0;
}

/**
 * 普攻以 內勁 命中：武器有 pdamage roll 而沒有 damage roll（手套、氣劍；以手套量測，tthol-data）。
 * STAFF / CLAW / WHISK 兩者都有：物攻（未量測）。
 */
export function innerSwing(a: Attacker): boolean {
  return a.pweaponMax > 0 && a.weaponMax === 0;
}

// ---------------------------------------------------------------------------
// 公式
// ---------------------------------------------------------------------------

/**
 * ⌊((mult100 / 100)·B + extra)·K / (K + D)⌋ − ⌊D / 2⌋，至少為 1；K = 5·level + 500（level 與 D 為防禦方）；
 * `extra` = 技能的固定項（DMG_WIS、DMG_KYLIN_WIS）。
 */
export function physical(
  base: number,
  mult100: number,
  level: number,
  defence: number,
  extra = 0,
): number {
  const k = 5 * level + 500;
  return Math.max(
    1,
    floorDiv((mult100 * base + 100 * extra) * k, 100 * (k + defence)) - floorDiv(defence, 2),
  );
}

/**
 * 防禦無視（func_dmg 6）：⌊p1/100·(內勁 + pdamage roll) + p3/100·(物攻 + damage roll) + p2⌋，無防禦
 * （手套上 4 個精確點，傷害 0；物攻 那一半的武器 roll 來自 WHISK 660..679：tthol-data 2026-10-14，
 * 官方命中在沒有它時比範圍高 1.5 × 該 roll）。
 */
export function ignoreDefence(
  p1: number,
  p2: number,
  p3: number,
  matkPlusWeapon: number,
  atkPlusWeapon: number,
): number {
  return Math.max(1, floorDiv(p1 * matkPlusWeapon + p3 * atkPlusWeapon, 100) + p2);
}

/**
 * 命中率（百分比）。技能的 func_hit_p1 % 先縮放 命中（資料中 80..500；修羅刀法 87 寫
 * 「需提高技巧屬性以彌補本招命中較低的劣勢」：更多技巧能彌補，所以它不是命中率上限）。然後
 * 命中 >= 閃躲 必中（使用者，依實際遊玩）；低於時命中率隨 命中 / 閃躲 線性下降，從 1 時的 100 % 到
 * 1 / DODGE_OUT 時的 HIT_MIN（1.1x 閃躲 73 %、1.25x 40 %、1.4x 14 %、1.5x 以上 0 %；使用者的選擇，
 * 2026-10-17，非官方命中擬合）。怪打玩家與玩家打怪皆同。
 */
export function chance(attackHit: number, dodge: number, skillPct = 0): number {
  const hit = skillPct ? floorDiv(attackHit * skillPct, 100) : attackHit;
  if (hit >= dodge) return 100;
  // 100 · (hit / dodge − 1 / out) / (1 − 1 / out) = 100 · (out · hit − dodge) / ((out − 1) · dodge)
  // Python 此處是浮點 `//` 再 int()
  const pct = Math.trunc(
    floatFloorDiv(100 * (DODGE_OUT * hit - dodge), (DODGE_OUT - 1) * Math.max(1, dodge)),
  );
  return Math.max(HIT_MIN, Math.min(100, pct));
}

/** 施放花費的 MP：spendMp，或 spendFlag 1 時為 MP 上限的 spendMp %（金鐘罩 「消耗25％的真氣」，八卦神武陣 Lv6..10 「消耗35%真氣」）。 */
export function mpCost(skill: MpLike, mpMax: number): number {
  return skill.spendFlag ? floorDiv(mpMax * skill.spendMp, 100) : skill.spendMp;
}

/** 普攻的 重擊 百分比（技能不會重擊）。 */
export function critChance(critPct: number): number {
  return Math.min(CRIT_MAX, Math.max(0, critPct));
}

/** 技能在防禦前加上的固定項：玄學（DMG_WIS / DMG_WIS_CURVE）或 p2（DMG_FLAT、DMG_KYLIN_MULTI）。 */
export function wisBonus(skill: SkillLike, wis: number): number {
  if (skill.funcDmg === DMG_FLAT) return skill.p2;
  if (skill.funcDmg === DMG_WIS) return wis * skill.p2;
  if (skill.funcDmg === DMG_KYLIN_MULTI) return skill.p2;
  if (skill.funcDmg === DMG_WIS_CURVE && wis > 0) {
    return floorDiv(skill.p2 * 100 * wis, wis + WIS_CURVE_HALF);
  }
  return 0;
}

/** DMG_AGI 的 身法 項：⌊身法 · p2 / AGI_DIV⌋ 加進基底 B（所以被 p1 放大），其他種類為 0。 */
export function agiBonus(skill: SkillLike, a: Attacker): number {
  return skill.funcDmg === DMG_AGI ? floorDiv(Math.max(0, a.agi) * skill.p2, AGI_DIV) : 0;
}

/**
 * 麒麟 的 玄學 項，加在 p1 % 倍率之後、防禦之前：玄學 × p2 / 100 × 外功（DMG_KYLIN_WIS，擬合）或
 * × 內力（DMG_KYLIN_FLAT，精確）。
 */
export function kylinWis(skill: SkillLike, a: Attacker): number {
  let stat: number;
  if (DMG_KYLIN_WIS.has(skill.funcDmg)) {
    stat = a.str;
  } else if (skill.funcDmg === DMG_KYLIN_FLAT) {
    stat = a.int;
  } else {
    return 0;
  }
  return floorDiv(Math.max(0, a.wis) * skill.p2 * Math.max(0, stat), 100);
}

/** KYLIN_FIXED_BASE 技能的 B，無武器 roll：內勁（DMG_KYLIN_MULTI）或 0.9 × 內勁 + 543（DMG_KYLIN_FLAT，猜測）。 */
export function fixedBase(a: Attacker, skill: SkillLike): number {
  return skill.funcDmg === DMG_KYLIN_MULTI ? a.matk : floorDiv(9 * a.matk, 10) + 543;
}

/** 攻擊以 內勁 對 護勁 命中（DMG_BOTH：物攻 + 內勁 對 防禦，回傳 false）。 */
export function usesInner(a: Attacker, skill: SkillLike | null): boolean {
  return skill === null ? innerSwing(a) : INNER_DMG.has(skill.funcDmg);
}

export function defenceOf(a: Attacker, t: TargetLike, skill: SkillLike | null): number {
  return usesInner(a, skill) ? t.magicDef : t.extraDef;
}

/** B 的 (低, 高)：攻擊屬性加武器 roll（DMG_BOTH 兩個 roll 都加，KYLIN_FIXED_BASE 都不加）。 */
export function baseRange(a: Attacker, skill: SkillLike | null): [number, number] {
  if (skill !== null && KYLIN_FIXED_BASE.has(skill.funcDmg)) {
    const b = fixedBase(a, skill);
    return [b, b];
  }
  if (skill !== null && skill.funcDmg === DMG_BOTH) {
    const [lo, hi] = rollRange(a, false);
    const [plo, phi] = rollRange(a, true);
    return [a.atk + a.matk + lo + plo, a.atk + a.matk + hi + phi];
  }
  const inner = usesInner(a, skill);
  const [lo, hi] = rollRange(a, inner);
  const stat = inner ? a.matk : a.atk;
  return [stat + lo, stat + hi];
}

/**
 * B = `base`、倍率 `mult100` 的一次命中各 43 segment 的傷害（普攻為 100 / 200 對應 一般 / 重擊；
 * DMG_DEFENCE_IGNORED 忽略它，其 物攻 那一半是 `atkBase` = 物攻 + damage roll，為 null 時只用 物攻）。
 */
export function segments(
  a: Attacker,
  t: TargetLike,
  skill: SkillLike | null,
  base: number,
  mult100: number,
  atkBase: number | null = null,
): number[] {
  const defence = defenceOf(a, t, skill);
  if (skill === null) return [physical(base, mult100, t.level, defence)];
  if (skill.funcDmg === DMG_DEFENCE_IGNORED) {
    return [ignoreDefence(skill.p1, skill.p2, skill.p3, base, atkBase === null ? a.atk : atkBase)];
  }
  const hits = DMG_MULTI_KINDS.has(skill.funcDmg) ? Math.max(1, skill.p3) : 1;
  const extra = wisBonus(skill, a.wis) + kylinWis(skill, a);
  const dmg = physical(base + agiBonus(skill, a), Math.max(1, mult100), t.level, defence, extra);
  return Array.from({ length: hits }, () => dmg);
}

/** 攻擊命中的百分比。 */
export function hitChance(a: Attacker, t: TargetLike, skill: SkillLike | null = null): number {
  return chance(a.hit, t.baseDodge, skill ? skill.funcHitP1 : 0);
}

/** 攻擊所有可能的落點，含各自機率（miss 為剩餘到 1 的部分）與總傷害範圍。 */
export function outcomes(a: Attacker, t: TargetLike, skill: SkillLike | null = null): Outcome[] {
  const pHit = hitChance(a, t, skill) / 100;
  const [lo, hi] = baseRange(a, skill);
  const [rlo, rhi] = rollRange(a, false);
  const alo = a.atk + rlo;
  const ahi = a.atk + rhi;
  let ways: [number, number, number][];
  if (skill === null) {
    const c = critChance(a.crit) / 100;
    ways = [
      [1 - c, HIT, 100],
      [c, CRIT, 200],
    ];
  } else if (skill.funcDmg === DMG_CHANCE) {
    const c = Math.min(100, Math.max(0, skill.p4)) / 100;
    ways = [
      [c, HIT, skill.p1],
      [1 - c, HIT, skill.p2],
    ];
  } else {
    ways = [[1.0, HIT, skill.p1]];
  }
  const out: Outcome[] = [];
  for (const [p, kind, mult] of ways) {
    if (p > 0) {
      out.push({
        p: pHit * p,
        kind,
        lo: sum(segments(a, t, skill, lo, mult, alo)),
        hi: sum(segments(a, t, skill, hi, mult, ahi)),
      });
    }
  }
  return out;
}

/** 一次攻擊從 HP 扣掉的平均值，含 miss（武器 roll 視為均勻分布）。 */
export function expectedDamage(a: Attacker, t: TargetLike, skill: SkillLike | null = null): number {
  return sum(outcomes(a, t, skill).map((o) => (o.p * (o.lo + o.hi)) / 2));
}

/** 命中時的 (低, 高) HP；無法命中（沒有落點）時為 (0, 0)。 */
export function damageRange(
  a: Attacker,
  t: TargetLike,
  skill: SkillLike | null = null,
): [number, number] {
  const out = outcomes(a, t, skill);
  return out.length > 0
    ? [Math.min(...out.map((o) => o.lo)), Math.max(...out.map((o) => o.hi))]
    : [0, 0];
}

/**
 * 玩家對怪物一次攻擊的 43 segments：miss 為 [[MISS, 0]]，否則每次命中一個 segment，重擊為 [CRIT, dmg]。
 * 只有普攻會重擊：技能不會（使用者，官方設計）。
 *
 * 抽籤順序必須與 Python 完全相同（命中 randrange、roll 的 randint、重擊 / 機率 randrange），
 * 黃金測資會重播這個序列。
 */
export function playerHit(
  a: Attacker,
  t: TargetLike,
  skill: SkillLike | null = null,
  r: Rng | null = null,
): [number, number][] {
  const rr = r ?? rng;
  if (rr.randrange(100) >= hitChance(a, t, skill)) return [[MISS, 0]];
  let base: number;
  if (skill !== null && skill.funcDmg === DMG_BOTH) {
    // 防禦：防禦（猜測）。求值順序同 Python：先 物攻 roll，再 內勁 roll
    base = a.atk + roll(a, rr, false) + a.matk + roll(a, rr, true);
  } else if (skill !== null && KYLIN_FIXED_BASE.has(skill.funcDmg)) {
    base = fixedBase(a, skill);
  } else {
    const inner = usesInner(a, skill);
    base = (inner ? a.matk : a.atk) + roll(a, rr, inner);
  }
  if (skill === null) {
    const crit = rr.randrange(100) < critChance(a.crit);
    return segments(a, t, null, base, crit ? 200 : 100).map((v): [number, number] => [
      crit ? CRIT : HIT,
      v,
    ]);
  }
  let mult = skill.p1;
  if (skill.funcDmg === DMG_CHANCE) {
    mult = rr.randrange(100) < skill.p4 ? skill.p1 : skill.p2;
  }
  const atkBase = skill.funcDmg === DMG_DEFENCE_IGNORED ? a.atk + roll(a, rr, false) : null;
  return segments(a, t, skill, base, mult, atkBase).map((v): [number, number] => [HIT, v]);
}
