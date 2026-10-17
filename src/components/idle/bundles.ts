import { indexSprites, type EffectGender, type EffectSprite, type EffectTimeline, type SkillEffectBundle } from "@/lib/skill-effect";
import { requestImage } from "@/components/skills/skill-effect-canvas";

// 技能演出資料（時間軸、特效圖）以 (技能, 等級) 為 key 快取；沿用 /api/skills/[id]/effect。
interface Entry {
  status: "loading" | "ready" | "failed";
  bundle?: SkillEffectBundle;
  sprites?: Map<string, EffectSprite>;
}

const cache = new Map<string, Entry>();
const EMPTY_SPRITES = new Map<string, EffectSprite>();

const keyOf = (skillId: number, level: number) => `${skillId}:${level}`;

export function prefetchBundle(skillId: number, level: number): void {
  const key = keyOf(skillId, level);
  const existing = cache.get(key);
  if (existing && existing.status !== "failed") return;
  cache.set(key, { status: "loading" });
  fetch(`/api/skills/${skillId}/effect?level=${level}`)
    .then((res) => {
      if (!res.ok) throw new Error(String(res.status));
      return res.json() as Promise<SkillEffectBundle>;
    })
    .then((bundle) => {
      const sprites = indexSprites(bundle.sprites);
      for (const sprite of bundle.sprites) requestImage(sprite.url, () => {});
      cache.set(key, { status: "ready", bundle, sprites });
    })
    .catch(() => {
      cache.set(key, { status: "failed" });
    });
}

/** 施放中要畫的時間軸與特效；還沒載好或沒有演出資料回傳 null（畫面退回待機姿勢）。 */
export function timelineFor(
  skillId: number,
  level: number,
  gender: EffectGender,
): { timeline: EffectTimeline; sprites: Map<string, EffectSprite> } | null {
  const entry = cache.get(keyOf(skillId, level));
  if (!entry) {
    prefetchBundle(skillId, level);
    return null;
  }
  if (entry.status !== "ready" || !entry.bundle) return null;
  const caster = entry.bundle.casters[gender];
  const timeline = caster ? entry.bundle.timelines[caster.timelineKey] : undefined;
  return timeline ? { timeline, sprites: entry.sprites ?? EMPTY_SPRITES } : null;
}
