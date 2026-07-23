import { describe, it, expect } from "vitest";
import {
  getAchievementCategories,
  getAchievementsByCategory,
  getAchievementsWithRewards,
  searchAchievements,
} from "../achievements";
import { levelToGenPrefix, itemTypeToSlotPrefix, getAwakeningPath } from "../awakening";
import {
  parseMaterialItems,
  parseModProb,
  rowToCompound,
  getCompoundGroups,
  getCompoundGroupById,
  getCompoundById,
  getCompoundsByGroup,
  getCompoundsByType,
  getCompoundsByCoreMaterial,
  getCompoundsByGroupEnriched,
  getAllCompoundGroupsWithStats,
  getCompoundUsesForItem,
  getEquipmentSlotForType,
  getEquipmentEnhancementsForItemType,
  getCompoundSourcesForItem,
} from "../compound";
import {
  getItems,
  getItemById,
  getItemRands,
  getItemsByType,
  getItemsByIds,
  getItemRandsByIds,
} from "../items";
import {
  getSkills,
  getSkillById,
  getSkillRow,
  getSkillGroup,
  getSkillsByClan,
  getDistinctClans,
  getDistinctTargets,
  getDistinctSkillTypes,
  getSkillHitInfoBatch,
} from "../magic";
import {
  getItemIconMap,
  getItemIcon,
  getNpcImageMap,
  getNpcImage,
} from "../images";
import { getMissionDialogue, getMessageNode } from "../messages";
import {
  getAllMissionGroupStats,
  getAllMissionListItems,
  getMissionDetail,
  getMissionsUsingItem,
} from "../missions";
import { getStagesForMonster, getStagesForMonsters, getMonstersAtStage } from "../monster-spawns";
import {
  parseDropItem,
  getMonstersByDropItem,
  getMonsters,
  getMonsterById,
  getDropsForMonster,
  getDistinctMonsterTypes,
  getDistinctElementals,
} from "../monsters";
import { getShops, getShopDetail, getShopsSellingItem, getShopsBuyingItem } from "../shops";
import {
  getAllStageNames,
  getAllStageGroupStats,
  getAllStageListItems,
  getStageDetail,
  getMissionsAtStage,
} from "../stages";
import { getStatusById } from "../status";
import type { Item } from "@/lib/types/item";
import type { CompoundRow } from "@/lib/types/compound";

/**
 * Schema 冒煙測試。
 *
 * 目的：better-sqlite3 在 `.prepare()` 當下就編譯 SQL，欄位/資料表改名會當場 throw。
 * 這支測試把 src/lib/queries/*.ts 每一支 export 函式都跑一次（含會依參數組出
 * 不同 SQL 的分支），只斷言「不 throw」——不驗證回傳值是否符合業務預期
 * （那是各檔既有測試的責任），純粹守住查詢層跟 tthol.sqlite 實際 schema 對得上。
 *
 * 以下常數皆為從 tthol.sqlite 撈出的真實存在的 id/值，用來讓每條 SQL 分支
 * 真的被 prepare 到（例如 IN (...) 或 JOIN 的查詢，空陣列/找不到的 id 會提早
 * return 而跳過 db.prepare()，起不到守住 schema 的作用）。
 */

// items
const REAL_ITEM_ID = 20001; // 有對應 item_rand、shop_sells、shop_buys
const REAL_ITEM_TYPE = "HORSE"; // items.type_name 真實存在的值（>0 筆）

// monsters / npc
const REAL_MONSTER_ID = 5011; // npc.type>0、有 elemental、monsters.drop_item 非空
const REAL_MONSTER_TYPE = 14;
const REAL_ELEMENTAL = "無";
const DROP_ITEM_ID = 26024; // 出現在 monster 5011 drop_item 裡的 item id

// missions / stages
const REAL_MISSION_ID = 1; // mission_refs 同時有 item / map(npc>0) 兩種 ref_type，且有對話 trigger 連結
const REAL_MISSION_ITEM_ID = 20007; // 被某任務 ref 到的 item id
const STAGE_ID_WITH_GROUP = 1; // stages.group 非 null，且有 monster_spawns / mission_refs 命中
const STAGE_ID_WITH_APPEAR = 25; // appear_map1 / appear_map2 非 0

