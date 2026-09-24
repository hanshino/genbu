import { describe, it, expect, vi, afterEach } from "vitest";
import Database from "better-sqlite3";
import * as dbModule from "@/lib/db";
import {
  getStageMapImage,
  getNpcPlacementsForStage,
  getMonsterSpawnPositions,
  buildMonsterMarkers,
  type StageMapImage,
} from "../maps";
import type { StageMonsterSpawn } from "@/lib/types/monster-spawn";

// 真實 id（存在於 tthol.sqlite）
const STAGE_WITH_IMAGE = 2; // 莫愁谷村莊：有圖 + 多 NPC
// 資料庫已更新過，stage 1（原本假設無圖）目前**已有** map_images 列；
// 改用獨立驗證過、目前仍確定無圖的 stage 220（洛陽外城）當 fixture，
// 不弱化「無圖回 null」這條 contract。
const STAGE_NO_IMAGE = 220; // 洛陽外城：在 stages 但無 map_images（已核對現況）
const STAGE_IMG_NO_NPC = 42; // 凌霄閣：有圖但無 NPC placement
const STAGE_UNKNOWN = 999999; // 不存在的 stage id

// stage208：全 38 筆 monster_spawns 已逐筆比對 map_placements(category='spawn')，
// record_idx/npc_id/raw_x/raw_y 全數一致（見 PR 說明），可放心當座標 oracle。
const STAGE208 = { kind: "stage" as const, id: 208 };
// ●影修羅：hp 1,182,004，其餘三種 hp 落在 9,262–10,594 區間，中位數比值 ≈ 120，
// 是本 stage 唯一應標記 highHp 的物種。
const HIGH_HP_NPC = 5970;

afterEach(() => {
  vi.restoreAllMocks();
});

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

  it("getNpcPlacementsForStage 回傳 NPC 合成圖像素座標、名字與頭像", () => {
    const list = getNpcPlacementsForStage("stage", STAGE_WITH_IMAGE);
    expect(list.length).toBe(79);
    for (const p of list) {
      expect(p.npcId).toBeGreaterThan(0);
      // raw_x/raw_y 為合成圖像素座標（stage 2 圖為 4880×6480），在圖片範圍內。
      expect(p.rawX).toBeGreaterThanOrEqual(0);
      expect(p.rawX).toBeLessThanOrEqual(4880);
      expect(p.rawY).toBeGreaterThanOrEqual(0);
      expect(p.rawY).toBeLessThanOrEqual(6480);
    }
    expect(list.some((p) => p.name && p.name.length > 0)).toBe(true);
    expect(list.some((p) => p.image !== null)).toBe(true);
  });

  it("getNpcPlacementsForStage 有圖但無 NPC 的 stage 回空陣列", () => {
    expect(getNpcPlacementsForStage("stage", STAGE_IMG_NO_NPC)).toEqual([]);
  });
});

describe("getMonsterSpawnPositions", () => {
  it("stage208 回傳全部 38 筆，依 id 遞增為決定性順序", () => {
    const positions = getMonsterSpawnPositions(STAGE208.kind, STAGE208.id);
    expect(positions.length).toBe(38);
    for (const p of positions) {
      expect(typeof p.npcId).toBe("number");
      expect(typeof p.x).toBe("number");
      expect(typeof p.y).toBe("number");
    }
    // 同輸入重複呼叫得到相同順序（deterministic）。
    expect(getMonsterSpawnPositions(STAGE208.kind, STAGE208.id)).toEqual(positions);
  });

  it("●影修羅 (5970) 座標為 (1840, 2680)，與 map_placements raw_x/raw_y 一致", () => {
    const positions = getMonsterSpawnPositions(STAGE208.kind, STAGE208.id);
    const own = positions.filter((p) => p.npcId === HIGH_HP_NPC);
    expect(own).toEqual([{ npcId: HIGH_HP_NPC, x: 1840, y: 2680 }]);
  });

  it("不存在的 stage 回空陣列", () => {
    expect(getMonsterSpawnPositions("stage", STAGE_UNKNOWN)).toEqual([]);
  });
});

