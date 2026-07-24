import { describe, it, expect } from "vitest";
import { getStageMapImage, getNpcPlacementsForStage } from "../maps";

// 真實 id（存在於 tthol.sqlite）
const STAGE_WITH_IMAGE = 2; // 莫愁谷村莊：有圖 + 多 NPC
const STAGE_NO_IMAGE = 1; // 莫愁谷入口：在 stages 但無 map_images
const STAGE_IMG_NO_NPC = 42; // 凌霄閣：有圖但無 NPC placement

describe("maps.ts 查詢", () => {
  it("getStageMapImage 回傳有圖 stage 的尺寸與格數", () => {
    const img = getStageMapImage("stage", STAGE_WITH_IMAGE);
    expect(img).not.toBeNull();
    expect(img!.imgWidth).toBe(4880);
    expect(img!.imgHeight).toBe(6480);
    expect(img!.tilesW).toBe(122);
    expect(img!.tilesH).toBe(162);
    expect(img!.tilePx).toBe(40);
    expect(img!.url.length).toBeGreaterThan(0);
  });

  it("getStageMapImage 無圖 stage 回 null", () => {
    expect(getStageMapImage("stage", STAGE_NO_IMAGE)).toBeNull();
  });

  it("getNpcPlacementsForStage 回傳 NPC 座標、名字與頭像", () => {
    const list = getNpcPlacementsForStage("stage", STAGE_WITH_IMAGE);
    expect(list.length).toBe(79);
    for (const p of list) {
      expect(p.npcId).toBeGreaterThan(0);
      expect(typeof p.tileX).toBe("number");
      expect(typeof p.tileY).toBe("number");
    }
    expect(list.some((p) => p.name && p.name.length > 0)).toBe(true);
    expect(list.some((p) => p.image !== null)).toBe(true);
  });

  it("getNpcPlacementsForStage 有圖但無 NPC 的 stage 回空陣列", () => {
    expect(getNpcPlacementsForStage("stage", STAGE_IMG_NO_NPC)).toEqual([]);
  });
});
