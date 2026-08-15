import { describe, it, expect, vi, afterEach } from "vitest";
import Database from "better-sqlite3";
import * as dbModule from "@/lib/db";
import { getDb } from "@/lib/db";
import {
  TRAINING_LEVEL_RADIUS,
  getMonstersAtStage,
  getStagesForMonster,
  getStagesForMonsters,
  getTrainingSpots,
  parseTrainingLevel,
} from "../monster-spawns";
import type { StageKind } from "@/lib/types/stage";

// 真實資料（tthol.sqlite，read-only）。以下常數在測試 setup 中會先驗證仍成立，
// 不直接把「當下的全庫總數」當成 product contract。
const TANQUAN = { kind: "sestage" as StageKind, id: 1958 }; // 檀泉別苑：城鎮，4 隻 drop_exp = 1
const BAMEN_1F = { kind: "stage" as StageKind, id: 39 }; // 八門八窟一層：Lv77–80 真練功點
const BLUE_SEA = { kind: "stage" as StageKind, id: 517 }; // 藍海：●河豚小兵 38 筆重複 spawn row
const HEDONFISH_NPC = 8219; // ●河豚小兵 Lv80
const TRIAL_GROUND = { kind: "stage" as StageKind, id: 108 }; // 天師試煉場：寶箱 + 搗蛋猴 + Lv0 謎樣的鬼
const UNKNOWN_LEVEL_NPC = 6291; // 謎樣的鬼 level = 0

const key = (s: { stageKind: StageKind; stageId: number }) => `${s.stageKind}:${s.stageId}`;

afterEach(() => {
  vi.restoreAllMocks();
});

describe("parseTrainingLevel", () => {
  it("接受 1–200 的整數字串", () => {
    expect(parseTrainingLevel("1")).toBe(1);
    expect(parseTrainingLevel("80")).toBe(80);
    expect(parseTrainingLevel("200")).toBe(200);
    expect(parseTrainingLevel(" 80 ")).toBe(80);
  });

  it("缺值與空白回 null，不預設 Lv 1", () => {
    expect(parseTrainingLevel(undefined)).toBeNull();
    expect(parseTrainingLevel("")).toBeNull();
    expect(parseTrainingLevel("   ")).toBeNull();
  });

  it("超出範圍回 null，不默默 clamp", () => {
    expect(parseTrainingLevel("0")).toBeNull();
    expect(parseTrainingLevel("-1")).toBeNull();
    expect(parseTrainingLevel("201")).toBeNull();
    expect(parseTrainingLevel("99999")).toBeNull();
  });

  it("非整數與非數字回 null", () => {
    expect(parseTrainingLevel("80.5")).toBeNull();
    expect(parseTrainingLevel("abc")).toBeNull();
    expect(parseTrainingLevel("NaN")).toBeNull();
    expect(parseTrainingLevel("Infinity")).toBeNull();
    expect(parseTrainingLevel("1e2")).toBeNull();
    expect(parseTrainingLevel("+80")).toBeNull();
    expect(parseTrainingLevel("0x50")).toBeNull();
    expect(parseTrainingLevel("80abc")).toBeNull();
  });

  it("getTrainingSpots 對無效等級同樣不查詢，直接回空陣列", () => {
    expect(getTrainingSpots(0)).toEqual([]);
    expect(getTrainingSpots(201)).toEqual([]);
    expect(getTrainingSpots(80.5)).toEqual([]);
    expect(getTrainingSpots(Number.NaN)).toEqual([]);
  });
});

