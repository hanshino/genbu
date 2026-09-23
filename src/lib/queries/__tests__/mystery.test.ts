import { describe, expect, it } from "vitest";
import { getMysteryBoxInfo, getMysteryContents, getMysterySources } from "../mystery";
import { formatDrop, formatProb } from "@/components/items/mystery-sections";
import type { MysteryBoxContents } from "@/lib/types/mystery";

const byName = (c: MysteryBoxContents, name: string) => c.entries.find((e) => e.itemName === name);

describe("隨機寶箱內容", () => {
  it("31014 雲夢湖底寶箱（表 901）：10 項、每次 1 樣，依機率排序", () => {
    const c = getMysteryContents(31014)!;
    expect(c.info.mysteryId).toBe(901);
    expect(c.entries).toHaveLength(10);
    expect(formatDrop(c.info)).toBe("每次開出 1 樣");
    expect(byName(c, "大活絡藥")).toMatchObject({ qty: 20, prob: 0.21 });
    expect(byName(c, "不起眼的蛋")?.prob).toBeCloseTo(0.03);
    const probs = c.entries.map((e) => e.prob);
    expect(probs).toEqual([...probs].sort((a, b) => b - a));
  });

  it("24983 隨機青冥劍鞘：一品 50%、二品 46.9%、三品 3%、極品 0.1%", () => {
    const c = getMysteryContents(24983)!;
    const shown = Object.fromEntries(c.entries.map((e) => [e.itemName, formatProb(e.prob)]));
    expect(shown).toEqual({
      一品青冥劍鞘: "50%",
      二品青冥劍鞘: "46.9%",
      三品青冥劍鞘: "3%",
      極品青冥劍鞘: "0.1%",
    });
  });

  it("32403 北斗七星靈盤：113 項", () => {
    expect(getMysteryContents(32403)!.entries).toHaveLength(113);
  });

  it("24066 好運刮刮樂：每次開出 2–4 樣", () => {
    const info = getMysteryBoxInfo(24066)!;
    expect([info.minDrop, info.maxDrop]).toEqual([2, 4]);
    expect(formatDrop(info)).toBe("每次開出 2–4 樣");
  });

  it("24979 轉運金幣彩卷：24980 出現多次、數量各不相同，以 seq 區分不合併", () => {
    const rows = getMysteryContents(24979)!.entries.filter((e) => e.refId === 24980);
    expect(rows.length).toBeGreaterThan(1);
    expect(new Set(rows.map((r) => r.qty)).size).toBe(rows.length);
    expect(new Set(rows.map((r) => r.seq)).size).toBe(rows.length);
  });

  it("24059 紅包：巢狀展開會終止，且不重複展開祖先寶箱表", () => {
    const walk = (c: MysteryBoxContents, seen: number[]): number => {
      expect(seen).not.toContain(c.info.mysteryId);
      const path = [...seen, c.info.mysteryId as number];
      return 1 + c.entries.reduce((n, e) => n + (e.contents ? walk(e.contents, path) : 0), 0);
    };
    const c = getMysteryContents(24059)!;
    expect(walk(c, [])).toBeLessThanOrEqual(3);
    expect(c.entries[0].contents).not.toBeNull(); // 24059 → 27157 紅包 → 表 4
  });

  it("32862、34394：has_data = 0，沒有內容", () => {
    for (const id of [32862, 34394]) {
      const c = getMysteryContents(id)!;
      expect(c.info.hasData).toBe(false);
      expect(c.entries).toEqual([]);
    }
  });

  it("不是隨機寶箱的道具回傳 null", () => {
    expect(getMysteryContents(24004)).toBeNull();
  });

  it("極小機率保留足夠小數位", () => {
    expect(formatProb(0.0001)).toBe("0.01%");
    expect(formatProb(0.00001)).toBe("0.001%");
    expect(formatProb(0.08805)).toBe("8.81%");
  });
});

describe("可從這些寶箱開出", () => {
  it("大活絡藥 24004：31014 會開出 ×20、21%，依機率排序", () => {
    const rows = getMysterySources(24004);
    expect(rows).toContainEqual(expect.objectContaining({ boxItemId: 31014, qty: 20, prob: 0.21 }));
    const probs = rows.map((r) => r.prob);
    expect(probs).toEqual([...probs].sort((a, b) => b - a));
  });

  it("24980：24979 的每個 seq 都回傳，不只一筆", () => {
    const rows = getMysterySources(24980).filter((r) => r.boxItemId === 24979);
    expect(rows.length).toBe(11);
  });

  it("一張表被多個寶箱道具共用時，每個寶箱都列出", () => {
    const rows = getMysterySources(24004);
    const byTable = new Map<number, Set<number>>();
    for (const r of rows) byTable.set(r.mysteryId, (byTable.get(r.mysteryId) ?? new Set()).add(r.boxItemId));
    expect([...byTable.values()].some((s) => s.size > 1)).toBe(true);
  });
});