// compound
const COMPOUND_GROUP_ID = 70; // compound_groups 真實存在且底下有 ITEM_COMPOUND_EQUIPMENT 配方
const COMPOUND_TYPE = "ITEM_COMPOUND_EQUIPMENT";
const COMPOUND_ID = 10001;
const CORE_MATERIAL_ITEM_ID = 25320; // compounds.material_core_id 真實值
const CREATEITEM_PRODUCED_ITEM_ID = 21911; // 由 ITEM_BONUS_CREATEITEM 產出的 item id
const EQUIPMENT_ITEM_TYPE = "刀"; // EQUIPMENT_SLOT_BY_TYPE 的 key，對應 slot 1

// magic
const REAL_MAGIC_ID = 5;
const REAL_MAGIC_NAME = "推宮活血";
const REAL_MAGIC_LEVEL = 1;
const REAL_CLAN = "CLASS_CHILD";
const REAL_TARGET = "TARGET_ALLY";
const REAL_SKILL_TYPE = 6;

// shops / status / messages
const REAL_SHOP_ID = 9; // 同時有 shop_sells 與 shop_buys
const REAL_STATUS_ID = 1;
const REAL_FILE_NO = 1;
const REAL_MSG_ID = 1;

describe("achievements.ts", () => {
  it("getAchievementCategories", () => {
    expect(() => getAchievementCategories()).not.toThrow();
  });

  it("getAchievementsByCategory", () => {
    expect(() => getAchievementsByCategory(1)).not.toThrow();
  });

  it("getAchievementsWithRewards", () => {
    expect(() => getAchievementsWithRewards()).not.toThrow();
  });

  it("searchAchievements（非空關鍵字才會真的 prepare）", () => {
    expect(() => searchAchievements("初")).not.toThrow();
  });
});

describe("awakening.ts", () => {
  it("levelToGenPrefix", () => {
    expect(() => levelToGenPrefix(80)).not.toThrow();
  });

  it("itemTypeToSlotPrefix", () => {
    expect(() => itemTypeToSlotPrefix("劍")).not.toThrow();
  });

  it("getAwakeningPath（level+type 組成有效 slot，實際命中 strong_formula）", () => {
    const item: Item = {
      id: 1,
      name: "測試武器",
      note: null,
      type: "劍",
      summary: null,
      level: 20,
      weight: 0,
      hp: 0,
      mp: 0,
      str: 0,
      pow: 0,
      vit: 0,
      dex: 0,
      agi: 0,
      wis: 0,
      atk: 0,
      matk: 0,
      def: 0,
      mdef: 0,
      dodge: 0,
      uncanny_dodge: 0,
      critical: 0,
      hit: 0,
      speed: 0,
      fire: 0,
      water: 0,
      thunder: 0,
      tree: 0,
      freeze: 0,
      min_damage: 0,
      max_damage: 0,
      min_pdamage: 0,
      max_pdamage: 0,
      picture: 0,
      icon: 0,
      value: 0,
      durability: 0,
    };
    expect(() => getAwakeningPath(item)).not.toThrow();
  });
});

