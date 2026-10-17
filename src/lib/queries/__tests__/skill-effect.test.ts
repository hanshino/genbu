import { describe, it, expect } from "vitest";
import { getDb } from "@/lib/db";
import { getSkillEffectAvailability, getSkillEffectBundle } from "../skill-effect";
import { GET } from "@/app/api/skills/[id]/effect/route";
import { showsTarget, spriteKey, type SkillEffectBundle } from "@/lib/skill-effect";

const MAGIC_ID = 4; // 怒擊：cast_effect 508 / target，男 preset 100、女 preset 101

// 全表約 5000 個 (id, 等級)，逐一組 bundle 太慢；每種 (cast_effect, variant, target_mode) 取一組代表。
function presetKeys(): { id: number; level: number }[] {
  return getDb()
    .prepare(
      `SELECT MIN(magic_id) AS id, MIN(level) AS level FROM magic_effect_presets
       GROUP BY cast_effect, variant, target_mode, preset_id`,
    )
    .all() as { id: number; level: number }[];
}

function casterOf(b: SkillEffectBundle, gender: "m" | "f" = "m") {
  const c = b.casters[gender]!;
  return { caster: c, timeline: b.timelines[c.timelineKey] };
}

describe("skill-effect query", () => {
  it("availability：有演出的技能等級", () => {
    const a = getSkillEffectAvailability(MAGIC_ID, 1);
    expect(a).not.toBeNull();
    expect(a!.level).toBe(1);
    expect([...a!.genders].sort()).toEqual(["f", "m"]);
    expect(a!.presets.m?.label).toBeTruthy();
    expect(a!.presets.f?.label).toBeTruthy();
    expect(a!.presets.m?.targetMode).toBe("enemy");
  });

  it("availability：沒有演出的技能、等級或無效 id 回 null", () => {
    expect(getSkillEffectAvailability(-1, 1)).toBeNull();
    expect(getSkillEffectAvailability(0, 1)).toBeNull();
    expect(getSkillEffectAvailability(999999999, 1)).toBeNull();
    expect(getSkillEffectAvailability(MAGIC_ID, 9999)).toBeNull();
    expect(getSkillEffectAvailability(MAGIC_ID, 0)).toBeNull();
    expect(getSkillEffectBundle(999999999, 1)).toBeNull();
    expect(getSkillEffectBundle(MAGIC_ID, 9999)).toBeNull();
  });

  it("沒指定等級時取有資料的最低等級", () => {
    const lowest = getDb()
      .prepare("SELECT MIN(level) AS level FROM magic_effect_presets WHERE magic_id = 553")
      .get() as { level: number };
    expect(getSkillEffectAvailability(553)?.level).toBe(lowest.level);
    expect(getSkillEffectBundle(553)?.level).toBe(lowest.level);
  });

  it("以 (技能 id, 等級) 為 key：同一個 id 不同等級是不同演出", () => {
    const self = getSkillEffectBundle(553, 25)!;
    const enemy = getSkillEffectBundle(553, 35)!;
    expect(self.casters.m!.timelineKey).toBe("511:self");
    expect(self.casters.m!.targetMode).toBe("self");
    expect(self.target).toBeNull();
    expect(enemy.casters.m!.timelineKey).toBe("320:target");
    expect(enemy.casters.m!.targetMode).toBe("enemy");
    expect(enemy.target?.name).toBe("咆嘯雪狼");
    expect(getSkillEffectAvailability(553, 25)!.presets.m!.targetMode).toBe("self");
    expect(getSkillEffectAvailability(553, 35)!.presets.m!.targetMode).toBe("enemy");
  });

  it("359 Lv1 是 self（沒有怪物）；369 Lv1 是 ce 182 / enemy", () => {
    const thorn = getSkillEffectBundle(359, 1)!;
    expect(thorn.casters.m!.timelineKey).toBe("317:self");
    expect(thorn.casters.m!.targetMode).toBe("self");
    expect(thorn.target).toBeNull();
    const poison = getSkillEffectBundle(369, 1)!;
    expect(poison.casters.m!.timelineKey).toBe("182:target");
    expect(poison.casters.m!.targetMode).toBe("enemy");
    expect(poison.target).not.toBeNull();
  });

  it("fidelity：104 的演出標為 partial，怒擊是 ok", () => {
    expect(getSkillEffectAvailability(104, 1)!.presets.m!.fidelity).toBe("partial");
    expect(casterOf(getSkillEffectBundle(104, 1)!).timeline.fidelity).toBe("partial");
    expect(getSkillEffectAvailability(MAGIC_ID, 1)!.presets.m!.fidelity).toBe("ok");
  });

  it("availability 與 bundle 一致：每種 preset 組合的代表 (id, 等級) 都組得出 bundle", () => {
    for (const { id, level } of presetKeys()) {
      expect(getSkillEffectAvailability(id, level), `magic ${id} Lv${level}`).not.toBeNull();
      expect(getSkillEffectBundle(id, level), `magic ${id} Lv${level}`).not.toBeNull();
    }
  });

  it("bundle：時間軸、施法者與目標素材齊全", () => {
    const b = getSkillEffectBundle(MAGIC_ID, 1)!;
    for (const g of ["m", "f"] as const) {
      const { caster, timeline } = casterOf(b, g);
      expect(timeline.tickMs).toBeGreaterThan(0);
      expect(timeline.frames.length).toBeGreaterThan(0);
      expect(timeline.ticks).toBeGreaterThan(0);
      expect(caster.label).toBeTruthy();
      expect(Object.keys(caster.strips)).toContain("prepare");
      for (const s of Object.values(caster.strips)) {
        expect(s.delays.every((n) => Number.isInteger(n))).toBe(true);
        expect(s.delays.length).toBe(s.frames);
      }
    }
    // 男女指到同一條時間軸時只送一份
    expect(Object.keys(b.timelines)).toEqual(["508:target"]);
    expect(b.target!.npcId).toBe(8346);
    expect(b.target!.name).toBe("咆嘯雪狼");
    expect(Object.keys(b.target!.strips).sort()).toEqual(["death", "hurt", "wait"]);
  });

  it("bundle：只帶時間軸用得到的特效素材，缺圖的組合極少", () => {
    const missing = new Set<string>();
    for (const { id, level } of presetKeys()) {
      const b = getSkillEffectBundle(id, level);
      if (!b) continue;
      const used = new Set<string>();
      for (const t of Object.values(b.timelines)) {
        for (const f of t.frames) {
          for (const o of f.o) if (o[1] != null) used.add(spriteKey(o[1], String(o[2])));
        }
      }
      const have = new Set(b.sprites.map((s) => spriteKey(s.seq, s.state)));
      for (const key of have) expect(used.has(key), `magic ${id} Lv${level} ${key}`).toBe(true);
      for (const key of used) if (!have.has(key)) missing.add(key);
    }
    console.info("missing (seq:state):", [...missing].sort());
    // 已知少數 (seq, state) 沒有素材，播放時靜默略過。
    expect(missing.size).toBeLessThanOrEqual(6);
  });

  it("bundle：怒擊有命中事件與特效", () => {
    const { timeline } = casterOf(getSkillEffectBundle(MAGIC_ID, 1)!);
    const b = getSkillEffectBundle(MAGIC_ID, 1)!;
    expect(timeline.frames.some((f) => f.e?.some((e) => e.type === "hit"))).toBe(true);
    expect(b.sprites.length).toBeGreaterThan(0);
    expect(["add", "sub", "alpha", "normal"]).toContain(b.sprites[0].blend);
  });

  it("target_mode 決定要不要帶怪物素材", () => {
    for (const { id, level } of presetKeys()) {
      const b = getSkillEffectBundle(id, level)!;
      const needs = Object.values(b.casters).some((c) => showsTarget(c.targetMode));
      expect(b.target !== null, `magic ${id} Lv${level}`).toBe(needs);
    }
  });

  it("v2 時間軸：分身物件的 cloneOf 欄位存在", () => {
    const row = getDb()
      .prepare("SELECT magic_id AS id, level FROM magic_effect_presets WHERE magic_id = 553 AND level = 25 LIMIT 1")
      .get() as { id: number; level: number };
    const { timeline } = casterOf(getSkillEffectBundle(row.id, row.level)!);
    for (const f of timeline.frames) for (const o of f.o) expect(o.length).toBe(13);
  });
});