describe("適配窗口", () => {
  it("TRAINING_LEVEL_RADIUS 是 5，且是唯一窗口來源", () => {
    expect(TRAINING_LEVEL_RADIUS).toBe(5);
  });

  it.each([
    [1, 1, 6],
    [80, 75, 85],
    [200, 195, 200],
  ])("Lv %i 的窗口為 %i–%i，且 inclusive", (playerLevel, lo, hi) => {
    const spots = getTrainingSpots(playerLevel);
    expect(spots.length).toBeGreaterThan(0);
    for (const s of spots) {
      expect(s.suitableLevelMin).toBeGreaterThanOrEqual(lo);
      expect(s.suitableLevelMax).toBeLessThanOrEqual(hi);
      for (const m of s.suitableMonsters) {
        expect(m.level).toBeGreaterThanOrEqual(lo);
        expect(m.level).toBeLessThanOrEqual(hi);
      }
    }
    // 上下界 inclusive：獨立 SQL 確認窗口端點的怪物確實存在，才有資格斷言 inclusive。
    const rows = getDb()
      .prepare(
        `SELECT DISTINCT n.level FROM monster_spawns ms
         JOIN stages s ON s.kind = ms.stage_kind AND s.id = ms.stage_id
         JOIN npc n ON n.id = ms.npc_id
         JOIN monsters m ON m.id = n.id
         WHERE s.name IS NOT NULL AND m.drop_exp > 1 AND n.level IN (?, ?)`,
      )
      .all(lo, hi) as Array<{ level: number }>;
    const seen = new Set(spots.flatMap((s) => s.suitableMonsters.map((m) => m.level)));
    for (const { level } of rows) expect(seen.has(level)).toBe(true);
  });

  it("窗口 clamp 到 1–200，不會外溢", () => {
    expect(getTrainingSpots(1).every((s) => s.suitableLevelMin >= 1)).toBe(true);
    expect(getTrainingSpots(200).every((s) => s.suitableLevelMax <= 200)).toBe(true);
  });
});

describe("練功對象判準 drop_exp > 1", () => {
  it("sestage:1958 檀泉別苑（城鎮 NPC）不出現在 Lv 80 候選中", () => {
    // 前提仍成立：該 stage 有 Lv75 的 spawn，但四隻都是 drop_exp = 1。
    const raw = getDb()
      .prepare(
        `SELECT n.id, n.level, n.hp, m.drop_exp FROM monster_spawns ms
         JOIN npc n ON n.id = ms.npc_id
         JOIN monsters m ON m.id = n.id
         WHERE ms.stage_kind = ? AND ms.stage_id = ?`,
      )
      .all(TANQUAN.kind, TANQUAN.id) as Array<{ level: number; drop_exp: number }>;
    expect(raw.length).toBeGreaterThan(0);
    expect(raw.some((r) => r.level >= 75 && r.level <= 85)).toBe(true);
    expect(raw.every((r) => r.drop_exp <= 1)).toBe(true);

    expect(getTrainingSpots(80).map(key)).not.toContain(
      key({ stageKind: TANQUAN.kind, stageId: TANQUAN.id }),
    );
  });

  it("stage:39 八門八窟一層仍出現在 Lv 80 候選中", () => {
    expect(getTrainingSpots(80).map(key)).toContain(
      key({ stageKind: BAMEN_1F.kind, stageId: BAMEN_1F.id }),
    );
  });

  it("判準不得改用 hp 閾值：存在 drop_exp = 1 且 hp > 100000 的 spawn 怪物", () => {
    // 這條是反向 regression。若有人把判準改成 hp 門檻，檀泉別苑那批（hp 134k–181k）
    // 會重新混入候選，上面的 sestage:1958 測試就會失敗。
    const rows = getDb()
      .prepare(
        `SELECT n.id, n.name, n.hp, m.drop_exp FROM monster_spawns ms
         JOIN npc n ON n.id = ms.npc_id
         JOIN monsters m ON m.id = n.id
         WHERE m.drop_exp = 1 AND n.hp > 100000
         GROUP BY n.id`,
      )
      .all() as Array<{ id: number; hp: number }>;
    expect(rows.length).toBeGreaterThan(0);
    // 檀泉別苑「獨孤霜」是其中之一。
    expect(rows.some((r) => r.id === 8619)).toBe(true);
    // 對照組：真練功怪 hp 反而低一個數量級，證明 hp 與是否為練功對象沒有單調關係。
    const bamen = getMonstersAtStage(BAMEN_1F.kind, BAMEN_1F.id);
    expect(bamen.every((m) => (m.hp ?? 0) < 100000)).toBe(true);
    expect(Math.max(...rows.map((r) => r.hp))).toBeGreaterThan(
      Math.max(...bamen.map((m) => m.hp ?? 0)),
    );
  });

  it("訓練樁／寶箱不會讓所在 stage 成為候選", () => {
    const dummies = getDb()
      .prepare(
        `SELECT DISTINCT n.id, n.level FROM monster_spawns ms
         JOIN npc n ON n.id = ms.npc_id
         JOIN monsters m ON m.id = n.id
         WHERE m.drop_exp <= 1 AND n.hp <= 10 AND n.level BETWEEN 1 AND 200`,
      )
      .all() as Array<{ id: number; level: number }>;
    expect(dummies.length).toBeGreaterThan(0);

    for (const d of dummies) {
      const stages = getDb()
        .prepare(
          `SELECT DISTINCT ms.stage_kind AS stageKind, ms.stage_id AS stageId
           FROM monster_spawns ms WHERE ms.npc_id = ?`,
        )
        .all(d.id) as Array<{ stageKind: StageKind; stageId: number }>;
      const candidates = new Set(getTrainingSpots(d.level).map(key));
      for (const st of stages) {
        if (!candidates.has(key(st))) continue;
        // 若仍是候選，必須是因為同 stage 另有 drop_exp > 1 的窗口內怪物，而不是因為訓練樁。
        const real = getDb()
          .prepare(
            `SELECT COUNT(*) AS c FROM monster_spawns ms
             JOIN npc n ON n.id = ms.npc_id
             JOIN monsters m ON m.id = n.id
             WHERE ms.stage_kind = ? AND ms.stage_id = ? AND m.drop_exp > 1
               AND n.level BETWEEN ? AND ?`,
          )
          .get(
            st.stageKind,
            st.stageId,
            Math.max(1, d.level - TRAINING_LEVEL_RADIUS),
            Math.min(200, d.level + TRAINING_LEVEL_RADIUS),
          ) as { c: number };
        expect(real.c).toBeGreaterThan(0);
      }
    }
  });

  it("每個候選 stage 都至少有一隻 drop_exp > 1 的窗口內怪物", () => {
    for (const s of getTrainingSpots(80)) {
      const row = getDb()
        .prepare(
          `SELECT COUNT(*) AS c FROM monster_spawns ms
           JOIN npc n ON n.id = ms.npc_id
           JOIN monsters m ON m.id = n.id
           WHERE ms.stage_kind = ? AND ms.stage_id = ? AND m.drop_exp > 1
             AND n.level BETWEEN 75 AND 85`,
        )
        .get(s.stageKind, s.stageId) as { c: number };
      expect(row.c).toBe(s.suitableSpawnPoints);
    }
  });
});

