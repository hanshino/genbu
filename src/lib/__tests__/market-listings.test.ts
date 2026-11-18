import { describe, expect, it } from "vitest";
import {
  STALE_AFTER_SECONDS,
  baseAttributes,
  groupByStall,
  isIndividualListing,
  isOwnerHash,
  isStale,
  listingStateText,
  mergeStacks,
  normalizeSearchParams,
  parseListingData,
  pickDefaultServer,
  priceScale,
  shownListingCount,
  summarizeByItem,
  switchServerParams,
  type MarketListing,
} from "@/lib/market-listings";
import type { Item } from "@/lib/types/item";

function listing(overrides: Partial<MarketListing> = {}): MarketListing {
  return {
    ownerHash: "a",
    itemId: 100,
    price: 1000,
    count: 1,
    strengthen: 0,
    stats: [],
    stones: [],
    bindsLeft: null,
    refineLeft: null,
    zhenjie: false,
    sign: "招牌",
    name: "攤主",
    ...overrides,
  };
}

describe("isStale", () => {
  const now = 1_800_000_000_000;
  it("3 小時內不算過期，超過才算", () => {
    expect(isStale(now / 1000 - 23 * 60, now)).toBe(false);
    expect(isStale(now / 1000 - STALE_AFTER_SECONDS, now)).toBe(false);
    expect(isStale(now / 1000 - STALE_AFTER_SECONDS - 1, now)).toBe(true);
  });
});

describe("priceScale", () => {
  it("沒有掛單回 null", () => {
    expect(priceScale([])).toBeNull();
  });

  it("只有一筆或全部同價時退回單一價格", () => {
    expect(priceScale([500])).toEqual({ kind: "single", price: 500, count: 1 });
    expect(priceScale([500, 500, 500])).toEqual({ kind: "single", price: 500, count: 3 });
  });

  it("左最低右最高線性排，同價依序疊", () => {
    const scale = priceScale([500, 200, 300, 200, 300]);
    expect(scale).toMatchObject({ kind: "range", min: 200, max: 500 });
    const ticks = scale?.kind === "range" ? scale.ticks : [];
    expect(ticks.map((t) => t.stack)).toEqual([0, 1, 0, 1, 0]);
    expect(ticks.map((t) => t.percent)).toEqual([
      0,
      0,
      expect.closeTo(100 / 3),
      expect.closeTo(100 / 3),
      100,
    ]);
  });
});

describe("parseListingData", () => {
  it("壞掉或缺漏的 JSON 一律當作沒有", () => {
    const empty = { stats: [], stones: [], bindsLeft: null, refineLeft: null, zhenjie: false };
    expect(parseListingData(null)).toEqual(empty);
    expect(parseListingData("{oops")).toEqual(empty);
    expect(parseListingData('{"stats": [1], "stones": "x"}')).toEqual(empty);
  });
});

describe("isIndividualListing", () => {
  it("有素質、強化、鑲嵌，或道具本身是裝備，就用卡片", () => {
    expect(isIndividualListing(listing(), "NORMAL_ITEM")).toBe(false);
    expect(isIndividualListing(listing({ stats: [["外功", 0]] }), "NORMAL_ITEM")).toBe(true);
    expect(isIndividualListing(listing({ strengthen: 5 }), null)).toBe(true);
    expect(isIndividualListing(listing({ stones: [1] }), null)).toBe(true);
    expect(isIndividualListing(listing(), "BOOT")).toBe(true);
    expect(isIndividualListing(listing(), "WING")).toBe(true);
  });
});

describe("listingStateText", () => {
  it("綁定、精煉、真解依序串起來；都沒有回 null", () => {
    expect(listingStateText(listing())).toBeNull();
    expect(listingStateText(listing({ bindsLeft: 3, refineLeft: 1 }))).toBe(
      "可綁定 3 次，可精煉 1 次",
    );
    expect(listingStateText(listing({ bindsLeft: 0, refineLeft: 0, zhenjie: true }))).toBe(
      "不可再綁定，不可再精煉，已真解",
    );
  });
});

describe("mergeStacks", () => {
  it("同攤同價合成一列加總數量，不同攤同價不合併", () => {
    const merged = mergeStacks([
      listing({ ownerHash: "a", count: 1 }),
      listing({ ownerHash: "a", count: 2 }),
      listing({ ownerHash: "b", count: 1 }),
      listing({ ownerHash: "a", price: 2000 }),
    ]);
    expect(merged.map((l) => [l.ownerHash, l.price, l.count])).toEqual([
      ["a", 1000, 3],
      ["b", 1000, 1],
      ["a", 2000, 1],
    ]);
  });
});