describe("buildMonsterMarkers — 真實 stage208 資料", () => {
  it("38 筆座標中只有 ●影修羅 (5970) 被標記 highHp，比例 ≈120", () => {
    const monsters: StageMonsterSpawn[] = [
      { npcId: 5969, name: "●餓鬼", level: 76, hp: 9829, spawnPoints: 12 },
      { npcId: 5971, name: "●羅剎", level: 79, hp: 10594, spawnPoints: 13 },
      { npcId: 5972, name: "▲千年狐妖", level: 80, hp: 9262, spawnPoints: 12 },
      { npcId: 5970, name: "●影修羅", level: 81, hp: 1182004, spawnPoints: 1 },
    ];
    const positions = getMonsterSpawnPositions(STAGE208.kind, STAGE208.id);
    const image: StageMapImage = {
      url: "https://img.hanshino.dev/gc5kej.webp",
      imgWidth: 2520,
      imgHeight: 4400,
      tilesW: 63,
      tilesH: 110,
      tilePx: 40,
    };

    const markers = buildMonsterMarkers(monsters, positions, image);
    expect(markers.length).toBe(4);

    const highHpMarkers = markers.filter((m) => m.highHp);
    expect(highHpMarkers.map((m) => m.npcId)).toEqual([HIGH_HP_NPC]);

    const boss = markers.find((m) => m.npcId === HIGH_HP_NPC)!;
    // 其他三種 hp 排序後 [9262, 9829, 10594]，中位數 9829；1182004/9829 ≈ 120.26。
    expect(boss.hpRatio).toBeCloseTo(1182004 / 9829, 5);
    expect(boss.hpRatio).toBeGreaterThanOrEqual(10);

    // 座標換算：left = x/imgWidth*100, top = y/imgHeight*100（doc §座標換算）。
    expect(boss.points).toEqual([{ left: (1840 / 2520) * 100, top: (2680 / 4400) * 100 }]);

    // 保留原有清單順序、涵蓋全部物種（含無 highHp 的）。
    expect(markers.map((m) => m.npcId)).toEqual(monsters.map((m) => m.npcId));
  });

  it("每個物種的 points 只包含屬於自己 npcId 的座標，且數量與 spawn 筆數相符", () => {
    const monsters: StageMonsterSpawn[] = [
      { npcId: 5969, name: "●餓鬼", level: 76, hp: 9829, spawnPoints: 12 },
      { npcId: 5971, name: "●羅剎", level: 79, hp: 10594, spawnPoints: 13 },
      { npcId: 5972, name: "▲千年狐妖", level: 80, hp: 9262, spawnPoints: 12 },
      { npcId: 5970, name: "●影修羅", level: 81, hp: 1182004, spawnPoints: 1 },
    ];
    const positions = getMonsterSpawnPositions(STAGE208.kind, STAGE208.id);
    const image: StageMapImage = {
      url: "https://img.hanshino.dev/gc5kej.webp",
      imgWidth: 2520,
      imgHeight: 4400,
      tilesW: 63,
      tilesH: 110,
      tilePx: 40,
    };
    const markers = buildMonsterMarkers(monsters, positions, image);
    // stage208 全 38 筆座標各自唯一（無重複 (x,y)），去重不影響筆數。
    for (const m of markers) {
      const expected = m.spawnPoints;
      expect(m.points.length).toBe(expected);
    }
    const totalPoints = markers.reduce((s, m) => s + m.points.length, 0);
    expect(totalPoints).toBe(38);
  });
});