describe("每張地圖等級聚合", () => {
  it.each([1, 10, 80, 150, 200])("Lv %i 的每個 row 都滿足聚合不變式", (playerLevel) => {
    const spots = getTrainingSpots(playerLevel);
    expect(spots.length).toBeGreaterThan(0);
    for (const s of spots) {
      expect(s.stageName.length).toBeGreaterThan(0);
      expect(["stage", "sestage"]).toContain(s.stageKind);
      expect(s.stageId).toBeGreaterThan(0);

      expect(s.monsterLevelMin).toBeGreaterThanOrEqual(1);
      expect(s.monsterLevelMax).toBeLessThanOrEqual(200);
      expect(s.monsterLevelMin).toBeLessThanOrEqual(s.monsterLevelMax);
      expect(s.suitableLevelMin).toBeGreaterThanOrEqual(s.monsterLevelMin);
      expect(s.suitableLevelMax).toBeLessThanOrEqual(s.monsterLevelMax);

      expect(s.suitableMonsterCount).toBeGreaterThan(0);
      expect(s.suitableMonsterCount).toBeLessThanOrEqual(s.monsterCount);
      expect(s.suitableSpawnPoints).toBeGreaterThan(0);
      expect(s.suitableSpawnPoints).toBeLessThanOrEqual(s.spawnPoints);
      expect(s.unknownLevelSpawnPoints).toBeGreaterThanOrEqual(0);

      expect(s.fitPercent).toBeCloseTo((s.suitableSpawnPoints / s.spawnPoints) * 100, 10);
      expect(s.fitPercent).toBeGreaterThan(0);
      expect(s.fitPercent).toBeLessThanOrEqual(100);
      expect(s.averageLevelDistance).toBeGreaterThanOrEqual(0);

      // suitableMonsters 長度等於 suitableMonsterCount（UI 的 +N 由此推導）。
      expect(s.suitableMonsters.length).toBe(s.suitableMonsterCount);
      const levels = s.suitableMonsters.map((m) => m.level);
      expect(Math.min(...levels)).toBe(s.suitableLevelMin);
      expect(Math.max(...levels)).toBe(s.suitableLevelMax);
      // 依 level 遞增、id 遞增
      for (let i = 1; i < s.suitableMonsters.length; i++) {
        const a = s.suitableMonsters[i - 1];
        const b = s.suitableMonsters[i];
        expect(a.level < b.level || (a.level === b.level && a.npcId < b.npcId)).toBe(true);
      }
      // distinct npcId
      expect(new Set(s.suitableMonsters.map((m) => m.npcId)).size).toBe(s.suitableMonsters.length);
    }
  });

  it("無名稱 stage 不出現在結果（全庫目前無此案例，斷言前提仍成立）", () => {
    const row = getDb().prepare(`SELECT COUNT(*) AS c FROM stages WHERE name IS NULL`).get() as {
      c: number;
    };
    expect(row.c).toBe(0);
    // 前提成立時，所有候選必然有非空名稱；上面的聚合不變式已覆蓋。
  });

  it("立繪查無時 image 為 null，不拋錯（涵蓋率約 95%）", () => {
    const monsters = getTrainingSpots(80).flatMap((s) => s.suitableMonsters);
    expect(monsters.length).toBeGreaterThan(0);
    for (const m of monsters) {
      expect(m.image === null || typeof m.image.url === "string").toBe(true);
    }
    expect(monsters.some((m) => m.image !== null)).toBe(true);
  });
});