describe("compound.ts", () => {
  it("parseMaterialItems", () => {
    expect(() => parseMaterialItems('[{"id":1,"amount":1}]')).not.toThrow();
  });

  it("parseModProb", () => {
    expect(() =>
      parseModProb('[{"type":"ITEM_BONUS_ATK","min":6,"max":6,"prob":150000}]'),
    ).not.toThrow();
  });

  it("rowToCompound", () => {
    const row: CompoundRow = {
      id: COMPOUND_ID,
      type: COMPOUND_TYPE,
      name: "測試配方",
      level: 20,
      group: COMPOUND_GROUP_ID,
      money: 100,
      material_core_id: CORE_MATERIAL_ITEM_ID,
      material_core_amount: 1,
      material_items: '[{"id":1,"amount":1}]',
      fail_item_id: null,
      fail_item_amount: null,
      mod_count_min: 1,
      mod_count_max: 1,
      mod_prob: '[{"type":"ITEM_BONUS_ATK","min":6,"max":6,"prob":150000}]',
      equip_crash: 0,
      help: null,
    };
    expect(() => rowToCompound(row)).not.toThrow();
  });

  it("getCompoundGroups", () => {
    expect(() => getCompoundGroups()).not.toThrow();
  });

  it("getCompoundGroupById", () => {
    expect(() => getCompoundGroupById(COMPOUND_GROUP_ID)).not.toThrow();
  });

  it("getCompoundById", () => {
    expect(() => getCompoundById(COMPOUND_ID)).not.toThrow();
  });

  it("getCompoundsByGroup", () => {
    expect(() => getCompoundsByGroup(COMPOUND_GROUP_ID)).not.toThrow();
  });

  it("getCompoundsByType", () => {
    expect(() => getCompoundsByType(COMPOUND_TYPE)).not.toThrow();
  });

  it("getCompoundsByCoreMaterial", () => {
    expect(() => getCompoundsByCoreMaterial(CORE_MATERIAL_ITEM_ID)).not.toThrow();
  });

  it("getCompoundsByGroupEnriched", () => {
    expect(() => getCompoundsByGroupEnriched(COMPOUND_GROUP_ID)).not.toThrow();
  });

  it("getAllCompoundGroupsWithStats", () => {
    expect(() => getAllCompoundGroupsWithStats()).not.toThrow();
  });

  it("getCompoundUsesForItem", () => {
    expect(() => getCompoundUsesForItem(CORE_MATERIAL_ITEM_ID)).not.toThrow();
  });

  it("getEquipmentSlotForType", () => {
    expect(() => getEquipmentSlotForType(EQUIPMENT_ITEM_TYPE)).not.toThrow();
  });

  it("getEquipmentEnhancementsForItemType（有效 slot，實際 prepare JOIN）", () => {
    expect(() => getEquipmentEnhancementsForItemType(EQUIPMENT_ITEM_TYPE)).not.toThrow();
  });

  it("getCompoundSourcesForItem", () => {
    expect(() => getCompoundSourcesForItem(CREATEITEM_PRODUCED_ITEM_ID)).not.toThrow();
  });
});

describe("items.ts", () => {
  it("getItems — 無參數（預設分支）", () => {
    expect(() => getItems()).not.toThrow();
  });

  it("getItems — search 為數字（id OR name LIKE 分支）", () => {
    expect(() => getItems({ search: String(REAL_ITEM_ID) })).not.toThrow();
  });

  it("getItems — search 為文字（name LIKE 分支）", () => {
    expect(() => getItems({ search: "銀兩" })).not.toThrow();
  });

  it("getItems — 帶 type（WHERE type_name = 分支）", () => {
    expect(() => getItems({ type: REAL_ITEM_TYPE })).not.toThrow();
  });

  it("getItems — 帶 sortBy=level/sortDir（allowlist 命中分支）", () => {
    expect(() => getItems({ sortBy: "level", sortDir: "asc" })).not.toThrow();
  });

  it("getItems — 帶 sortBy=weight", () => {
    expect(() => getItems({ sortBy: "weight", sortDir: "desc" })).not.toThrow();
  });

  it("getItems — 帶 sortBy=id", () => {
    expect(() => getItems({ sortBy: "id", sortDir: "asc" })).not.toThrow();
  });

  it("getItemById", () => {
    expect(() => getItemById(REAL_ITEM_ID)).not.toThrow();
  });

  it("getItemRands", () => {
    expect(() => getItemRands(String(REAL_ITEM_ID))).not.toThrow();
  });

  it("getItemsByType", () => {
    expect(() => getItemsByType(REAL_ITEM_TYPE)).not.toThrow();
  });

  it("getItemsByIds（非空陣列才會真的 prepare）", () => {
    expect(() => getItemsByIds([REAL_ITEM_ID])).not.toThrow();
  });

  it("getItemRandsByIds（非空陣列才會真的 prepare）", () => {
    expect(() => getItemRandsByIds([REAL_ITEM_ID])).not.toThrow();
  });
});

describe("images.ts", () => {
  it("getItemIcon / getItemIconMap（非空才 prepare）", () => {
    expect(() => getItemIcon(REAL_ITEM_ID)).not.toThrow();
    expect(() => getItemIconMap([REAL_ITEM_ID])).not.toThrow();
  });
  it("getNpcImage / getNpcImageMap（非空才 prepare）", () => {
    expect(() => getNpcImage(REAL_MONSTER_ID)).not.toThrow();
    expect(() => getNpcImageMap([REAL_MONSTER_ID])).not.toThrow();
  });
});

