import { describe, expect, it } from "vitest";
import { getTrainingSpots } from "../monster-spawns";
import { classifyTrainingStage } from "../training-classify";
import { getTrainingDropData } from "../training-drops";
import { getDropsForMonster } from "../monsters";
import { getSkillHitInfoBatch } from "../magic";
import { SKILL_PICKS } from "@/lib/constants/skill-picks";
import {
  aggregateSpotDrops,
  dropCategory,
  mergeTrainingVariants,
  sortTrainingSpots,
  spotHit,
} from "@/lib/training-spots";
import type { StageKind } from "@/lib/types/stage";

// 真實資料（tthol.sqlite，read-only）。
const stage = (stageId: number, stageName: string, stageKind: StageKind = "stage") => ({
  stageKind,
  stageId,
  stageName,
});

function spotsWithCategory(level: number) {
  return getTrainingSpots(level).map((s) => ({ ...s, category: classifyTrainingStage(s) }));
}

describe("classifyTrainingStage", () => {
  it("城鎮走得到的地圖是野外", () => {
    expect(classifyTrainingStage(stage(3, "崑崙草原"))).toBe("field");
  });

  it("只能靠 NPC 傳送的地圖是 npc-only", () => {
    expect(classifyTrainingStage(stage(322, "少陰八卦陣"))).toBe("npc-only");
  });

  it("名稱規則：寵物練功場、劇情用地圖", () => {
    expect(classifyTrainingStage(stage(79, "成都寵物練功場"))).toBe("pet");
    // 311 號有走路傳送接進去，靠名稱規則排除。
    expect(classifyTrainingStage(stage(311, "劇情用地圖"))).toBe("story");
  });

  it("手動覆寫：名劍塔、木人巷、凌霄閣排除、雷島月岸算野外", () => {
    expect(classifyTrainingStage(stage(801, "名劍塔"))).toBe("excluded");
    expect(classifyTrainingStage(stage(307, "木人巷"))).toBe("excluded");
    expect(classifyTrainingStage(stage(42, "凌霄閣"))).toBe("excluded");
    expect(classifyTrainingStage(stage(112, "雷島˙南月岸"))).toBe("field");
  });

  it("SESTAGE 一律是特殊地圖", () => {
    expect(classifyTrainingStage(stage(1701, "月迷境", "sestage"))).toBe("se");
  });
});

describe("菁英判斷", () => {
  it("Lv80 玄冰頂只因一隻菁英入選 → onlyElite", () => {
    const spot = getTrainingSpots(80).find((s) => s.stageId === 43)!;
    expect(spot.onlyElite).toBe(true);
    expect(spot.suitableMonsters.every((m) => m.elite)).toBe(true);
  });

  it("Lv80 秘密花園的拳擊袋鼠只是刷怪點少，不是菁英；窗口外的鍊錘蜂后才是", () => {
    const spot = getTrainingSpots(80).find((s) => s.stageId === 306)!;
    expect(spot.onlyElite).toBe(false);
    expect(spot.suitableMonsters.find((m) => m.npcId === 8096)?.elite).toBe(false);
    expect(spot.otherElites.map((m) => m.npcId)).toEqual(expect.arrayContaining([8112, 8113]));
  });

  it("Lv80 極之淵：窗口內的影修羅是菁英，但地圖不是 onlyElite", () => {
    const spot = getTrainingSpots(80).find((s) => s.stageId === 208)!;
    expect(spot.onlyElite).toBe(false);
    expect(spot.suitableMonsters.find((m) => m.npcId === 5970)?.elite).toBe(true);
  });
});

describe("分流合併", () => {
  it("Lv30 冰霜雲徑與冰霜雲徑[二]、[三] 合成一張，主卡是本體", () => {
    const merged = mergeTrainingVariants(spotsWithCategory(30));
    const card = merged.find((s) => s.stageId === 247)!;
    expect(card.category).toBe("field");
    expect(card.variants.map((v) => v.stageId).sort()).toEqual([298, 299]);
    expect(merged.some((s) => s.stageId === 298 || s.stageId === 299)).toBe(false);
  });

  it("同名但怪物不同的地圖不合併", () => {
    const merged = mergeTrainingVariants(spotsWithCategory(80));
    // 木人巷 307（Lv68–80）與 308（Lv80–85）
    expect(merged.filter((s) => s.stageName === "木人巷").length).toBe(2);
  });
});

describe("掉落與命中", () => {
  it("掉率分母含空槽，與怪物頁掉落表一致", () => {
    const npcId = 8101; // 花豹
    const data = getTrainingDropData([npcId]);
    const table = getDropsForMonster(npcId);
    const rateByItem = new Map<number, number>();
    for (const d of table.drops) {
      if (d.rate > 0) rateByItem.set(d.itemId, (rateByItem.get(d.itemId) ?? 0) + d.rate);
    }
    const mine = data.byNpc.get(npcId)!;
    expect(mine.length).toBe(rateByItem.size);
    for (const x of mine) {
      expect(x.percent).toBeCloseTo((rateByItem.get(x.itemId)! / table.totalWeight) * 100, 10);
    }
  });

  it("同一物品取掉率最高的怪", () => {
    const spot = getTrainingSpots(80).find((s) => s.stageId === 306)!;
    const data = getTrainingDropData(spot.suitableMonsters.map((m) => m.npcId));
    const drops = aggregateSpotDrops(spot.suitableMonsters, data);
    for (const d of drops) {
      const max = Math.max(
        ...spot.suitableMonsters.flatMap((m) =>
          (data.byNpc.get(m.npcId) ?? []).filter((x) => x.itemId === d.itemId).map((x) => x.percent),
        ),
      );
      expect(d.percent).toBe(max);
    }
  });

  it("dropCategory 分組", () => {
    expect(dropCategory("SWORD", 0.02)).toBe("equip");
    expect(dropCategory("ITEM_PET", 0.25)).toBe("pet");
    expect(dropCategory("SCARCE_ITEM", 0.1)).toBe("stone");
    expect(dropCategory("POTION", 8)).toBe("potion");
    expect(dropCategory("NORMAL_ITEM", 20)).toBe("material");
    expect(dropCategory("NORMAL_ITEM", 0.25)).toBe("rare");
  });

  it("需撐命中只看一般怪，菁英另列", () => {
    const spot = getTrainingSpots(80).find((s) => s.stageId === 208)!; // 極之淵
    const hit = spotHit(spot, getSkillHitInfoBatch(SKILL_PICKS["刀法"]));
    expect(hit.main?.monster.elite).toBe(false);
    expect(hit.elites.map((r) => r.monster.npcId)).toEqual([5970]);
    // 刀法 p1 80–100：最好中的招需 = 閃躲，最難中的需 = ceil(閃躲 × 100 / 80)
    expect(hit.main!.min).toBe(hit.main!.dodge);
    expect(hit.main!.max).toBe(Math.ceil((hit.main!.dodge * 100) / 80));
  });

  it("只有菁英符合的地圖排最後", () => {
    const field = mergeTrainingVariants(spotsWithCategory(80)).filter((s) => s.category === "field");
    const sorted = sortTrainingSpots(field, "spawns", { hitMin: () => null, equipCount: () => 0 });
    const firstElite = sorted.findIndex((s) => s.onlyElite);
    expect(firstElite).toBeGreaterThan(0);
    expect(sorted.slice(firstElite).every((s) => s.onlyElite)).toBe(true);
  });
});
