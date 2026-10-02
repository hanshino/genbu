import { describe, expect, it } from "vitest";
import { getMeridianData } from "../meridian";

describe("getMeridianData（真 DB）", () => {
  const data = getMeridianData();

  it("載入全部 55 穴位、485 級與四脈分布", () => {
    expect(data.points).toHaveLength(55);
    expect(data.points.reduce((sum, point) => sum + point.levels.length, 0)).toBe(485);
    expect(data.channels.map((channel) => [
      channel.name, data.points.filter((point) => point.channelNo === channel.channelNo).length,
    ])).toEqual([["任脈", 15], ["督脈", 16], ["帶脈", 13], ["沖脈", 11]]);
    expect(data.points.map((point) => point.id)).toEqual(
      [...data.points].sort((a, b) => a.channelNo - b.channelNo || a.id - b.id).map((point) => point.id),
    );
    for (const point of data.points) {
      expect(point.levels.map((level) => level.level)).toEqual(
        Array.from({ length: point.maxLevel }, (_, i) => i + 1),
      );
      expect(typeof point.isRoot).toBe("boolean");
      expect(point.levels.every((level) => level.prereqs.every((req) => req.id !== point.id))).toBe(true);
    }
  });

  it("保留承漿任務級 null cost、help 與每級前置和屬性", () => {
    const chengjiang = data.points.find((point) => point.id === 855)!;
    expect(chengjiang.name).toBe("承漿");
    expect(chengjiang.levels[0].cost).toBeNull();
    expect(chengjiang.levels[0].help).toBe("完成經脈通-凌絕頂任務");
    expect(chengjiang.levels[1].help).toContain("消耗經驗值");
    expect(chengjiang.levels[0].stats).toContainEqual({
      stat: "AtribChanlExp", value: 1, flag: "AFFECT_RATIO",
    });
    expect(data.points.find((point) => point.id === 930)!.levels[0].prereqs)
      .toEqual([{ id: 855, level: 1 }]);
    expect(data.points.flatMap((point) => point.levels).reduce((sum, level) => sum + (level.cost ?? 0), 0))
      .toBe(10161);
  });

  it("載入 23 張視窗圖，分頁與剪影使用正確狀態", () => {
    expect(Object.keys(data.images)).toHaveLength(23);
    expect(data.images["1284:normal:0"]).toMatchObject({ iconId: 1284, width: 640, height: 480 });
    expect(data.channels.map((channel) => channel.baseImage.iconId)).toEqual([1290, 1289, 1293, 1294]);
    for (const channel of data.channels) {
      expect(channel.tabImage.state).toBe("disable");
      expect(channel.baseImage.state).toBe("normal");
      expect(channel.tabImage.url).toBeTruthy();
      expect(channel.baseImage.url).toBeTruthy();
    }
  });

  it("唯讀資料在 module 層 memo", () => {
    expect(getMeridianData()).toBe(data);
  });
});
