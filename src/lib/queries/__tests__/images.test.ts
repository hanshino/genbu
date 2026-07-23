import { describe, it, expect } from "vitest";
import {
  getItemIconMap,
  getItemIcon,
  getNpcImageMap,
  getNpcImage,
} from "../images";

// 真實 id（存在於 tthol.sqlite）
const ITEM_WITH_ICON = 20001; // item_images kind='icon' 有此列
const NPC_WITH_IMAGE = 5011; // npc_images 有此列（同時是 monster）

describe("images.ts 解析器", () => {
  it("空陣列不打 DB、回傳空 Map", () => {
    expect(getItemIconMap([]).size).toBe(0);
    expect(getNpcImageMap([]).size).toBe(0);
  });

  it("getItemIcon 回傳單一道具 icon", () => {
    const img = getItemIcon(ITEM_WITH_ICON);
    expect(img).not.toBeNull();
    expect(typeof img!.url).toBe("string");
    expect(img!.url.length).toBeGreaterThan(0);
  });

  it("getItemIconMap 以 item_id 為 key 對應", () => {
    const map = getItemIconMap([ITEM_WITH_ICON, 999999999]);
    expect(map.get(ITEM_WITH_ICON)?.url).toBe(getItemIcon(ITEM_WITH_ICON)!.url);
    expect(map.has(999999999)).toBe(false); // 不存在的 id 不入 Map
  });

  it("getItemIconMap 去重且支援超過分塊大小的輸入", () => {
    const many = Array.from({ length: 950 }, (_, i) => ITEM_WITH_ICON); // 全同 → 去重成 1
    const map = getItemIconMap(many);
    expect(map.get(ITEM_WITH_ICON)).toBeDefined();
  });

  it("getNpcImage / getNpcImageMap 對應 npc_id", () => {
    const img = getNpcImage(NPC_WITH_IMAGE);
    expect(img).not.toBeNull();
    const map = getNpcImageMap([NPC_WITH_IMAGE]);
    expect(map.get(NPC_WITH_IMAGE)?.url).toBe(img!.url);
  });
});
