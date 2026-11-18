import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { MarketItemInfo, MarketListing } from "@/lib/market-listings";

const queries = vi.hoisted(() => ({
  getItemListings: vi.fn(),
  getMarketItemInfo: vi.fn(),
  getStoneInfo: vi.fn(),
}));
vi.mock("@/lib/queries/market-listings", () => queries);

import { ItemMarketListings } from "@/components/market/item-market-listings";

const item: MarketItemInfo = {
  id: 7,
  name: "測試長劍",
  type: "武器",
  level: 10,
  attributes: [],
  icon: null,
};

function listing(price: number, ownerHash: string): MarketListing {
  return {
    ownerHash,
    itemId: 7,
    price,
    count: 1,
    strengthen: 3,
    stats: [],
    stones: [],
    bindsLeft: 0,
    refineLeft: 0,
    zhenjie: false,
    sign: "賣劍",
    name: "攤主甲",
  };
}

function scanOf(server: string) {
  return { scanId: 1, server, started: Math.floor(Date.now() / 1000) - 120 };
}

function mockData(listings: MarketListing[], info: MarketItemInfo = item) {
  queries.getItemListings.mockReturnValue([{ scan: scanOf("tthol-1"), listings }]);
  queries.getMarketItemInfo.mockReturnValue(new Map([[7, info]]));
  queries.getStoneInfo.mockReturnValue(new Map());
}

async function renderSection() {
  render(await ItemMarketListings({ itemId: 7 }));
}

beforeEach(() => vi.clearAllMocks());

describe("ItemMarketListings 多伺服器", () => {
  it("預設顯示第一個有這件道具掛單的伺服器", async () => {
    queries.getItemListings.mockReturnValue([
      { scan: scanOf("flower"), listings: [] },
      { scan: scanOf("fish"), listings: [listing(2_000_000, "a")] },
    ]);
    queries.getMarketItemInfo.mockReturnValue(new Map([[7, item]]));
    queries.getStoneInfo.mockReturnValue(new Map());
    await renderSection();

    expect(screen.queryByText(/目前沒有人在賣/)).toBeNull();
    expect(screen.getByRole("button", { name: "顯示 1 筆掛單" })).toBeInTheDocument();
  });
});

describe("ItemMarketListings 收合", () => {
  it("預設只顯示摘要與展開按鈕，卡片內容在 DOM 裡但看不到", async () => {
    mockData([listing(2_000_000, "a"), listing(5_000_000, "b")]);
    await renderSection();

    expect(screen.getByRole("heading", { name: "市集掛單" })).toBeVisible();
    expect(screen.getByText("2 攤 2 件")).toBeVisible();
    expect(screen.getByRole("img", { name: /掛單價從/ })).toBeVisible();
    expect(screen.getByRole("link", { name: "看整個市集" })).toBeVisible();

    const trigger = screen.getByRole("button", { name: "顯示 2 筆掛單" });
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    // 內容仍由伺服器輸出，只是隱藏。
    const cards = screen.getAllByRole("heading", { name: /測試長劍/, hidden: true });
    expect(cards).toHaveLength(2);
    for (const card of cards) expect(card).not.toBeVisible();
  });

  it("點擊後顯示卡片，aria-expanded 為 true，按鈕改成收合", async () => {
    mockData([listing(2_000_000, "a"), listing(5_000_000, "b")]);
    await renderSection();

    await userEvent.click(screen.getByRole("button", { name: "顯示 2 筆掛單" }));
    const trigger = screen.getByRole("button", { name: "收合" });
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    for (const card of screen.getAllByRole("heading", { name: /測試長劍/ })) {
      expect(card).toBeVisible();
    }
  });

  it("一般道具清單模式：筆數是同攤同價合併後的列數，和展開後看到的一致", async () => {
    const potion: MarketItemInfo = { ...item, type: "POTION" };
    const plain = (price: number, ownerHash: string): MarketListing => ({
      ...listing(price, ownerHash),
      strengthen: 0,
      bindsLeft: null,
      refineLeft: null,
    });
    // 同一攤同價擺三格 + 另一攤一格：4 筆掛單、合併後 2 列。
    mockData([plain(100, "a"), plain(100, "a"), plain(100, "a"), plain(200, "b")], potion);
    await renderSection();

    expect(screen.queryByRole("button", { name: "顯示 4 筆掛單" })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "顯示 2 筆掛單" }));
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
  });

  it("沒有掛單時只有一行空狀態，沒有展開按鈕", async () => {
    mockData([]);
    await renderSection();

    expect(screen.getByText(/目前沒有人在賣「測試長劍」/)).toBeInTheDocument();
    expect(screen.queryByRole("button")).toBeNull();
  });
});