describe("重複 spawn rows", () => {
  it("同 NPC 多筆 row 只算一種怪物，但每筆都算一個刷怪點", () => {
    const dup = getDb()
      .prepare(
        `SELECT COUNT(*) AS rows FROM monster_spawns
         WHERE stage_kind = ? AND stage_id = ? AND npc_id = ?`,
      )
      .get(BLUE_SEA.kind, BLUE_SEA.id, HEDONFISH_NPC) as { rows: number };
    expect(dup.rows).toBeGreaterThan(1);

    const spot = getTrainingSpots(80).find(
      (s) => s.stageKind === BLUE_SEA.kind && s.stageId === BLUE_SEA.id,
    );
    expect(spot).toBeDefined();

    // distinct NPC 數等於該 stage 的 distinct npc_id 數，不等於 row 數。
    const distinct = getDb()
      .prepare(
        `SELECT COUNT(DISTINCT n.id) AS c FROM monster_spawns ms
         JOIN npc n ON n.id = ms.npc_id
         JOIN monsters m ON m.id = n.id
         WHERE ms.stage_kind = ? AND ms.stage_id = ? AND m.drop_exp > 1
           AND n.level BETWEEN 1 AND 200`,
      )
      .get(BLUE_SEA.kind, BLUE_SEA.id) as { c: number };
    expect(spot!.monsterCount).toBe(distinct.c);
    expect(spot!.spawnPoints).toBeGreaterThan(spot!.monsterCount);
    // 重複 row 保留在 suitable 分子內。
    expect(spot!.suitableSpawnPoints).toBeGreaterThanOrEqual(dup.rows);
    // 該怪物在 suitableMonsters 只出現一次。
    expect(spot!.suitableMonsters.filter((m) => m.npcId === HEDONFISH_NPC).length).toBe(1);
  });
});

