export type GuideSourceTier = "database" | "official" | "field-test" | "community";

export type GuideCategory =
  | "items"
  | "equipment"
  | "skills"
  | "monsters"
  | "missions"
  | "tools";

export interface GuideSource {
  id: string;
  title: string;
  tier: GuideSourceTier;
  lastVerified: string;
  evidence: string;
  url?: string;
}

export interface GuideSection {
  title: string;
  paragraphs: string[];
  links?: { label: string; href: string }[];
  sourceIds: string[];
}

export interface Guide {
  slug: string;
  title: string;
  category: GuideCategory;
  status: "published" | "draft";
  summary: string;
  sources: GuideSource[];
  sections: GuideSection[];
}

export const guides: Guide[] = [
  {
    slug: "monster-drops-training",
    title: "按等級查找怪物、出沒地圖與掉落",
    category: "monsters",
    status: "published",
    summary: "使用現有 SQLite 怪物、出沒與掉落資料，依等級查找目標並查看詳情。",
    sources: [
      {
        id: "database-monsters",
        title: "repo 怪物與掉落查詢",
        tier: "database",
        lastVerified: "2026-08-13",
        evidence:
          "對應 repo 現有 src/lib/queries/monsters.ts:120-220、238-281 與 src/components/monsters/monster-drop-table.tsx:41-117：怪物列表可依 level 篩選，怪物詳情以 npc 為主並連結 monsters.drop_item；掉落表可切換原始掉落權重與以包含 itemId=0 空槽的 totalWeight 計算之百分比。此百分比是現有資料表權重換算，不等同官方公告保證。",
      },
      {
        id: "database-spawns",
        title: "repo 怪物出沒查詢",
        tier: "database",
        lastVerified: "2026-08-13",
        evidence:
          "對應 repo 現有 src/lib/queries/monster-spawns.ts:5-28 的 monster_spawns 與 stages JOIN，以及 src/app/maps/[id]/page.tsx:247-250：可列出怪物出現的 stage 名稱與出現點數；GENERATOR.OBD 解析的怪物清單不含劇情觸發或關卡腳本生成的怪物。",
      },
    ],
    sections: [
      {
        title: "按等級找怪",
        paragraphs: [
          "輸入名稱或編號，也可以設定等級下限與上限。列表的等級是資料庫 npc 表的 level；例如使用 40 至 60 級且有掉落的條件縮小清單，再逐筆查看怪物詳情。這是查詢工具，不是最佳練功排行。",
        ],
        links: [
          { label: "查找 40–60 級有掉落怪物", href: "/monsters?levelMin=40&levelMax=60&hasDrop=1" },
          { label: "查找所有有掉落怪物", href: "/monsters?hasDrop=1" },
        ],
        sourceIds: ["database-monsters"],
      },
      {
        title: "查看出沒地圖與掉落",
        paragraphs: [
          "開啟怪物詳情頁，可查看該怪物在資料中的出沒 stage，以及 monsters 表提供的掉落資料。地圖名稱來自 stages，掉落物名稱與資料來自資料庫關聯；可切換原始掉落權重與依含空槽 totalWeight 計算的百分比。這個百分比是現有資料表權重換算，不等同官方公告保證；道具頁則保留反查來源時的 raw rate。",
        ],
        links: [
          { label: "開啟怪物查詢", href: "/monsters" },
          { label: "前往地圖查詢", href: "/maps" },
          { label: "前往道具查詢", href: "/items" },
        ],
        sourceIds: ["database-monsters", "database-spawns"],
      },
      {
        title: "資料限制",
        paragraphs: [
          "這是以 repo 目前匯入的 SQLite 資料為準的查詢指南。GENERATOR.OBD 不含劇情觸發或關卡腳本生成的怪物；資料庫也沒有記錄每位玩家的實際擊殺速度、路線成本或完整戰鬥條件，因此不能由這些欄位推論最佳練功效率或形成最佳練功排行。",
        ],
        sourceIds: ["database-monsters", "database-spawns"],
      },
    ],
  },
  {
    slug: "equipment-progression",
    title: "裝備取得與強化資料查詢",
    category: "equipment",
    status: "published",
    summary: "依掉落、商店、任務、煉化與覺醒資料整理裝備查詢路徑，不宣稱唯一最佳方案。",
    sources: [
      {
        id: "database-equipment-progression",
        title: "repo 裝備取得、煉化與 scoring 查詢",
        tier: "database",
        lastVerified: "2026-08-13",
        evidence:
          "對應 repo 現有 src/lib/queries/monsters.ts:43-69 的掉落道具反查、src/lib/queries/shops.ts:96-121 的 real_price/收購 rate、src/lib/queries/missions.ts:176-192 的 MAX(mr.qty)、src/lib/queries/compound.ts:283-325 的單次輸出機率、src/lib/queries/awakening.ts:77-147 的 strong_formula 覺醒階段/金錢/材料/成功率/bonus，以及 src/lib/scoring/score.ts:10-24 的本站加權 scoring model。",
      },
    ],
    sections: [
      {
        title: "先找取得來源",
        paragraphs: [
          "可先從道具查詢確認裝備，再反查哪些怪物掉落；也可查看商店與任務資料。商店售價使用 real_price，收購資料保留 rate；這些欄位可用來比較資料，不代表唯一最佳取得方式。",
        ],
        links: [
          { label: "道具查詢", href: "/items" },
          { label: "反查有掉落的怪物", href: "/monsters?hasDrop=1" },
          { label: "商店查詢", href: "/shops" },
          { label: "任務查詢", href: "/missions" },
        ],
        sourceIds: ["database-equipment-progression"],
      },
      {
        title: "煉化、覺醒與本站比較",
        paragraphs: [
          "煉化輸出以資料中的單次機率呈現；覺醒資料則可查看資料庫提供的階段、金錢、材料、成功率與 bonus。本站 scoring model 是加權比較模型，用於本站的 ranking 與 compare，不是遊戲官方評分，也不推導唯一最佳裝備。",
        ],
        links: [
          { label: "煉化查詢", href: "/compounds" },
          { label: "HORSE ranking", href: "/ranking?type=HORSE" },
          { label: "WING ranking", href: "/ranking?type=WING" },
          { label: "比較座騎", href: "/compare?type=HORSE" },
          { label: "比較背飾", href: "/compare?type=WING" },
        ],
        sourceIds: ["database-equipment-progression"],
      },
    ],
  },
  {
    slug: "mission-dungeon",
    title: "任務、地圖與副本工具資料界線",
    category: "missions",
    status: "published",
    summary: "用任務 refs 與地圖資料查核需求，並分清資料推斷、地圖 placement 與副本工具的界線。",
    sources: [
      {
        id: "database-mission-dungeon",
        title: "repo 任務、地圖與副本資料",
        tier: "database",
        lastVerified: "2026-08-13",
        evidence:
          "對應 repo 現有 src/lib/queries/missions.ts:46-173 的任務 refs、道具/地圖回查與逐步資料、src/lib/queries/missions.ts:176-192 的任務物品 MAX(qty)、src/app/maps/[id]/page.tsx:247-250 的 GENERATOR.OBD 限制，以及 src/app/tools/160/page.tsx、src/app/tools/175/page.tsx、src/app/tools/180/page.tsx 的三個解題工具路由。",
      },
    ],
    sections: [
      {
        title: "任務需求與地圖",
        paragraphs: [
          "任務詳情可依 mission refs 查看物品、地圖與 NPC 參照；同一道具在任務中的需求量以 MAX(qty) 彙整。約 88–93% 的對話推斷只能當作由任務文字與 refs 推得的範圍，不能當成資料庫明載的精確劇情結論。地圖上的 placement 是資料位置，不是角色移動路徑。",
        ],
        links: [
          { label: "任務查詢", href: "/missions" },
          { label: "地圖查詢", href: "/maps" },
          { label: "道具查詢", href: "/items" },
        ],
        sourceIds: ["database-mission-dungeon"],
      },
      {
        title: "副本工具的界線",
        paragraphs: [
          "160、175、180 工具分別處理已知的解題輸入，不是完整副本流程，也不是官方認證的攻略或效率保證。GENERATOR.OBD 解析的怪物清單同樣不含劇情觸發或關卡腳本生成的怪物。",
        ],
        links: [
          { label: "副本工具總覽", href: "/tools" },
          { label: "160 工具", href: "/tools/160" },
          { label: "175 工具", href: "/tools/175" },
          { label: "180 工具", href: "/tools/180" },
        ],
        sourceIds: ["database-mission-dungeon"],
      },
    ],
  },
];

export function getPublishedGuides(): Guide[] {
  return guides.filter((guide) => guide.status === "published");
}

export function getGuideBySlug(slug: string): Guide | undefined {
  return guides.find((guide) => guide.slug === slug);
}
