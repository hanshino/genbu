"""Golden test vectors for src/lib/combat/damage.ts, generated from the Python tthol-combat.

Run from the genbu root (npm run combat:vectors does exactly this):

    uv run --project ../tthol-combat python scripts/combat/gen_vectors.py src/lib/combat/__tests__/vectors.json

Deterministic: fixed loops plus random.Random(SEED); the same tthol-combat commit gives the same file.
Case shape: {fn, args, expected} (+ rng for playerHit: the recorded call sequence the TS test replays).
Objects use the TS field names (camelCase; str_ -> str, int_ -> int); None -> null, tuples -> arrays.
"""

import json
import random
import subprocess
import sys
from dataclasses import asdict, replace
from pathlib import Path

import tthol_combat
from tthol_combat import damage as d
from tthol_combat.damage import Attacker, Skill, Target

SEED = 20261018
OUT_DEFAULT = Path('src/lib/combat/__tests__/vectors.json')

CAMEL = {
    'func_dmg': 'funcDmg',
    'func_hit_p1': 'funcHitP1',
    'spend_mp': 'spendMp',
    'spend_flag': 'spendFlag',
    'extra_def': 'extraDef',
    'magic_def': 'magicDef',
    'base_dodge': 'baseDodge',
    'weapon_min': 'weaponMin',
    'weapon_max': 'weaponMax',
    'weapon_type': 'weaponType',
    'pweapon_min': 'pweaponMin',
    'pweapon_max': 'pweaponMax',
    'str_': 'str',
    'int_': 'int',
}


def js(obj):
    """dataclass -> dict with TS field names; leaves other values alone."""
    if obj is None:
        return None
    return {CAMEL.get(k, k): v for k, v in asdict(obj).items()}


def git(*args: str) -> str:
    repo = Path(tthol_combat.__file__).resolve().parents[2]
    return subprocess.run(['git', '-C', str(repo), *args], check=True, capture_output=True, text=True).stdout.strip()


class Recording(random.Random):
    """A seeded Random that logs each randrange / randint call (method, args, return value).

    `rr` / `ri` force the return value: rr an int for every randrange, ri 'lo' / 'hi' for randint. Draws made
    inside randint (random.Random.randint calls self.randrange) are not logged.
    """

    def __init__(self, seed, rr=None, ri=None):
        super().__init__(seed)
        self.calls = []
        self.rr, self.ri = rr, ri
        self._depth = 0

    def randrange(self, *a, **k):  # type: ignore[override]
        if self._depth == 0 and self.rr is not None:
            ret = self.rr
        else:
            ret = super().randrange(*a, **k)
        if self._depth == 0:
            self.calls.append({'method': 'randrange', 'args': list(a), 'ret': ret})
        return ret

    def randint(self, a, b):  # type: ignore[override]
        self._depth += 1
        try:
            ret = a if self.ri == 'lo' else b if self.ri == 'hi' else super().randint(a, b)
        finally:
            self._depth -= 1
        self.calls.append({'method': 'randint', 'args': [a, b], 'ret': ret})
        return ret


KINDS = [3, 4, 6, 7, 8, 10, 14, 15, 16, 17, 19, 48, 50, 51, 12, 99, 0]  # 12 / 99 / 0 fall back to 3's reading


def gen_attacker(r: random.Random) -> Attacker:
    weapon = r.choice(['none', 'phys', 'inner', 'both', 'odd'])
    wmin = wmax = pmin = pmax = 0
    if weapon in ('phys', 'both'):
        wmin = r.randint(0, 1200)
        wmax = wmin + r.randint(0, 80)
    if weapon in ('inner', 'both'):
        pmin = r.randint(0, 1200)
        pmax = pmin + r.randint(0, 80)
    if weapon == 'odd':  # max below min, or a min with no max
        wmin, wmax = r.choice([(500, 400), (300, 0), (0, 90)])
        pmin, pmax = r.choice([(700, 650), (200, 0), (0, 50)])
    neg = r.random() < 0.15  # negative panel terms (debuffs): floor division vs truncation
    return Attacker(
        level=r.randint(1, 250),
        atk=r.randint(0, 3000),
        matk=r.randint(0, 3000),
        hit=r.choice([0, 1, 50, 100, 270, 10**6, r.randint(1, 1500)]),
        crit=r.choice([-20, 0, 30, 99, 100, 101, 250, r.randint(0, 150)]),
        weapon_min=wmin,
        weapon_max=wmax,
        weapon_type=r.choice(['', 'SWORD', 'WHISK', 'PUNCHER', 'STAFF', 'DAGGER']),
        pweapon_min=pmin,
        pweapon_max=pmax,
        wis=r.randint(-120, 0) if neg else r.randint(0, 250),
        str_=r.randint(-50, 0) if neg else r.randint(0, 250),
        int_=r.randint(-50, 0) if neg else r.randint(0, 250),
        agi=r.randint(-100, 0) if neg else r.randint(0, 400),
    )