describe("switchServerParams", () => {
  it("換伺服器保留 view 與 q，丟掉 group、page、stall", () => {
    const params = switchServerParams(
      "server=flower&view=stalls&q=%E5%8A%8D&group=pet&page=3&stall=abc",
      "fish",
    );
    expect(Object.fromEntries(params)).toEqual({ server: "fish", view: "stalls", q: "劍" });
  });

  it("沒有其他條件時只剩 server", () => {
    expect(switchServerParams("", "fish").toString()).toBe("server=fish");
  });
});

describe("pickDefaultServer", () => {
  const entry = (server: "flower" | "fish", n: number) => ({
    server,
    listings: Array.from({ length: n }, () => listing()),
  });

  it("取第一個有掛單的伺服器", () => {
    expect(pickDefaultServer([entry("flower", 0), entry("fish", 2)])).toBe("fish");
    expect(pickDefaultServer([entry("flower", 1), entry("fish", 2)])).toBe("flower");
  });

  it("都沒有掛單時用第一個", () => {
    expect(pickDefaultServer([entry("flower", 0), entry("fish", 0)])).toBe("flower");
  });
});

describe("summarizeByItem / groupByStall", () => {
  const rows = [
    listing({ ownerHash: "a", itemId: 1, price: 300, count: 2 }),
    listing({ ownerHash: "a", itemId: 1, price: 100 }),
    listing({ ownerHash: "b", itemId: 1, price: 200 }),
    listing({ ownerHash: "b", itemId: 2, price: 50, count: 10 }),
  ];

  it("每種道具一列：最低最高價、攤數、件數，依掛單數排", () => {
    expect(summarizeByItem(rows)).toEqual([
      { itemId: 1, min: 100, max: 300, stalls: 2, pieces: 4, listings: 3 },
      { itemId: 2, min: 50, max: 50, stalls: 1, pieces: 10, listings: 1 },
    ]);
  });

  it("每攤一組，依商品筆數排", () => {
    expect(
      groupByStall([...rows, listing({ ownerHash: "b", itemId: 3 })]).map((s) => [
        s.ownerHash,
        s.listings.length,
      ]),
    ).toEqual([
      ["b", 3],
      ["a", 2],
    ]);
  });
});

describe("baseAttributes", () => {
  it("只列非零欄位，傷害上下限合成一列排最前", () => {
    const zero = Object.fromEntries(
      [
        "hp",
        "mp",
        "str",
        "pow",
        "vit",
        "dex",
        "agi",
        "wis",
        "atk",
        "matk",
        "def",
        "mdef",
        "dodge",
        "uncanny_dodge",
        "critical",
        "hit",
        "speed",
        "fire",
        "water",
        "thunder",
        "tree",
        "freeze",
        "min_damage",
        "max_damage",
        "min_pdamage",
        "max_pdamage",
      ].map((k) => [k, 0]),
    );
    const item = { ...zero, critical: 14, min_damage: 1450, max_damage: 1494 } as unknown as Item;
    expect(baseAttributes(item)).toEqual([
      { label: "傷害", value: "1,450 至 1,494" },
      { label: "重擊", value: "14" },
    ]);
  });
});

describe("normalizeSearchParams", () => {
  it("重複的參數取第一個，單一值與 undefined 原樣保留", () => {
    expect(normalizeSearchParams({ q: ["a", "b"], view: "stalls", page: undefined })).toEqual({
      q: "a",
      view: "stalls",
      page: undefined,
    });
  });

  it("空陣列收成 undefined", () => {
    expect(normalizeSearchParams({ q: [] }).q).toBeUndefined();
  });
});

describe("isOwnerHash", () => {
  it("只收 16 碼小寫十六進位", () => {
    expect(isOwnerHash("0123456789abcdef")).toBe(true);
    expect(isOwnerHash("0000000000000000")).toBe(true);
  });

  it("長度不對、大寫、非十六進位或夾雜其他字元都不收", () => {
    for (const bad of [
      "",
      "0123456789abcde",
      "0123456789abcdef0",
      "0123456789ABCDEF",
      "0123456789abcdeg",
      "0123456789abcde\n",
      "../../etc/passwd",
    ]) {
      expect(isOwnerHash(bad)).toBe(false);
    }
  });
});

describe("shownListingCount", () => {
  it("只算遊戲資料庫查得到的道具，同價不合併", () => {
    const items = new Map([[100, {}]]);
    expect(shownListingCount([listing(), listing(), listing({ itemId: 999 })], items)).toBe(2);
  });
});