describe("magic.ts", () => {
  it("getSkills — 無參數（預設分支）", () => {
    expect(() => getSkills()).not.toThrow();
  });

  it("getSkills — search 為數字", () => {
    expect(() => getSkills({ search: String(REAL_MAGIC_ID) })).not.toThrow();
  });

  it("getSkills — search 為文字", () => {
    expect(() => getSkills({ search: REAL_MAGIC_NAME })).not.toThrow();
  });

  it("getSkills — 帶 clan", () => {
    expect(() => getSkills({ clan: REAL_CLAN })).not.toThrow();
  });

  it("getSkills — 帶 target", () => {
    expect(() => getSkills({ target: REAL_TARGET })).not.toThrow();
  });

  it("getSkills — 帶 skillType", () => {
    expect(() => getSkills({ skillType: REAL_SKILL_TYPE })).not.toThrow();
  });

  it("getSkills — 帶 sortBy=maxLevel", () => {
    expect(() => getSkills({ sortBy: "maxLevel", sortDir: "desc" })).not.toThrow();
  });

  it("getSkills — 帶 sortBy=id", () => {
    expect(() => getSkills({ sortBy: "id", sortDir: "asc" })).not.toThrow();
  });

  it("getSkillById", () => {
    expect(() => getSkillById(REAL_MAGIC_ID)).not.toThrow();
  });

  it("getSkillRow", () => {
    expect(() => getSkillRow(REAL_MAGIC_ID, REAL_MAGIC_LEVEL)).not.toThrow();
  });

  it("getSkillGroup", () => {
    expect(() => getSkillGroup(REAL_MAGIC_ID, REAL_MAGIC_NAME)).not.toThrow();
  });

  it("getSkillsByClan — 不排除", () => {
    expect(() => getSkillsByClan(REAL_CLAN)).not.toThrow();
  });

  it("getSkillsByClan — 帶 exclude（NOT (id=? AND name=?) 分支）", () => {
    expect(() =>
      getSkillsByClan(REAL_CLAN, { id: REAL_MAGIC_ID, name: REAL_MAGIC_NAME }),
    ).not.toThrow();
  });

  it("getDistinctClans", () => {
    expect(() => getDistinctClans()).not.toThrow();
  });

  it("getDistinctTargets", () => {
    expect(() => getDistinctTargets()).not.toThrow();
  });

  it("getDistinctSkillTypes", () => {
    expect(() => getDistinctSkillTypes()).not.toThrow();
  });

  it("getSkillHitInfoBatch（非空陣列才會真的 prepare）", () => {
    expect(() =>
      getSkillHitInfoBatch([{ id: REAL_MAGIC_ID, name: REAL_MAGIC_NAME, firstLevel: REAL_MAGIC_LEVEL }]),
    ).not.toThrow();
  });
});

describe("messages.ts", () => {
  it("getMissionDialogue（有對話 trigger 連結，實際跑到 msgRows/optRows 查詢）", () => {
    expect(() => getMissionDialogue(REAL_MISSION_ID)).not.toThrow();
  });

  it("getMessageNode", () => {
    expect(() => getMessageNode(REAL_FILE_NO, REAL_MSG_ID)).not.toThrow();
  });
});

describe("missions.ts", () => {
  it("getAllMissionGroupStats", () => {
    expect(() => getAllMissionGroupStats()).not.toThrow();
  });

  it("getAllMissionListItems", () => {
    expect(() => getAllMissionListItems()).not.toThrow();
  });

  it("getMissionDetail（同時命中 item / npc / map 三種 ref 回查分支）", () => {
    expect(() => getMissionDetail(REAL_MISSION_ID)).not.toThrow();
  });

  it("getMissionsUsingItem", () => {
    expect(() => getMissionsUsingItem(REAL_MISSION_ITEM_ID)).not.toThrow();
  });
});