def gen_target(r: random.Random) -> Target:
    return Target(
        level=r.randint(1, 250),
        extra_def=r.choice([0, 1, 29, 92, 500, 1539, r.randint(0, 4000)]),
        magic_def=r.choice([0, 1, 40, 216, 700, r.randint(0, 4000)]),
        base_dodge=r.choice([0, 1, 74, 100, 1198, r.randint(0, 600)]),
    )


def gen_skill(r: random.Random, kind: int | None = None) -> Skill:
    return Skill(
        func_dmg=r.choice(KINDS) if kind is None else kind,
        p1=r.choice([0, 100, 150, 420, 800, 1300, 1600, 1900, r.randint(0, 2500)]),
        p2=r.choice([0, 0, 50, 150, 200, 240, 360, r.randint(-100, 900)]),
        p3=r.choice([0, 1, 2, 3, 4, 150]),
        p4=r.choice([-10, 0, 25, 50, 75, 100, 130]),
        func_hit_p1=r.choice([0, 0, 50, 86, 87, 100, 200, 500]),
        spend_mp=r.randint(0, 400),
        spend_flag=r.choice([0, 1]),
    )


def main() -> None:
    out_path = Path(sys.argv[1]) if len(sys.argv) > 1 else OUT_DEFAULT
    r = random.Random(SEED)
    cases: list[dict] = []

    def add(fn, args, expected, **extra):
        cases.append({'fn': fn, 'args': args, 'expected': expected, **extra})

    # physical: grids, plus big defence (clamped to 1) and negative extra (floor vs trunc)
    for base in (0, 1, 155, 1000, 2945, 30000):
        for mult in (0, 50, 100, 200, 500, 1650, 2250):
            for level, defence in ((1, 0), (37, 29), (100, 500), (156, 1539), (250, 4000)):
                add('physical', [base, mult, level, defence], d.physical(base, mult, level, defence))
    for _ in range(150):
        args = [r.randint(0, 6000), r.randint(0, 2500), r.randint(1, 250), r.randint(0, 3000), r.randint(-3000, 40000)]
        add('physical', args, d.physical(*args))
    for _ in range(40):  # negative numerators: ⌊⌋ differs from trunc
        args = [r.randint(0, 500), r.randint(1, 300), r.randint(1, 250), r.randint(0, 800), r.randint(-9000, -1)]
        add('physical', args, d.physical(*args))

    # ignoreDefence
    for _ in range(80):
        args = [r.randint(0, 2000), r.randint(-200, 900), r.randint(0, 300), r.randint(0, 4000), r.randint(0, 4000)]
        add('ignoreDefence', args, d.ignore_defence(*args))
    add('ignoreDefence', [1300, 450, 150, 1212, 155], d.ignore_defence(1300, 450, 150, 1212, 155))
    add('ignoreDefence', [1300, 450, 150, 1298, 155], d.ignore_defence(1300, 450, 150, 1298, 155))

    # chance: 命中 >= 閃躲, around and beyond the 1.5x cutoff (dense sweep), skill scaling, dodge 0
    for hit in list(range(1, 121, 3)) + [123, 270, 317, 500, 999, 10**6]:
        top = int(hit * 1.6) + 3
        for dodge in sorted({0, 1, hit - 1, hit, hit + 1, *range(hit + 1, top, max(1, hit // 20 + 1))}):
            add('chance', [hit, dodge], d.chance(hit, dodge))
        for x in (1.1, 1.25, 1.4, 1.4999, 1.5, 1.5001, 1.6, 4.5):
            dodge = round(hit * x)
            add('chance', [hit, dodge], d.chance(hit, dodge))
    for _ in range(150):
        args = [r.randint(1, 600), r.randint(0, 1000), r.choice([0, 50, 86, 87, 90, 100, 200, 500])]
        add('chance', args, d.chance(*args))
    add('chance', [1198, 270], d.chance(1198, 270))
    add('chance', [270, 1198], d.chance(270, 1198))
    add('chance', [317, 111, 87], d.chance(317, 111, 87))
    add('chance', [100, 100, 87], d.chance(100, 100, 87))
    add('chance', [50, 100, 50], d.chance(50, 100, 50))
    add('chance', [60, 100, 200], d.chance(60, 100, 200))

    # mpCost
    for _ in range(40):
        s = gen_skill(r)
        mp_max = r.randint(0, 6000)
        add('mpCost', [js(s), mp_max], d.mp_cost(s, mp_max))
    add('mpCost', [js(Skill(func_dmg=0, p1=0, spend_mp=25, spend_flag=1)), 1881], 470)

    # critChance
    for c in (-100, -1, 0, 1, 30, 99, 100, 101, 250):
        add('critChance', [c], d.crit_chance(c))

    # per-kind sweep over random attackers / targets for every function that takes them
    for kind in KINDS:
        for _ in range(14):
            a, t, s = gen_attacker(r), gen_target(r), gen_skill(r, kind)
            ja, jt, js_ = js(a), js(t), js(s)
            wis = r.randint(-30, 250)
            add('wisBonus', [js_, wis], d.wis_bonus(s, wis))
            add('agiBonus', [js_, ja], d.agi_bonus(s, a))
            add('kylinWis', [js_, ja], d.kylin_wis(s, a))
            add('fixedBase', [ja, js_], d.fixed_base(a, s))
            add('usesInner', [ja, js_], d.uses_inner(a, s))
            add('defenceOf', [ja, jt, js_], d.defence_of(a, t, s))
            add('baseRange', [ja, js_], list(d.base_range(a, s)))
            add('hitChance', [ja, jt, js_], d.hit_chance(a, t, s))
            add('damageRange', [ja, jt, js_], list(d.damage_range(a, t, s)))
            add('expectedDamage', [ja, jt, js_], d.expected_damage(a, t, s))
            add('outcomes', [ja, jt, js_], [dict(o._asdict()) for o in d.outcomes(a, t, s)])
            lo, hi = d.base_range(a, s)
            alo, ahi = a.atk + a.roll_range(False)[0], a.atk + a.roll_range(False)[1]
            for base, atk_base in ((lo, alo), (hi, ahi), (lo, None)):
                mult = r.choice([100, 200, s.p1, 0])
                add('segments', [ja, jt, js_, base, mult, atk_base], d.segments(a, t, s, base, mult, atk_base))
            add('segments', [ja, jt, js_, lo, s.p1], d.segments(a, t, s, lo, s.p1))

    # skill = None (normal attack): inner swings (gloves), crit above / below 100
    for _ in range(80):
        a, t = gen_attacker(r), gen_target(r)
        ja, jt = js(a), js(t)
        add('usesInner', [ja, None], d.uses_inner(a, None))
        add('defenceOf', [ja, jt, None], d.defence_of(a, t, None))
        add('baseRange', [ja, None], list(d.base_range(a, None)))
        add('hitChance', [ja, jt, None], d.hit_chance(a, t, None))
        add('damageRange', [ja, jt, None], list(d.damage_range(a, t, None)))
        add('expectedDamage', [ja, jt, None], d.expected_damage(a, t, None))
        add('outcomes', [ja, jt, None], [dict(o._asdict()) for o in d.outcomes(a, t, None)])
        lo, hi = d.base_range(a, None)
        for base, mult in ((lo, 100), (hi, 200)):
            add('segments', [ja, jt, None, base, mult, None], d.segments(a, t, None, base, mult))
    # cannot hit (no outcome): crit 0 + chance outcomes with p 0 cannot all vanish, so a DMG_CHANCE with p4/p1 0 does
    for p4 in (0, 100):
        s = Skill(func_dmg=8, p1=800, p2=400, p4=p4)
        a, t = Attacker(100, 155, 0, 10**6, 0), Target(37, 29, 0)
        add('outcomes', [js(a), js(t), js(s)], [dict(o._asdict()) for o in d.outcomes(a, t, s)])
        add('damageRange', [js(a), js(t), js(s)], list(d.damage_range(a, t, s)))

    # playerHit: record every random call; forced modes pin the miss / hit / crit / roll-low / roll-high paths
    modes = [
        dict(),
        dict(rr=0),
        dict(rr=94),
        dict(rr=99),
        dict(rr=0, ri='lo'),
        dict(rr=94, ri='lo'),
        dict(rr=94, ri='hi'),
        dict(ri='hi'),
    ]
    for kind in [None] + KINDS:
        for i in range(24):
            a, t = gen_attacker(r), gen_target(r)
            if i % 3:  # mostly attackers that land the hit, so the rolls and crits are exercised
                a = replace(a, hit=10**6)
            s = None if kind is None else gen_skill(r, kind)
            rec = Recording(r.randint(0, 2**32), **modes[i % len(modes)])
            got = d.player_hit(a, t, s, rec)
            add('playerHit', [js(a), js(t), js(s)], [list(x) for x in got], rng=rec.calls)

    meta = {
        'tthol_combat_commit': git('rev-parse', 'HEAD'),
        'tthol_combat_dirty': bool(git('status', '--porcelain', '--', 'src')),
        'seed': SEED,
        'generator': 'scripts/combat/gen_vectors.py',
    }
    out_path.parent.mkdir(parents=True, exist_ok=True)
    with out_path.open('w', encoding='utf-8', newline='\n') as f:
        f.write('{\n')
        for k, v in meta.items():
            f.write(f'  {json.dumps(k)}: {json.dumps(v)},\n')
        f.write('  "cases": [\n')
        f.write(',\n'.join('    ' + json.dumps(c, ensure_ascii=False) for c in cases))
        f.write('\n  ]\n}\n')

    counts: dict[str, int] = {}
    for c in cases:
        counts[c['fn']] = counts.get(c['fn'], 0) + 1
    print(f'wrote {len(cases)} cases to {out_path} (tthol-combat {meta["tthol_combat_commit"][:7]})')
    for fn, n in sorted(counts.items()):
        print(f'  {fn}: {n}')


if __name__ == '__main__':
    main()
