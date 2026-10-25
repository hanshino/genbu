// 站內頁面清單的唯一來源：navbar、首頁入口卡片、全站搜尋（頁面類）都從這裡讀。
// 純資料、不 import DB 或 React，client / server 都能安全引用。

export interface NavEntry {
  href: string;
  /** navbar 選單與搜尋結果用的短名稱 */
  label: string;
  /** 首頁卡片標題；沒給就用 label */
  title?: string;
  /** 首頁卡片說明；標題已自明的入口不給，卡片就只顯示標題 */
  description?: string;
  /** 不上首頁卡片（例如 navbar 專用的「工具總覽」） */
  hideOnHome?: boolean;
  /** 搜尋同義詞，使用者不一定打得出正式名稱 */
  keywords?: string[];
  /** navbar 高亮只比對完整路徑，不含子路徑 */
  exact?: boolean;
  /** 組內小分類；同一小分類的入口要相鄰，選單與首頁依序切段並顯示小標 */
  subgroup?: string;
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
        subgroup: "圖鑑",
      },
      {
        href: "/skills",
        label: "技能",
        description: "14 門派技能與成長",
        keywords: ["武功", "門派"],
        subgroup: "圖鑑",
      },
      {
        href: "/monsters",
        label: "怪物",
        description: "等級、屬性、掉落",
        keywords: ["掉落", "魔物"],
        subgroup: "圖鑑",
      },
      {
        href: "/heroes",
        label: "英雄",
        description: "相惜組合與隊伍編成",
        keywords: ["相惜"],
        subgroup: "圖鑑",
      },
      {
        href: "/maps",
        label: "地圖",
        description: "怪物分布、NPC 與傳送點",
        keywords: ["場景"],
        subgroup: "地點",
      },
      {
        href: "/npcs",
        label: "NPC",
        title: "NPC 位置",
        description: "出現在哪張地圖、哪個位置",
        keywords: ["位置", "人物"],
        subgroup: "地點",
      },
      {
        href: "/training-spots",
        label: "練功地圖",
        description: "輸入等級，找適合的野外練功點",
        keywords: ["練功", "練等", "升級"],
        subgroup: "地點",
      },
      {
        href: "/shops",
        label: "商店",
        description: "販售與收購價",
        keywords: ["商店", "購買", "收購"],
        subgroup: "地點",
      },
      {
        href: "/missions",
        label: "任務",
        description: "任務步驟、所需物品、地點與 NPC",
        keywords: ["劇情"],
        subgroup: "任務與養成",
      },
      {
        href: "/compounds",
        label: "煉化",
        description: "煉化配方與所需材料",
        keywords: ["煉化", "合成"],
        subgroup: "任務與養成",
      },
      {
        href: "/zhenjie",
        label: "真解",
        description: "70 本真解的星數、強度範圍與加成數值",
        keywords: ["真解", "技能強化"],
        subgroup: "任務與養成",
      },
      {
        href: "/achievements",
        label: "成就",
        description: "1,200+ 成就的點數、描述與獎勵",
        subgroup: "任務與養成",
      },
    ],
  },
  {
    label: "配裝",
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
      { href: "/tools", label: "工具總覽", exact: true, hideOnHome: true, keywords: ["工具"] },
      {
        href: "/tools/enhance",
        label: "強化配方反查",
        description: "依屬性反查真元、魂石強化配方與機率",
        keywords: ["強化", "真元", "魂石", "強化查詢"],
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

/** 依 subgroup 把入口切段（相鄰同名為一段）；沒有 subgroup 的整組是一段、標題為 null。 */
export function splitSubgroups(items: NavEntry[]): { label: string | null; items: NavEntry[] }[] {
  const out: { label: string | null; items: NavEntry[] }[] = [];
  for (const item of items) {
    const label = item.subgroup ?? null;
    const last = out.at(-1);
    if (last && last.label === label) last.items.push(item);
    else out.push({ label, items: [item] });
  }
  return out;
}
