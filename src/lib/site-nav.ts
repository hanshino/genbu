// 站內頁面清單的唯一來源：navbar、首頁入口卡片、全站搜尋（頁面類）都從這裡讀。
// 純資料、不 import DB 或 React，client / server 都能安全引用。

export interface NavEntry {
  href: string;
  /** navbar 選單與搜尋結果用的短名稱 */
  label: string;
  /** 首頁卡片標題；沒給就用 label */
  title?: string;
  /** 首頁卡片說明；沒給代表首頁不顯示這個入口（例如 navbar 專用的「工具總覽」） */
  description?: string;
  /** 搜尋同義詞，使用者不一定打得出正式名稱 */
  keywords?: string[];
  /** navbar 高亮只比對完整路徑，不含子路徑 */
  exact?: boolean;
}

export interface NavSection {
  label: string;
  items: NavEntry[];
  /** 整組共用的路徑前綴，落在底下任何頁面（例如沒列在選單裡的文章頁）時整組亮起 */
  match?: string;
  /** 只有真的有總覽頁的組才給，首頁標題旁會出現「全部」連結 */
  overview?: string;
}

export const NAV_SECTIONS: NavSection[] = [
  {
    label: "資料庫",
    items: [
      {
        href: "/items",
        label: "道具",
        description: "13,000+ 道具的屬性、隨機詞條、掉落來源",
        keywords: ["裝備", "物品"],
      },
      {
        href: "/skills",
        label: "技能",
        description: "14 門派技能瀏覽、等級成長對照",
        keywords: ["武功", "門派"],
      },
      {
        href: "/monsters",
        label: "怪物",
        description: "等級、屬性、掉落反查一次找齊",
        keywords: ["掉落", "魔物"],
      },
      {
        href: "/heroes",
        label: "英雄",
        description: "英雄清單、相惜組合，還能試排隊伍編成",
        keywords: ["相惜"],
      },
      {
        href: "/missions",
        label: "任務",
        description: "任務步驟、所需物品、地點與 NPC",
        keywords: ["劇情"],
      },
      {
        href: "/maps",
        label: "地圖",
        description: "全部場景地圖、所屬區域與屬性",
        keywords: ["場景"],
      },
      {
        href: "/npcs",
        label: "NPC",
        title: "NPC 位置",
        description: "搜尋 NPC 名稱，查它出現在哪些地圖",
        keywords: ["位置", "人物"],
      },
      {
        href: "/training-spots",
        label: "練功地圖",
        description: "輸入等級，找適合練功的地圖",
        keywords: ["練功", "練等", "升級"],
      },
      {
        href: "/compounds",
        label: "煉化",
        description: "煉化配方來源、產出與機率",
        keywords: ["煉化", "合成"],
      },
      {
        href: "/achievements",
        label: "成就",
        description: "1,200+ 成就的點數、描述與獎勵",
      },
      {
        href: "/shops",
        label: "商店",
        description: "NPC 商店販售與收購價，查哪裡買得到",
        keywords: ["商店", "購買", "收購"],
      },
    ],
  },
  {
    label: "裝備",
    items: [
      {
        href: "/ranking",
        label: "排行榜",
        description: "七大流派加權，可調權重與等級區間",
        keywords: ["排行", "加權", "流派"],
      },
      {
        href: "/compare",
        label: "比較",
        description: "多件座騎／背飾的雷達圖與流派分數並排看",
        keywords: ["比較", "雷達", "座騎", "背飾"],
      },
    ],
  },
  {
    label: "工具",
    overview: "/tools",
    items: [
      { href: "/tools", label: "工具總覽", exact: true, keywords: ["工具"] },
      {
        href: "/tools/enhance",
        label: "強化查詢",
        description: "依屬性反查真元、魂石強化配方與機率",
        keywords: ["強化", "真元", "魂石"],
      },
      {
        href: "/tools/160",
        label: "160 迷霧九宮格",
        description: "輸入總和與關閉房間，推算水晶數",
        keywords: ["160", "迷霧", "九宮格"],
      },
      {
        href: "/tools/175",
        label: "175 北斗七星",
        description: "輸入數字，算出七顆星的開關",
        keywords: ["175", "北斗", "七星"],
      },
      {
        href: "/tools/180",
        label: "180 神武禁地",
        description: "輸入總和與封印數字，列出所有排法",
        keywords: ["180", "神武禁地", "封印"],
      },
      {
        href: "/tools/salon",
        label: "易容閣",
        description: "試穿外觀、坐騎與染髮，可分享連結",
        keywords: ["易容", "外觀", "時裝", "染髮", "坐騎", "試穿"],
      },
      {
        href: "/tools/meridian",
        label: "經脈模擬器",
        description: "還沒 180 等也能先試打通、規劃配點",
        keywords: ["經脈", "穴位", "配點"],
      },
      {
        href: "/tools/stat-sim",
        label: "屬性模擬器",
        description: "填配點、裝備與被動，算出角色面板",
        keywords: ["屬性", "面板", "配點", "傷害", "模擬"],
      },
      {
        href: "/idle",
        label: "摸魚練功房",
        description: "放置型小遊戲：角色自動打怪升級，離線也會累積",
        keywords: ["放置", "掛機", "練功", "摸魚", "遊戲"],
      },
    ],
  },
  {
    label: "攻略",
    match: "/guides",
    items: [
      {
        href: "/guides",
        label: "修行路線",
        exact: true,
        description: "照等級走：從創角、轉副門派、進階任務到轉生，每一站該做什麼",
        keywords: ["修行", "路線", "新手", "轉生"],
      },
      {
        href: "/guides/dungeons",
        label: "迷宮攻略",
        description: "各迷宮的走法整理，搭配 160／175／180 解謎工具",
        keywords: ["迷宮", "副本"],
      },
    ],
  },
];

export const HOME_LINK: NavEntry = { href: "/", label: "首頁" };
export const CHANGELOG_LINK: NavEntry = {
  href: "/changelog",
  label: "更新紀錄",
  keywords: ["更新"],
};
export const ABOUT_LINK: NavEntry = { href: "/about", label: "關於", keywords: ["關於"] };

// 不放進 navbar / 首頁、只讓搜尋找得到的頁面
const SEARCH_ONLY_PAGES: { section: string; entry: NavEntry }[] = [
  {
    section: "資料庫",
    entry: {
      href: "/heroes/team-builder",
      label: "英雄編成",
      keywords: ["編成", "隊伍", "相惜", "英雄"],
    },
  },
];

export interface SearchablePage extends NavEntry {
  /** 所屬分組名稱，搜尋結果右側灰字用 */
  section: string;
}

/** 全部可被搜尋的頁面（已依 href 去重）。 */
export function getSearchablePages(): SearchablePage[] {
  const pages: SearchablePage[] = [
    ...NAV_SECTIONS.flatMap((s) => s.items.map((entry) => ({ ...entry, section: s.label }))),
    ...SEARCH_ONLY_PAGES.map((p) => ({ ...p.entry, section: p.section })),
    { ...CHANGELOG_LINK, section: "站內" },
    { ...ABOUT_LINK, section: "站內" },
  ];
  const seen = new Set<string>();
  return pages.filter((p) => !seen.has(p.href) && seen.add(p.href));
}