describe("level 0 / 未知等級", () => {
  it("NPC 6291 謎樣的鬼 level = 0 仍存在，且不在 monsters 表", () => {
    const npc = getDb().prepare(`SELECT id, level FROM npc WHERE id = ?`).get(UNKNOWN_LEVEL_NPC) as
      { level: number } | undefined;
    expect(npc?.level).toBe(0);
    const mon = getDb().prepare(`SELECT id FROM monsters WHERE id = ?`).get(UNKNOWN_LEVEL_NPC) as
      { id: number } | undefined;
    // 資料現況：唯一的 level 0 spawn 怪物不在 monsters 表，因此先被 entity join 排除，
    // unknownLevelSpawnPoints 在全庫目前恆為 0（見下一個測試）。
    expect(mon).toBeUndefined();
  });

  it("只有無效等級怪物的 stage 不會成為任何等級的候選", () => {
    // stage:108 天師試煉場 = 寶箱(drop_exp 1) + ●搗蛋猴(drop_exp 1) + 謎樣的鬼(Lv0，不在 monsters)
    for (const lv of [1, 2, 34, 39, 80, 200]) {
      expect(getTrainingSpots(lv).map(key)).not.toContain(
        key({ stageKind: TRIAL_GROUND.kind, stageId: TRIAL_GROUND.id }),
      );
    }
  });

  it("unknownLevelSpawnPoints 與獨立 SQL 一致，且無效等級不進 min/max 與分母", () => {
    // 獨立 oracle：對每個候選 stage 直接數「通過判準但 level 不在 1–200」的 row 數。
    const oracle = getDb().prepare(
      `SELECT SUM(CASE WHEN n.level IS NULL OR n.level < 1 OR n.level > 200 THEN 1 ELSE 0 END) AS unknown,
              SUM(CASE WHEN n.level BETWEEN 1 AND 200 THEN 1 ELSE 0 END) AS valid,
              MIN(CASE WHEN n.level BETWEEN 1 AND 200 THEN n.level END) AS lo,
              MAX(CASE WHEN n.level BETWEEN 1 AND 200 THEN n.level END) AS hi
       FROM monster_spawns ms
       JOIN npc n ON n.id = ms.npc_id
       JOIN monsters m ON m.id = n.id
       WHERE ms.stage_kind = ? AND ms.stage_id = ? AND m.drop_exp > 1`,
    );
    for (const s of getTrainingSpots(80)) {
      const o = oracle.get(s.stageKind, s.stageId) as {
        unknown: number;
        valid: number;
        lo: number;
        hi: number;
      };
      expect(s.unknownLevelSpawnPoints).toBe(o.unknown);
      expect(s.spawnPoints).toBe(o.valid); // 分母只含有效等級
      expect(s.monsterLevelMin).toBe(o.lo);
      expect(s.monsterLevelMax).toBe(o.hi);
    }
  });

  it("全庫目前沒有『通過判準但等級無效』的 spawn row（下一個 fixture 測試的前提）", () => {
    const row = getDb()
      .prepare(
        `SELECT COUNT(*) AS c FROM monster_spawns ms
         JOIN npc n ON n.id = ms.npc_id
         JOIN monsters m ON m.id = n.id
         WHERE m.drop_exp > 1 AND (n.level IS NULL OR n.level < 1 OR n.level > 200)`,
      )
      .get() as { c: number };
    // 唯一的 level 0 spawn 怪物（6291）不在 monsters，已先被 entity join 排除。
    // 因此 unknownLevelSpawnPoints 分支在真實 DB 上不可達，需以 fixture 覆蓋。
    expect(row.c).toBe(0);
  });

  // level 0 / 無效等級的 aggregate 行為在真實 DB 上不可達（見上一個測試），
  // 因此用一個最小 in-memory fixture 覆蓋這條分支，不偽造 live DB 證據。
  it("[fixture] level 0 不進 min/max、不進適配、不進 spawnPoints 分母，只計入 unknown", () => {
    const mem = new Database(":memory:");
    mem.exec(`
      CREATE TABLE stages (kind TEXT, id INTEGER, name TEXT, [group] INTEGER, min_level_require INTEGER);
      CREATE TABLE npc (id INTEGER, name TEXT, level INTEGER, hp INTEGER);
      CREATE TABLE monsters (id INTEGER, drop_exp INTEGER);
      CREATE TABLE monster_spawns (id INTEGER, stage_kind TEXT, stage_id INTEGER, npc_id INTEGER);
      CREATE TABLE npc_images (npc_id INTEGER, url TEXT, width INTEGER, height INTEGER);

      -- A: 一隻 Lv80 有效怪（2 筆 row）+ 一隻 Lv0 未知怪（3 筆 row）
      INSERT INTO stages VALUES ('stage', 1, '混合地圖', 7, 1);
      -- B: 只有 Lv0 未知怪 → 不得成為候選
      INSERT INTO stages VALUES ('stage', 2, '全未知地圖', 7, 1);

      INSERT INTO npc VALUES (100, '有效怪', 80, 9000);
      INSERT INTO npc VALUES (200, '未知等級怪', 0, 9000);
      INSERT INTO monsters VALUES (100, 5000), (200, 5000);

      INSERT INTO monster_spawns VALUES (1,'stage',1,100),(2,'stage',1,100),
                                        (3,'stage',1,200),(4,'stage',1,200),(5,'stage',1,200),
                                        (6,'stage',2,200);
    `);
    vi.spyOn(dbModule, "getDb").mockReturnValue(mem);

    const spots = getTrainingSpots(80);
    expect(spots.map(key)).toEqual(["stage:1"]); // 全未知的 stage:2 被排除

    const s = spots[0];
    expect(s.monsterLevelMin).toBe(80); // Lv0 不進 min
    expect(s.monsterLevelMax).toBe(80);
    expect(s.suitableLevelMin).toBe(80);
    expect(s.suitableLevelMax).toBe(80);
    expect(s.monsterCount).toBe(1); // Lv0 不算一種有效怪物
    expect(s.suitableMonsterCount).toBe(1);
    expect(s.spawnPoints).toBe(2); // 分母只有有效等級的 2 筆
    expect(s.suitableSpawnPoints).toBe(2);
    expect(s.unknownLevelSpawnPoints).toBe(3); // Lv0 的 3 筆計入 unknown
    expect(s.fitPercent).toBe(100); // 不是 2/5 = 40%
    expect(s.averageLevelDistance).toBe(0); // Lv0 未被當成 |0-80|=80
    expect(s.suitableMonsters.map((m) => m.npcId)).toEqual([100]);

    mem.close();
  });
});

