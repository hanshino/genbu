import { describe, expect, it } from "vitest";
import { getDb } from "@/lib/db";
import { getAllStageGroupStats, getStageDetail } from "@/lib/queries/stages";
import { isPlaceholderStageName } from "@/lib/placeholder-data";

describe("isPlaceholderStageName", () => {
  it.each(["TEST", "55555", "活動用地圖", "劇情用地圖", "劇情", "劇情保留", "四象測試", "凌霄天梯背景"])(
    "%s 是佔位地圖",
    (name) => expect(isPlaceholderStageName(name)).toBe(true),
  );

  it.each(["洛陽外城", "劇情洞窟", "名劍塔", "長篇活動地圖", "莫愁谷牧場1"])("%s 不是", (name) =>
    expect(isPlaceholderStageName(name)).toBe(false),
  );
});

describe("getStageDetail 同區域地圖", () => {
  it("略過佔位地圖，同名只留一張，不含與自己同名的", () => {
    const { id } = getDb()
      .prepare("SELECT id FROM stages WHERE [group] = 1 AND name IS NOT NULL ORDER BY id LIMIT 1")
      .get() as { id: number };
    const stage = getStageDetail(id)!;
    const names = stage.groupSiblings.map((s) => s.name);
    expect(names.length).toBeGreaterThan(0);
    expect(new Set(names).size).toBe(names.length);
    expect(names).not.toContain(stage.name);
    for (const n of names) expect(isPlaceholderStageName(n)).toBe(false);
  });
});

describe("getAllStageGroupStats", () => {
  it("預覽名稱不重複、不含佔位地圖", () => {
    for (const g of getAllStageGroupStats()) {
      const parts = g.preview.replace(/…$/, "").split("、");
      expect(new Set(parts).size).toBe(parts.length);
      if (parts.some((p) => !isPlaceholderStageName(p))) {
        for (const p of parts) expect(isPlaceholderStageName(p)).toBe(false);
      }
    }
  });
});
