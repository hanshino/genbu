export type GuideSourceTier = "database" | "official" | "field-test" | "community";

export type GuideCategory = "items" | "equipment" | "skills" | "monsters" | "tools";

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
          "對應 repo 現有 src/lib/queries/monsters.ts 的 npc 與 monsters 查詢，以及 src/components/monsters/monster-drop-table.tsx：怪物列表可依 level 篩選，怪物詳情以 npc 為主並連結 monsters.drop_item；掉落表可切換原始掉落權重與以包含 itemId=0 空槽的 totalWeight 計算之百分比。此百分比是現有資料表權重換算，不等同官方公告保證。",
      },
      {
        id: "database-spawns",
        title: "repo 怪物出沒查詢",
        tier: "database",
        lastVerified: "2026-08-13",
        evidence:
          "對應 repo 現有 src/lib/queries/monster-spawns.ts 的 monster_spawns 與 stages JOIN：可列出怪物出現的 stage 名稱與出現點數。",
      },
    ],
    sections: [
      {
        title: "按等級找怪",
        paragraphs: [
          "輸入名稱或編號，也可以設定等級下限與上限。列表的等級是資料庫 npc 表的 level；先用角色目前能處理的等級範圍縮小清單，再逐筆查看怪物詳情。",
        ],
        links: [{ label: "開啟怪物查詢", href: "/monsters" }],
        sourceIds: ["database-monsters"],
      },
      {
        title: "查看出沒地圖與掉落",
        paragraphs: [
          "開啟怪物詳情頁，可查看該怪物在資料中的出沒 stage，以及 monsters 表提供的掉落資料。地圖名稱來自 stages，掉落物名稱與資料來自資料庫關聯；可切換原始掉落權重與依含空槽 totalWeight 計算的百分比。百分比是現有資料表權重換算，不等同官方公告保證。",
        ],
        links: [
          { label: "開啟怪物查詢", href: "/monsters" },
          { label: "前往地圖查詢", href: "/maps" },
        ],
        sourceIds: ["database-monsters", "database-spawns"],
      },
      {
        title: "資料限制",
        paragraphs: [
          "這是以 repo 目前匯入的 SQLite 資料為準的查詢指南。資料庫沒有記錄每位玩家的實際擊殺速度、路線成本或完整戰鬥條件，因此不能由這些欄位推論最佳練功效率；等級與掉落資料也不代表遊戲中所有可能的變動。",
        ],
        sourceIds: ["database-monsters", "database-spawns"],
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