describe("排序", () => {
  // 獨立 oracle：從原始 rows 在 JS 重算聚合與四層排序，與 query 結果比對。
  function oracleOrder(playerLevel: number): string[] {
    const lo = Math.max(1, playerLevel - TRAINING_LEVEL_RADIUS);
    const hi = Math.min(200, playerLevel + TRAINING_LEVEL_RADIUS);
    const rows = getDb()
      .prepare(
        `SELECT ms.stage_kind AS stageKind, ms.stage_id AS stageId, n.level AS level
         FROM monster_spawns ms
         JOIN stages s ON s.kind = ms.stage_kind AND s.id = ms.stage_id
         JOIN npc n ON n.id = ms.npc_id
         JOIN monsters m ON m.id = n.id
         WHERE s.name IS NOT NULL AND m.drop_exp > 1`,
      )
      .all() as Array<{ stageKind: StageKind; stageId: number; level: number }>;

    const agg = new Map<
      string,
      { kind: StageKind; id: number; valid: number; suitable: number; distSum: number }
    >();
    for (const r of rows) {
      if (r.level < 1 || r.level > 200) continue; // 無效等級不進分母
      const k = `${r.stageKind}:${r.stageId}`;
      let a = agg.get(k);
      if (!a) {
        a = { kind: r.stageKind, id: r.stageId, valid: 0, suitable: 0, distSum: 0 };
        agg.set(k, a);
      }
      a.valid++;
      a.distSum += Math.abs(r.level - playerLevel);
      if (r.level >= lo && r.level <= hi) a.suitable++;
    }

    return [...agg.entries()]
      .filter(([, a]) => a.suitable > 0)
      .map(([k, a]) => ({
        k,
        kind: a.kind,
        id: a.id,
        fit: (100.0 * a.suitable) / a.valid,
        suitable: a.suitable,
        dist: a.distSum / a.valid,
      }))
      .sort(
        (x, y) =>
          y.fit - x.fit ||
          y.suitable - x.suitable ||
          x.dist - y.dist ||
          x.kind.localeCompare(y.kind) ||
          x.id - y.id,
      )
      .map((x) => x.k);
  }

  it.each([1, 10, 80, 150, 200])("Lv %i 的四層排序與獨立 oracle 一致", (playerLevel) => {
    expect(getTrainingSpots(playerLevel).map(key)).toEqual(oracleOrder(playerLevel));
  });

  it("每一層排序在真實資料上都有被實際使用到（不是空跑）", () => {
    // Lv 10 的候選數最多，四層 tie-break 都會被觸發。
    const spots = getTrainingSpots(10);
    const used = [0, 0, 0, 0];
    for (let i = 1; i < spots.length; i++) {
      const a = spots[i - 1];
      const b = spots[i];
      if (a.fitPercent !== b.fitPercent) {
        expect(a.fitPercent).toBeGreaterThan(b.fitPercent);
        used[0]++;
      } else if (a.suitableSpawnPoints !== b.suitableSpawnPoints) {
        expect(a.suitableSpawnPoints).toBeGreaterThan(b.suitableSpawnPoints);
        used[1]++;
      } else if (a.averageLevelDistance !== b.averageLevelDistance) {
        expect(a.averageLevelDistance).toBeLessThan(b.averageLevelDistance);
        used[2]++;
      } else {
        expect(
          `${a.stageKind}:${String(a.stageId).padStart(6, "0")}` <
            `${b.stageKind}:${String(b.stageId).padStart(6, "0")}`,
        ).toBe(true);
        used[3]++;
      }
    }
    for (const n of used) expect(n).toBeGreaterThan(0);
  });

  it("同輸入重複呼叫得到相同順序（deterministic）", () => {
    expect(getTrainingSpots(80).map(key)).toEqual(getTrainingSpots(80).map(key));
  });
});

