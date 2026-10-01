import { describe, it, expect } from "vitest";
import { getDb } from "@/lib/db";
import type { EntityImage } from "../images";
import { getNpcDetail, searchNpcs } from "../npcs";
import { getNpcPlacementsForStage } from "../maps";

const DISGUISE_MASTER = 6712;
const MONSTER = 5970; // ●影修羅
const EXPECTED_MAPS = [
  { stageKind: "stage", stageId: 2, stageName: "莫愁谷村莊" },
  { stageKind: "stage", stageId: 12, stageName: "飛雁山莊中庭" },
  { stageKind: "stage", stageId: 30, stageName: "天外天境" },
  { stageKind: "stage", stageId: 51, stageName: "洛陽外城" },
  { stageKind: "stage", stageId: 54, stageName: "成都太城" },
];

describe("npcs.ts 查詢（真實資料庫）", () => {
  it("searchNpcs 修剪查詢字串，易容師只有一筆摘要且有五張地圖", () => {
    const results = searchNpcs("  易容師  ");
    expect(results).toEqual(searchNpcs("易容師"));
    const matches = results.filter((npc) => npc.id === DISGUISE_MASTER);
    expect(matches).toHaveLength(1);
    expect(matches[0]).toMatchObject({
      id: DISGUISE_MASTER,
      name: "易容師",
      memberIds: [DISGUISE_MASTER],
      mapCount: 5,
    });
    expect(matches[0].mapNames.toSorted()).toEqual(
      EXPECTED_MAPS.map((map) => map.stageName).toSorted(),
    );
  });

  it("getNpcDetail 回傳易容師五張去重地圖，依 kind 與 id 排序", () => {
    const detail = getNpcDetail(DISGUISE_MASTER)!;
    expect(detail).toMatchObject({
      id: DISGUISE_MASTER,
      name: "易容師",
      memberIds: [DISGUISE_MASTER],
      maps: EXPECTED_MAPS,
      image: searchNpcs("易容師")[0].image,
      missions: [],
    });
    expect(detail.maps.map(({ stageKind, stageId, stageName }) => ({ stageKind, stageId, stageName }))).toEqual(EXPECTED_MAPS);
    for (const map of detail.maps) {
      expect(map.placements.length).toBeGreaterThan(0);
      const placements = getDb()
        .prepare(
          `SELECT id AS placementId, npc_id AS npcId FROM map_placements
           WHERE npc_id = ? AND stage_kind = ? AND stage_id = ?
             AND category = 'npc' AND in_bounds = 1 ORDER BY id`,
        )
        .all(DISGUISE_MASTER, map.stageKind, map.stageId);
      expect(map.placements).toEqual(placements);
    }
  });

  it("getNpcPlacementsForStage 回傳真實 placementId，與 NPC 地圖參照一致", () => {
    for (const map of getNpcDetail(DISGUISE_MASTER)!.maps) {
      const placements = getNpcPlacementsForStage(map.stageKind, map.stageId);
      for (const ref of map.placements) {
        expect(placements).toContainEqual(expect.objectContaining(ref));
        expect(ref.placementId).toBeGreaterThan(0);
      }
    }
  });

  it("雲少歆有成員任務；成員關聯優先且保留名稱事件類型", () => {
    const npc = searchNpcs("雲少歆").find((npc) => npc.name === "雲少歆")!;
    const detail = getNpcDetail(npc.id)!;
    const refs = getDb()
      .prepare(
        `SELECT DISTINCT m.id FROM mission_refs r JOIN missions m ON m.id = r.mission_id
         WHERE r.npc_id > 0 AND r.npc_id IN (SELECT value FROM json_each(?)) ORDER BY m.id`,
      )
      .all(JSON.stringify(npc.memberIds)) as Array<{ id: number }>;
    expect(refs.length).toBeGreaterThan(0);
    expect(
      detail.missions
        .filter((mission) => mission.association === "member")
        .map((mission) => mission.missionId),
    ).toEqual(refs.map((ref) => ref.id));
    expect(detail.missions.map((mission) => mission.missionId)).toEqual(
      [...new Set(detail.missions.map((mission) => mission.missionId))].sort((a, b) => a - b),
    );
    for (const mission of detail.missions) {
      const events = getDb()
        .prepare(
          `SELECT DISTINCT e.event FROM mission_events e
           JOIN npc_strings s ON s.id = e.npc_name_id
           WHERE s.name = ? AND e.mission_id = ? AND e.event IS NOT NULL ORDER BY e.event`,
        )
        .all(npc.name, mission.missionId) as Array<{ event: string }>;
      expect(mission.eventTypes).toEqual(events.map((event) => event.event));
    }
    expect(npc).not.toHaveProperty("missions");
  });

  it("家族總管有名稱關聯任務與去重事件類型", () => {
    const npc = searchNpcs("家族總管").find((npc) => npc.name === "家族總管")!;
    const missions = getNpcDetail(npc.id)!.missions;
    const nameMissions = missions.filter((mission) => mission.association === "name");
    expect(nameMissions.length).toBeGreaterThan(0);
    for (const mission of nameMissions) {
      expect(mission.eventTypes.length).toBeGreaterThan(0);
      expect(mission.eventTypes).toEqual([...new Set(mission.eventTypes)].sort());
      const name = getDb()
        .prepare("SELECT name FROM missions WHERE id = ?")
        .get(mission.missionId) as { name: string | null };
      expect(mission.missionName).toBe(name.name);
    }
  });

  it("易容師縮圖非 null，與資料庫立繪一致", () => {
    const image = getDb()
      .prepare("SELECT url, width, height FROM npc_images WHERE npc_id = ?")
      .get(DISGUISE_MASTER) as EntityImage | undefined;
    expect(image).toBeDefined();
    expect(searchNpcs("易容師")[0].image).toEqual(image);
    expect(getNpcDetail(DISGUISE_MASTER)!.image).toEqual(image);
  });

  it("不存在的 NPC 回 null", () => {
    expect(getNpcDetail(999999999)).toBeNull();
  });

  it("怪物不會被當作 NPC", () => {
    expect(getNpcDetail(MONSTER)).toBeNull();
    expect(searchNpcs("影修羅").some((npc) => npc.id === MONSTER)).toBe(false);
  });

  it("空白查詢回傳全部 NPC，每個名字一筆且依名字、id 排序", () => {
    const all = searchNpcs("");
    expect(searchNpcs("   ")).toEqual(all);
    expect(all.some((npc) => npc.id === DISGUISE_MASTER)).toBe(true);
    expect(new Set(all.map((npc) => npc.id)).size).toBe(all.length);
    expect(new Set(all.map((npc) => npc.name)).size).toBe(all.length);
    expect(all).toEqual(
      all.toSorted((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : a.id - b.id)),
    );
    for (const npc of all) {
      expect(npc.name.trim().length).toBeGreaterThan(0);
      expect(npc.memberIds).toEqual([...new Set(npc.memberIds)].sort((a, b) => a - b));
      expect(npc.id).toBe(npc.memberIds[0]);
      expect(npc.mapCount).toBeGreaterThan(0);
      expect(new Set(npc.mapNames).size).toBe(npc.mapNames.length);
      expect(npc.mapNames.every((name) => typeof name === "string")).toBe(true);
    }
  });

  it("寵物練功教練合併成一筆，成員只包含有有效 placement 的 NPC", () => {
    const trainers = searchNpcs("寵物練功教練");
    expect(trainers).toHaveLength(1);
    expect(trainers[0].memberIds.length).toBeGreaterThan(1);
    const eligible = getDb()
      .prepare(
        `SELECT n.id FROM npc n
         WHERE n.name = ? AND n.is_npc = 1 AND n.is_monster = 0
           AND EXISTS (SELECT 1 FROM map_placements p WHERE p.npc_id = n.id
                       AND p.category = 'npc' AND p.in_bounds = 1)
         ORDER BY n.id`,
      )
      .all("寵物練功教練") as Array<{ id: number }>;
    expect(trainers[0].memberIds).toEqual(eligible.map((npc) => npc.id));
    expect(trainers[0].id).toBe(eligible[0].id);
  });

  it("非最小成員 id 也回傳完整同名群組，地圖聯集去重", () => {
    const summary = searchNpcs("寵物練功教練")[0];
    const detail = getNpcDetail(summary.id)!;
    expect(getNpcDetail(summary.memberIds[1])).toEqual(detail);
    expect(detail).toMatchObject({
      id: summary.id,
      name: summary.name,
      memberIds: summary.memberIds,
      image: summary.image,
    });
    const maps = getDb()
      .prepare(
        `SELECT DISTINCT p.stage_kind AS stageKind, p.stage_id AS stageId, s.name AS stageName
         FROM map_placements p
         LEFT JOIN stages s ON s.kind = p.stage_kind AND s.id = p.stage_id
         WHERE p.npc_id IN (${summary.memberIds.map(() => "?").join(",")})
           AND p.category = 'npc' AND p.in_bounds = 1
         ORDER BY stageKind, stageId`,
      )
      .all(...summary.memberIds);
    expect(detail.maps.map(({ stageKind, stageId, stageName }) => ({ stageKind, stageId, stageName }))).toEqual(maps);
    expect(summary.mapCount).toBe(maps.length);
    for (const map of detail.maps) {
      const placements = getDb()
        .prepare(
          `SELECT id AS placementId, npc_id AS npcId FROM map_placements
           WHERE npc_id IN (SELECT value FROM json_each(?)) AND stage_kind = ? AND stage_id = ?
             AND category = 'npc' AND in_bounds = 1 ORDER BY id`,
        )
        .all(JSON.stringify(detail.memberIds), map.stageKind, map.stageId);
      expect(map.placements).toEqual(placements);
    }
  });

  it("群組立繪選擇有圖的最小合格成員 id，無圖則 null", () => {
    const images = getDb()
      .prepare("SELECT npc_id AS id, url, width, height FROM npc_images ORDER BY npc_id")
      .all() as Array<EntityImage & { id: number }>;
    for (const npc of searchNpcs("")) {
      const row = images.find((image) => npc.memberIds.includes(image.id));
      expect(npc.image).toEqual(
        row ? { url: row.url, width: row.width, height: row.height } : null,
      );
    }
  });

  it("沒有符合名字的 NPC 回空陣列", () => {
    expect(searchNpcs("不存在的NPC查詢999999999")).toEqual([]);
  });
});
