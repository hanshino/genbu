import { describe, expect, it } from "vitest";
import { getPortalExits, getStageMapImage } from "../maps";

describe("getPortalExits — 真實 tthol.sqlite", () => {
  it("stage 1 有三個出口，各自保留目的地與全部落點", () => {
    const exits = getPortalExits("stage", 1);
    expect(exits).toHaveLength(3);
    expect(exits.map((exit) => exit.eventTag)).toEqual([256, 257, 258]);

    for (const [eventTag, id, name, landings] of [
      [256, 2, "莫愁谷村莊", 2],
      [257, 3, "崑崙草原", 3],
      [258, 44, "莫愁谷市集", 3],
    ] as const) {
      const exit = exits.find((exit) => exit.eventTag === eventTag)!;
      expect(exit.part).toBe(1);
      expect(exit.parts).toBe(1);
      expect(exit.cells.length).toBeGreaterThan(0);
      expect(exit.center).toEqual([
        exit.cells.reduce((sum, p) => sum + p[0], 0) / exit.cells.length,
        exit.cells.reduce((sum, p) => sum + p[1], 0) / exit.cells.length,
      ]);
      expect(exit.options).toHaveLength(1);
      expect(exit.options[0].dest).toEqual({
        id,
        kind: "stage",
        name,
        image: getStageMapImage("stage", id),
      });
      expect(exit.options[0].landings).toHaveLength(landings);
    }
    expect(getPortalExits("stage", 1)).toEqual(exits);
    expect(JSON.parse(JSON.stringify(exits))).toEqual(exits);
  });

  it("sestage 1827 的 tag256 拆成兩區，共用對話選項與提示", () => {
    const exits = getPortalExits("sestage", 1827);
    const zones = exits.filter((exit) => exit.eventTag === 256);
    expect(zones).toHaveLength(2);
    expect(new Set(zones.map((exit) => exit.key)).size).toBe(2);
    expect(zones.map((exit) => exit.part)).toEqual([1, 2]);
    expect(zones.every((exit) => exit.parts === 2 && exit.cells.length > 0)).toBe(true);
    expect(zones[0].options).toBe(zones[1].options);
    expect(zones.map((exit) => exit.prompt)).toEqual([
      "要回到流星村火島何處呢？",
      "要回到流星村火島何處呢？",
    ]);

    const options = zones[0].options;
    expect(options).toHaveLength(2);
    const village = options.find((option) => option.label === "回到流星冰島˙南")!;
    expect(village).toBeDefined();
    expect(village.dest).toMatchObject({ id: 57, kind: "stage", name: "流星村" });
    expect(village.landings).toHaveLength(3);
    const valley = options.find((option) => option.label === "前往莫愁谷")!;
    expect(valley).toBeDefined();
    expect(valley.dest).toMatchObject({ id: 1, kind: "stage" });
    expect(valley.landings).toEqual([]);
    expect(getPortalExits("sestage", 1827)).toEqual(exits);
  });

  it("不存在的地圖回傳空陣列", () => {
    expect(getPortalExits("stage", 999999)).toEqual([]);
  });
});