describe("query 數量（N+1 guard）", () => {
  it("getTrainingSpots 固定使用 3 個 query", () => {
    const db = getDb();
    const original = db.prepare.bind(db);
    let count = 0;
    // ponytail: 直接 patch prepare 計數，比引入 mock framework 便宜；測完還原。
    (db as unknown as { prepare: typeof original }).prepare = ((sql: string) => {
      count++;
      return original(sql);
    }) as typeof original;
    try {
      const spots = getTrainingSpots(10); // 候選數最多的等級
      expect(spots.length).toBeGreaterThan(0);
    } finally {
      (db as unknown as { prepare: typeof original }).prepare = original;
    }
    // 1) aggregate 2) batch 適配怪物 3) getNpcImageMap
    expect(count).toBe(3);
  });

  it("batch 立繪不會超過 SQLite 999 變數上限", () => {
    // 候選 stage 數 + 立繪 id 數都必須留在單一 chunk 內；超過時 images.ts 會自行分塊，
    // 但 stage batch query 沒有分塊，所以這裡守住上限。
    let maxStages = 0;
    let maxNpcs = 0;
    for (const lv of [1, 10, 35, 80, 150, 200]) {
      const spots = getTrainingSpots(lv);
      maxStages = Math.max(maxStages, spots.length);
      maxNpcs = Math.max(
        maxNpcs,
        new Set(spots.flatMap((s) => s.suitableMonsters.map((m) => m.npcId))).size,
      );
    }
    // stage batch 的變數 = 2 (level) + kind 數 + stage id 數
    expect(maxStages + 2 + 2).toBeLessThan(999);
    expect(maxNpcs).toBeLessThan(900);
    // stages 總數本身就是候選上限，作為結構性保證。
    const total = getDb().prepare(`SELECT COUNT(*) AS c FROM stages`).get() as { c: number };
    expect(total.c).toBeLessThan(900);
  });
});

describe("既有 query regression", () => {
  it("getStagesForMonster 仍按 stage 聚合刷怪點", () => {
    const stages = getStagesForMonster(HEDONFISH_NPC);
    expect(stages.length).toBeGreaterThan(0);
    const target = stages.find((s) => s.stageKind === BLUE_SEA.kind && s.stageId === BLUE_SEA.id);
    expect(target).toBeDefined();
    const raw = getDb()
      .prepare(
        `SELECT COUNT(*) AS c FROM monster_spawns WHERE npc_id = ? AND stage_kind = ? AND stage_id = ?`,
      )
      .get(HEDONFISH_NPC, BLUE_SEA.kind, BLUE_SEA.id) as { c: number };
    expect(target!.spawnPoints).toBe(raw.c);
    // 依 spawnPoints 遞減
    for (let i = 1; i < stages.length; i++) {
      expect(stages[i - 1].spawnPoints).toBeGreaterThanOrEqual(stages[i].spawnPoints);
    }
  });

  it("getStagesForMonsters([]) 仍回空 Map", () => {
    const map = getStagesForMonsters([]);
    expect(map).toBeInstanceOf(Map);
    expect(map.size).toBe(0);
  });

  it("getStagesForMonsters 批次結果與逐一查詢一致", () => {
    const ids = [HEDONFISH_NPC, 5461, 5463];
    const batch = getStagesForMonsters(ids);
    for (const id of ids) {
      expect(batch.get(id)).toEqual(getStagesForMonster(id));
    }
  });

  it("getMonstersAtStage 仍回 distinct monster 與 spawn point count", () => {
    const list = getMonstersAtStage(BAMEN_1F.kind, BAMEN_1F.id);
    expect(list.length).toBeGreaterThan(0);
    expect(new Set(list.map((m) => m.npcId)).size).toBe(list.length);
    const raw = getDb()
      .prepare(`SELECT COUNT(*) AS c FROM monster_spawns WHERE stage_kind = ? AND stage_id = ?`)
      .get(BAMEN_1F.kind, BAMEN_1F.id) as { c: number };
    expect(list.reduce((s, m) => s + m.spawnPoints, 0)).toBe(raw.c);
    for (let i = 1; i < list.length; i++) {
      expect(list[i].level).toBeGreaterThanOrEqual(list[i - 1].level);
    }
  });
});