describe("buildMonsterMarkers — fixtures", () => {
  const baseImage: StageMapImage = {
    url: "https://img.hanshino.dev/x.webp",
    imgWidth: 100,
    imgHeight: 200,
    tilesW: 3,
    tilesH: 5,
    tilePx: 40,
  };

  function monster(overrides: Partial<StageMonsterSpawn>): StageMonsterSpawn {
    return {
      npcId: 1,
      name: "怪",
      level: 1,
      hp: 100,
      spawnPoints: 1,
      ...overrides,
    };
  }

  it("image=null 時 points 一律 []，但 highHp/hpRatio 判斷不受影響", () => {
    const monsters = [
      monster({ npcId: 1, hp: 100 }),
      monster({ npcId: 2, hp: 100 }),
      monster({ npcId: 3, hp: 2000 }),
    ];
    const positions = [{ npcId: 3, x: 10, y: 10 }];
    const markers = buildMonsterMarkers(monsters, positions, null);
    expect(markers.every((m) => m.points.length === 0)).toBe(true);
    const boss = markers.find((m) => m.npcId === 3)!;
    expect(boss.hpRatio).toBe(20); // 2000 / median([100,100]) = 2000/100
    expect(boss.highHp).toBe(true);
  });

  it("圖片尺寸不合法（0/負數/非 finite）時 points 一律 []", () => {
    const monsters = [monster({ npcId: 1 })];
    const positions = [{ npcId: 1, x: 10, y: 10 }];
    for (const bad of [
      { ...baseImage, imgWidth: 0 },
      { ...baseImage, imgWidth: -10 },
      { ...baseImage, imgHeight: Number.NaN },
      { ...baseImage, imgHeight: Number.POSITIVE_INFINITY },
    ]) {
      expect(buildMonsterMarkers(monsters, positions, bad)[0].points).toEqual([]);
    }
  });

  it("座標 null / 非 finite 被排除，不進 points", () => {
    const monsters = [monster({ npcId: 1 })];
    const positions = [
      { npcId: 1, x: null, y: 50 },
      { npcId: 1, x: 50, y: null },
      { npcId: 1, x: Number.NaN, y: 50 },
      { npcId: 1, x: 50, y: Number.POSITIVE_INFINITY },
      { npcId: 1, x: 50, y: 50 }, // 唯一合法
    ];
    expect(buildMonsterMarkers(monsters, positions, baseImage)[0].points).toEqual([
      { left: 50, top: 25 },
    ]);
  });

  it("座標超出邊界（負值、x>=width、y>=height）被排除", () => {
    const monsters = [monster({ npcId: 1 })];
    const positions = [
      { npcId: 1, x: -1, y: 10 },
      { npcId: 1, x: 10, y: -1 },
      { npcId: 1, x: 100, y: 10 }, // x >= width(100)
      { npcId: 1, x: 10, y: 200 }, // y >= height(200)
      { npcId: 1, x: 99, y: 199 }, // 邊界內剛好合法
    ];
    expect(buildMonsterMarkers(monsters, positions, baseImage)[0].points).toEqual([
      { left: 99, top: 99.5 },
    ]);
  });

  it("座標剛好等於 width/height（10x10 邊界情境）被排除，非法邊界即拒絕", () => {
    const image: StageMapImage = { ...baseImage, imgWidth: 10, imgHeight: 10 };
    const monsters = [monster({ npcId: 1 })];
    const positions = [
      { npcId: 1, x: 10, y: 5 }, // x === width → 拒絕
      { npcId: 1, x: 5, y: 10 }, // y === height → 拒絕
      { npcId: 1, x: 9, y: 9 }, // 剛好在界內 → 接受
    ];
    expect(buildMonsterMarkers(monsters, positions, image)[0].points).toEqual([
      { left: 90, top: 90 },
    ]);
  });

  it("排除未知 npcId：positions 裡有清單以外的 npcId 不會混進任何物種的 points", () => {
    const monsters = [monster({ npcId: 1 }), monster({ npcId: 2 })];
    const positions = [
      { npcId: 1, x: 10, y: 10 },
      { npcId: 999, x: 20, y: 20 }, // 清單中不存在的 npcId
    ];
    const markers = buildMonsterMarkers(monsters, positions, baseImage);
    expect(markers.find((m) => m.npcId === 1)!.points).toEqual([{ left: 10, top: 5 }]);
    expect(markers.find((m) => m.npcId === 2)!.points).toEqual([]);
  });

  it("同一物種完全重複的座標點去重，spawnPoints 原始計數不受影響", () => {
    const monsters = [monster({ npcId: 1, spawnPoints: 3 })];
    const positions = [
      { npcId: 1, x: 10, y: 10 },
      { npcId: 1, x: 10, y: 10 }, // 完全重複
      { npcId: 1, x: 20, y: 20 },
    ];
    const marker = buildMonsterMarkers(monsters, positions, baseImage)[0];
    expect(marker.points.length).toBe(2); // 去重後只剩 2 個相異點
    expect(marker.spawnPoints).toBe(3); // 原始 spawnPoints 欄位不被去重影響
  });

  it("同一物種多筆 row 不會被當成加權：npcId 只計一次 hp", () => {
    // 若錯誤地把 monsters 陣列本身重複（例如上游忘記 group by），
    // distinct npcId 的邏輯仍應只算一次，不讓「出現次數多」誤判成 highHp 候選池變大。
    const monsters = [
      monster({ npcId: 1, hp: 100 }),
      monster({ npcId: 1, hp: 100 }), // 重複 npcId（不應發生，但防禦性驗證不加權）
      monster({ npcId: 2, hp: 100 }),
      monster({ npcId: 3, hp: 5000 }),
    ];
    const markers = buildMonsterMarkers(monsters, [], null);
    const boss = markers.find((m) => m.npcId === 3)!;
    // others = distinct{1,2} 的 hp = [100,100]，中位數 100 → ratio = 50，不因為 npcId=1
    // 出現兩次就被當成 3 個候選來算中位數。
    expect(boss.hpRatio).toBe(50);
    expect(boss.highHp).toBe(true);
  });

  it("標準偶數中位數：[10k,1M,1M] 排序後中位數是兩個 1M 的平均，不會讓兩個高 hp 物種互相標記", () => {
    const monsters = [
      monster({ npcId: 1, hp: 10_000 }),
      monster({ npcId: 2, hp: 1_000_000 }),
      monster({ npcId: 3, hp: 1_000_000 }),
    ];
    const markers = buildMonsterMarkers(monsters, [], null);

    const npc1 = markers.find((m) => m.npcId === 1)!;
    // others = [1M, 1M]，中位數 1M；10000/1000000 = 0.01，遠低於 10。
    expect(npc1.hpRatio).toBeCloseTo(0.01, 10);
    expect(npc1.highHp).toBe(false);

    const npc2 = markers.find((m) => m.npcId === 2)!;
    // others = [10000, 1000000]，中位數 (10000+1000000)/2 = 505000；1000000/505000 ≈ 1.98。
    expect(npc2.hpRatio).toBeCloseTo(1_000_000 / 505_000, 10);
    expect(npc2.highHp).toBe(false);

    const npc3 = markers.find((m) => m.npcId === 3)!;
    expect(npc3.highHp).toBe(false);

    // 關鍵斷言：不會有兩個物種同時被標記（避免偶數中位數被規劃者誤改成「跟任一其他比較」）。
    expect(markers.filter((m) => m.highHp).length).toBe(0);
  });

  it("hp 為 0 或 null 的物種不計入候選池，也不能自己成為 highHp", () => {
    const monsters = [
      monster({ npcId: 1, hp: 0 }),
      monster({ npcId: 2, hp: null }),
      monster({ npcId: 3, hp: 100 }),
      monster({ npcId: 4, hp: 100 }),
      monster({ npcId: 5, hp: 5000 }),
    ];
    const markers = buildMonsterMarkers(monsters, [], null);

    const zeroHp = markers.find((m) => m.npcId === 1)!;
    expect(zeroHp.hpRatio).toBeNull();
    expect(zeroHp.highHp).toBe(false);

    const nullHp = markers.find((m) => m.npcId === 2)!;
    expect(nullHp.hpRatio).toBeNull();
    expect(nullHp.highHp).toBe(false);

    // 候選池只有 {3:100, 4:100, 5:5000}，npc5 vs median([100,100])=100 → ratio 50。
    const boss = markers.find((m) => m.npcId === 5)!;
    expect(boss.hpRatio).toBe(50);
    expect(boss.highHp).toBe(true);
  });

  it("單一合格物種永遠不會是 highHp（validSpeciesCount < 2）", () => {
    const monsters = [monster({ npcId: 1, hp: 999_999 })];
    const markers = buildMonsterMarkers(monsters, [], null);
    expect(markers[0].hpRatio).toBeNull();
    expect(markers[0].highHp).toBe(false);
  });

  it("剛好 2 個合格物種：至多其中一個能是 highHp（互相比較不會雙雙成立）", () => {
    const monsters = [monster({ npcId: 1, hp: 100 }), monster({ npcId: 2, hp: 100_000 })];
    const markers = buildMonsterMarkers(monsters, [], null);
    const npc1 = markers.find((m) => m.npcId === 1)!;
    const npc2 = markers.find((m) => m.npcId === 2)!;
    expect(npc1.hpRatio).toBe(0.001); // 100/100000
    expect(npc1.highHp).toBe(false);
    expect(npc2.hpRatio).toBe(1000); // 100000/100
    expect(npc2.highHp).toBe(true);
  });

  it("比例剛好等於 10 時視為 highHp（>= 10，非嚴格大於）", () => {
    const monsters = [monster({ npcId: 1, hp: 100 }), monster({ npcId: 2, hp: 1000 })];
    const markers = buildMonsterMarkers(monsters, [], null);
    const npc2 = markers.find((m) => m.npcId === 2)!;
    expect(npc2.hpRatio).toBe(10);
    expect(npc2.highHp).toBe(true);
  });

  it("保留原始清單順序，即使沒有任何 highHp 物種", () => {
    const monsters = [
      monster({ npcId: 3, hp: 100 }),
      monster({ npcId: 1, hp: 100 }),
      monster({ npcId: 2, hp: 100 }),
    ];
    const markers = buildMonsterMarkers(monsters, [], null);
    expect(markers.map((m) => m.npcId)).toEqual([3, 1, 2]);
  });

  it("空 monsters 清單回空陣列", () => {
    expect(buildMonsterMarkers([], [], null)).toEqual([]);
  });
});

