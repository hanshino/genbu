import { describe, expect, it } from "vitest";
import { getDungeonMonsterIds, monsterIdsInSource } from "@/lib/dungeon-monsters";

describe("monsterIdsInSource", () => {
  it("抓 Monster 標籤、groups 的 ids 與 marks 的 id，去重", () => {
    const src = `<Monster id={11321}>寒獄蟻獅</Monster>
<DungeonStep groups={[{ids:[11321],as:"pin"},{ids:[11322, 11323],as:"pin"}]} marks={[{id:11337,as:"device"}]}>`;
    expect(monsterIdsInSource(src).sort()).toEqual([11321, 11322, 11323, 11337]);
  });
});

describe("getDungeonMonsterIds", () => {
  it("每篇迷宮攻略都抓得到怪", () => {
    const all = getDungeonMonsterIds();
    expect(all.length).toBeGreaterThan(0);
    for (const { guide, ids } of all) expect(ids.length, guide.slug).toBeGreaterThan(0);
  });
});