describe("GET /api/skills/[id]/effect", () => {
  const call = (id: string, query = "") =>
    GET(new Request(`http://x/api/skills/${id}/effect${query}`), { params: Promise.resolve({ id }) });

  it("有演出：200 + 快取標頭", async () => {
    const res = await call(String(MAGIC_ID), "?level=1");
    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toContain("max-age=3600");
    const json = (await res.json()) as SkillEffectBundle;
    expect(json.level).toBe(1);
    expect(Object.values(json.timelines)[0].frames.length).toBeGreaterThan(0);
  });

  it("?level= 取指定等級的演出", async () => {
    const self = (await (await call("553", "?level=25")).json()) as SkillEffectBundle;
    const enemy = (await (await call("553", "?level=35")).json()) as SkillEffectBundle;
    expect(self.casters.m!.timelineKey).toBe("511:self");
    expect(self.target).toBeNull();
    expect(enemy.casters.m!.timelineKey).toBe("320:target");
    expect(enemy.target).not.toBeNull();
  });

  it("沒帶 level 時用最低等級", async () => {
    const res = await call("553");
    expect(res.status).toBe(200);
    const json = (await res.json()) as SkillEffectBundle;
    const lowest = getDb()
      .prepare("SELECT MIN(level) AS level FROM magic_effect_presets WHERE magic_id = 553")
      .get() as { level: number };
    expect(json.level).toBe(lowest.level);
  });

  it("level 不是正整數：400；沒有演出的技能或等級、id 無效：404", async () => {
    for (const bad of ["?level=0", "?level=-3", "?level=abc", "?level=1.5", "?level="]) {
      expect((await call(String(MAGIC_ID), bad)).status, bad).toBe(400);
    }
    expect((await call("999999999", "?level=1")).status).toBe(404);
    expect((await call(String(MAGIC_ID), "?level=9999")).status).toBe(404);
    expect((await call("abc")).status).toBe(404);
  });
});