describe("getMonsterSpawnPositions — 舊 schema 容錯", () => {
  it("monster_spawns 表整個不存在時回空陣列（不拋錯）", () => {
    const mem = new Database(":memory:");
    mem.exec(`CREATE TABLE stages (kind TEXT, id INTEGER)`);
    vi.spyOn(dbModule, "getDb").mockReturnValue(mem);

    expect(getMonsterSpawnPositions("stage", 1)).toEqual([]);
    mem.close();
  });

  it("monster_spawns 表存在但缺 x/y 欄位時回空陣列（不拋錯）", () => {
    const mem = new Database(":memory:");
    mem.exec(
      `CREATE TABLE monster_spawns (id INTEGER, stage_kind TEXT, stage_id INTEGER, npc_id INTEGER)`,
    );
    mem.exec(`INSERT INTO monster_spawns VALUES (1, 'stage', 1, 100)`);
    vi.spyOn(dbModule, "getDb").mockReturnValue(mem);

    expect(getMonsterSpawnPositions("stage", 1)).toEqual([]);
    mem.close();
  });

  it("新 schema（有 x/y）在同一 mock db 上正常查詢，不受容錯分支影響", () => {
    const mem = new Database(":memory:");
    mem.exec(
      `CREATE TABLE monster_spawns (id INTEGER, stage_kind TEXT, stage_id INTEGER, npc_id INTEGER, x INTEGER, y INTEGER)`,
    );
    mem.exec(`INSERT INTO monster_spawns VALUES (1, 'stage', 1, 100, 10, 20)`);
    vi.spyOn(dbModule, "getDb").mockReturnValue(mem);

    expect(getMonsterSpawnPositions("stage", 1)).toEqual([{ npcId: 100, x: 10, y: 20 }]);
    mem.close();
  });

  it("與 schema 容錯無關的 SQL 錯誤（例如其他表不存在）照常拋出，不被靜默吞掉", () => {
    const mem = new Database(":memory:");
    mem.exec(
      `CREATE TABLE monster_spawns (id INTEGER, stage_kind TEXT, stage_id INTEGER, npc_id INTEGER, x INTEGER, y INTEGER)`,
    );
    vi.spyOn(dbModule, "getDb").mockReturnValue(mem);
    // getNpcPlacementsForStage 查不存在的 map_placements 表 → 這是與「monster_spawns
    // 缺 x/y」完全無關的錯誤，必須原樣拋出，證明 hasSpawnXYSupport 的容錯不會
    // 不小心蓋住其他 SQL 錯誤（capability check 只針對 monster_spawns 一張表）。
    expect(() => getNpcPlacementsForStage("stage", 1)).toThrow(/no such table: map_placements/);
    mem.close();
  });
});