describe("monster-spawns.ts", () => {
  it("getStagesForMonster", () => {
    expect(() => getStagesForMonster(REAL_MONSTER_ID)).not.toThrow();
  });

  it("getStagesForMonsters（非空陣列才會真的 prepare）", () => {
    expect(() => getStagesForMonsters([REAL_MONSTER_ID])).not.toThrow();
  });

  it("getMonstersAtStage", () => {
    expect(() => getMonstersAtStage("stage", STAGE_ID_WITH_GROUP)).not.toThrow();
  });
});

describe("monsters.ts", () => {
  it("parseDropItem", () => {
    expect(() => parseDropItem('["1","1","20001","100"]')).not.toThrow();
  });

  it("getMonstersByDropItem", () => {
    expect(() => getMonstersByDropItem(DROP_ITEM_ID)).not.toThrow();
  });

  it("getMonsters — 無參數（預設分支）", () => {
    expect(() => getMonsters()).not.toThrow();
  });

  it("getMonsters — search 為數字", () => {
    expect(() => getMonsters({ search: String(REAL_MONSTER_ID) })).not.toThrow();
  });

  it("getMonsters — search 為文字", () => {
    expect(() => getMonsters({ search: "波波鼠" })).not.toThrow();
  });

  it("getMonsters — 帶 type", () => {
    expect(() => getMonsters({ type: REAL_MONSTER_TYPE })).not.toThrow();
  });

  it("getMonsters — 帶 elemental", () => {
    expect(() => getMonsters({ elemental: REAL_ELEMENTAL })).not.toThrow();
  });

  it("getMonsters — 帶 hasDrop", () => {
    expect(() => getMonsters({ hasDrop: true })).not.toThrow();
  });

  it("getMonsters — 帶 isNormal", () => {
    expect(() => getMonsters({ isNormal: true })).not.toThrow();
  });

  it("getMonsters — 帶 sortBy=level/hp/id", () => {
    expect(() => getMonsters({ sortBy: "level", sortDir: "asc" })).not.toThrow();
    expect(() => getMonsters({ sortBy: "hp", sortDir: "desc" })).not.toThrow();
    expect(() => getMonsters({ sortBy: "id", sortDir: "asc" })).not.toThrow();
  });

  it("getMonsterById", () => {
    expect(() => getMonsterById(REAL_MONSTER_ID)).not.toThrow();
  });

  it("getDropsForMonster（drop_item 非空，實際跑到 items IN(...) 查詢）", () => {
    expect(() => getDropsForMonster(REAL_MONSTER_ID)).not.toThrow();
  });

  it("getDistinctMonsterTypes", () => {
    expect(() => getDistinctMonsterTypes()).not.toThrow();
  });

  it("getDistinctElementals", () => {
    expect(() => getDistinctElementals()).not.toThrow();
  });
});

describe("shops.ts", () => {
  it("getShops", () => {
    expect(() => getShops()).not.toThrow();
  });

  it("getShopDetail（同時有 sells 與 buys）", () => {
    expect(() => getShopDetail(REAL_SHOP_ID)).not.toThrow();
  });

  it("getShopsSellingItem", () => {
    expect(() => getShopsSellingItem(REAL_ITEM_ID)).not.toThrow();
  });

  it("getShopsBuyingItem", () => {
    expect(() => getShopsBuyingItem(REAL_ITEM_ID)).not.toThrow();
  });
});

describe("stages.ts", () => {
  it("getAllStageNames", () => {
    expect(() => getAllStageNames()).not.toThrow();
  });

  it("getAllStageGroupStats", () => {
    expect(() => getAllStageGroupStats()).not.toThrow();
  });

  it("getAllStageListItems", () => {
    expect(() => getAllStageListItems()).not.toThrow();
  });

  it("getStageDetail — group 非 null（siblings 查詢分支）", () => {
    expect(() => getStageDetail(STAGE_ID_WITH_GROUP)).not.toThrow();
  });

  it("getStageDetail — appear_map1/2 非 0（nameLookup IN(...) 查詢分支）", () => {
    expect(() => getStageDetail(STAGE_ID_WITH_APPEAR)).not.toThrow();
  });

  it("getMissionsAtStage", () => {
    expect(() => getMissionsAtStage(STAGE_ID_WITH_GROUP)).not.toThrow();
  });
});

describe("status.ts", () => {
  it("getStatusById", () => {
    expect(() => getStatusById(REAL_STATUS_ID)).not.toThrow();
  });
});
