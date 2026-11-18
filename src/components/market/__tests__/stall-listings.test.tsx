import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { STALL_PREVIEW_LIMIT, StallListings } from "@/components/market/stall-listings";
import type { MarketItemInfo, MarketListing } from "@/lib/market-listings";

const sword: MarketItemInfo = {
  id: 7,
  name: "測試長劍",
  type: "SWORD",
  level: 10,
  attributes: [],
  icon: null,
};
const herb: MarketItemInfo = {
  id: 8,
  name: "測試草藥",
  type: null,
  level: 0,
  attributes: [],
  icon: null,
};
const items = new Map([
  [7, sword],
  [8, herb],
]);

function listing(itemId: number, price: number): MarketListing {
  return {
    ownerHash: "0123456789abcdef",
    itemId,
    price,
    count: 1,
    strengthen: 0,
    stats: [],
    stones: [],
    bindsLeft: null,
    refineLeft: null,
    zhenjie: false,
    sign: "賣劍",
    name: "攤主甲",
  };
}

const HREF = "/market/stalls/0123456789abcdef?server=flower";

function renderPreview(listings: MarketListing[]) {
  return render(
    <StallListings
      listings={listings}
      items={items}
      stones={new Map()}
      limit={STALL_PREVIEW_LIMIT}
      moreHref={HREF}
    />,
  );
}

describe("StallListings 展開預覽", () => {
  it("超過 4 筆只畫 4 筆，並連到攤位頁看全部", () => {
    renderPreview([1, 2, 3, 4, 5].map((p) => listing(7, p)));
    expect(screen.getAllByRole("heading", { name: "測試長劍" })).toHaveLength(4);
    const link = screen.getByRole("link", { name: "看這一攤全部 5 筆掛單" });
    expect(link).toHaveAttribute("href", HREF);
  });

  it("裝備卡與一般道具列合計 4 筆，卡片在前", () => {
    renderPreview([listing(7, 1), listing(7, 2), listing(8, 3), listing(8, 4), listing(8, 5)]);
    expect(screen.getAllByRole("heading", { name: "測試長劍" })).toHaveLength(2);
    expect(screen.getAllByRole("link", { name: "測試草藥" })).toHaveLength(2);
    expect(screen.getByRole("link", { name: "看這一攤全部 5 筆掛單" })).toBeInTheDocument();
  });

  it("剛好 4 筆不出現連結", () => {
    renderPreview([1, 2, 3, 4].map((p) => listing(7, p)));
    expect(screen.getAllByRole("heading", { name: "測試長劍" })).toHaveLength(4);
    expect(screen.queryByRole("link", { name: /看這一攤全部/ })).toBeNull();
  });

  it("同攤同價合併後不超過 4 列就不出現連結", () => {
    renderPreview([listing(8, 1), listing(8, 1), listing(8, 1), listing(8, 2), listing(8, 3)]);
    expect(screen.getAllByRole("link", { name: "測試草藥" })).toHaveLength(3);
    expect(screen.queryByRole("link", { name: /看這一攤全部/ })).toBeNull();
  });

  it("沒給 limit（攤位頁）時全部畫出來", () => {
    render(
      <StallListings
        listings={[1, 2, 3, 4, 5, 6].map((p) => listing(7, p))}
        items={items}
        stones={new Map()}
      />,
    );
    expect(screen.getAllByRole("heading", { name: "測試長劍" })).toHaveLength(6);
    expect(screen.queryByRole("link", { name: /看這一攤全部/ })).toBeNull();
  });
});
