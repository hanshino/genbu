import { describe, it, expect } from "vitest";
import { getDb } from "@/lib/db";
import { getSkillEffectAvailability, getSkillEffectBundle } from "../skill-effect";
import { GET } from "@/app/api/skills/[id]/effect/route";
import { spriteKey } from "@/lib/skill-effect";

const MAGIC_ID = 4; // 怒擊：cast_effect 508，男 preset 100、女 preset 101

function presetMagicIds(): number[] {
  return (
    getDb().prepare("SELECT DISTINCT magic_id AS id FROM magic_effect_presets").all() as { id: number }[]
  ).map((r) => r.id);
}

describe("skill-effect query", () => {
  it("availability：有時間軸且有施法者外觀的技能", () => {
    const a = getSkillEffectAvailability(MAGIC_ID);
    expect(a).not.toBeNull();
    expect([...a!.genders].sort()).toEqual(["f", "m"]);
    expect(a!.presetLabels.m).toBeTruthy();
    expect(a!.presetLabels.f).toBeTruthy();
  });

  it("availability：沒有演出的技能或無效 id 回 null", () => {
    expect(getSkillEffectAvailability(-1)).toBeNull();
    expect(getSkillEffectAvailability(0)).toBeNull();
    expect(getSkillEffectAvailability(999999999)).toBeNull();
    expect(getSkillEffectBundle(999999999)).toBeNull();
  });

  it("availability 與 bundle 一致：有 availability 就組得出 bundle", () => {
    for (const id of presetMagicIds()) {
      if (getSkillEffectAvailability(id)) expect(getSkillEffectBundle(id), `magic ${id}`).not.toBeNull();
    }
  });

  it("bundle：時間軸、施法者與目標素材齊全", () => {
    const b = getSkillEffectBundle(MAGIC_ID)!;
    expect(b.tickMs).toBeGreaterThan(0);
    expect(b.frames.length).toBeGreaterThan(0);
    expect(b.ticks).toBeGreaterThan(0);
    for (const g of ["m", "f"] as const) {
      const c = b.casters[g]!;
      expect(c.label).toBeTruthy();
      expect(Object.keys(c.strips)).toContain("prepare");
      for (const s of Object.values(c.strips)) {
        expect(s.delays.every((n) => Number.isInteger(n))).toBe(true);
        expect(s.delays.length).toBe(s.frames);
      }
    }
    expect(b.target.npcId).toBe(8346);
    expect(b.target.name).toBe("咆嘯雪狼");
    expect(Object.keys(b.target.strips).sort()).toEqual(["death", "hurt", "wait"]);
  });

  it("bundle：只帶時間軸用得到的特效素材，缺圖的組合極少", () => {
    const missing = new Set<string>();
    for (const id of presetMagicIds()) {
      const b = getSkillEffectBundle(id);
      if (!b) continue;
      const used = new Set<string>();
      for (const f of b.frames) {
        for (const o of f.o) if (o[1] != null) used.add(spriteKey(o[1], String(o[2])));
      }
      const have = new Set(b.sprites.map((s) => spriteKey(s.seq, s.state)));
      for (const key of have) expect(used.has(key), `magic ${id} ${key}`).toBe(true);
      for (const key of used) if (!have.has(key)) missing.add(key);
    }
    console.info("missing (seq:state):", [...missing].sort());
    // 已知 6 組 (seq, state) 沒有素材，播放時靜默略過。
    expect(missing.size).toBeLessThanOrEqual(6);
  });

  it("bundle：怒擊有命中事件與特效", () => {
    const b = getSkillEffectBundle(MAGIC_ID)!;
    expect(b.frames.some((f) => f.e?.some((e) => e.type === "hit"))).toBe(true);
    expect(b.sprites.length).toBeGreaterThan(0);
    expect(["add", "sub", "alpha", "normal"]).toContain(b.sprites[0].blend);
  });
});

describe("GET /api/skills/[id]/effect", () => {
  const call = (id: string) => GET(new Request("http://x"), { params: Promise.resolve({ id }) });

  it("有演出：200 + 快取標頭", async () => {
    const res = await call(String(MAGIC_ID));
    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toContain("max-age=3600");
    const json = await res.json();
    expect(json.frames.length).toBeGreaterThan(0);
  });

  it("沒有演出或 id 無效：404", async () => {
    expect((await call("999999999")).status).toBe(404);
    expect((await call("abc")).status).toBe(404);
  });
});
