import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MarketPriceSection } from "@/components/items/market-price-section";
import type { PriceReport } from "@/lib/queries/market-prices";

vi.mock("next/navigation", () => ({ usePathname: () => "/items/24086" }));

const NOW_SEC = Math.floor(Date.now() / 1000);

function report(overrides: Partial<PriceReport>): PriceReport {
  return {
    id: 1,
    itemId: 24086,
    server: "fish",
    currency: "silver",
    amount: 19_000_000,
    nickname: "柳三刀",
    tag: "4b201",
    netVotes: 0,
    myVote: 0,
    mine: false,
    createdAt: NOW_SEC - 3600,
    awaken: 0,
    bindLeft: null,
    bindExpand: null,
    enhance: [],
    ...overrides,
  };
}

function mockPrices(reports: PriceReport[]) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({ ok: true, json: async () => ({ reports }) })),
  );
}

/** 參考價和單筆回報可能出現同樣的數字，斷言一律限縮在參考價面板內。 */
function reference() {
  return within(screen.getByRole("group", { name: "參考價" }));
}

beforeEach(() => localStorage.clear());
afterEach(() => vi.unstubAllGlobals());

describe("MarketPriceSection", () => {
  it("只用當前伺服器的回報算參考價，別台的不混進來", async () => {
    mockPrices([
      report({ id: 1, amount: 19_000_000 }),
      report({ id: 2, currency: "official", amount: 18, tag: "8a3f2" }),
      report({ id: 3, server: "flower", amount: 990_000_000, tag: "7e118" }),
    ]);
    render(<MarketPriceSection itemId={24086} itemName="玄鐵重劍" user={null} />);

    // [1900 萬, 1800 萬] 的中位數 = 1850 萬；飛雁山莊那筆不列入。
    await waitFor(() => expect(reference().getByText("1,850")).toBeInTheDocument());
    expect(reference().getByText("萬銀兩")).toBeInTheDocument();
    expect(reference().getByText(/由 2 筆回報算出/)).toBeInTheDocument();
  });

  it("沒設匯率時台幣報價不進中位數，並提示未納入的筆數", async () => {
    mockPrices([report({ id: 1 }), report({ id: 2, currency: "twd", amount: 600, tag: "f0e64" })]);
    render(<MarketPriceSection itemId={24086} itemName="玄鐵重劍" user={null} />);

    await waitFor(() => expect(reference().getByText("1,900")).toBeInTheDocument());
    expect(screen.getByText("另有 1 筆現金報價未納入計算")).toBeInTheDocument();
    expect(screen.getByText("未納入計算")).toBeInTheDocument();
  });

  it("切到台幣但沒設匯率時顯示破折號，不推估數字", async () => {
    mockPrices([report({ id: 1 })]);
    const user = (await import("@testing-library/user-event")).default.setup();
    render(<MarketPriceSection itemId={24086} itemName="玄鐵重劍" user={null} />);

    await waitFor(() => expect(reference().getByText("1,900")).toBeInTheDocument());
    await user.click(screen.getByRole("button", { name: "台幣" }));

    expect(reference().getByText("—")).toBeInTheDocument();
    expect(reference().queryByText("1,900")).not.toBeInTheDocument();
    // 沒有現金報價時也要留設定入口，否則「—」就成了死路。
    expect(screen.getByRole("button", { name: "設定台幣匯率" })).toBeInTheDocument();
  });

  it("認同數為負的回報標示有爭議但仍然顯示，且不列入參考價", async () => {
    mockPrices([report({ id: 1 }), report({ id: 2, amount: 42_000_000, netVotes: -2 })]);
    render(<MarketPriceSection itemId={24086} itemName="玄鐵重劍" user={null} />);

    expect(await screen.findByText("有爭議")).toBeInTheDocument();
    expect(screen.getByText("4,200")).toBeInTheDocument(); // 仍然列出
    expect(reference().getByText(/由 1 筆回報算出/)).toBeInTheDocument(); // 但沒算進去
  });

  it("沒有任何回報時給空狀態，未登入不顯示回報按鈕", async () => {
    mockPrices([]);
    render(<MarketPriceSection itemId={24086} itemName="玄鐵重劍" user={null} />);

    expect(await screen.findByText(/還沒有人報過價/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "我來報第一筆" })).not.toBeInTheDocument();
    expect(screen.getByText("使用 LINE 登入")).toBeInTheDocument();
  });

  it("銀兩照原值回報，超過一萬才回放萬／億幫忙讀位數", async () => {
    mockPrices([]);
    const user = (await import("@testing-library/user-event")).default.setup();
    render(
      <MarketPriceSection
        itemId={24086}
        itemName="玄鐵重劍"
        user={{ nickname: "英雄", tag: "8a3f2" }}
      />,
    );

    const amount = await screen.findByLabelText(/價格/);
    // 1,000 銀兩是合法回報，不該被逼著用「萬」，也不必回放。
    await user.type(amount, "1000");
    expect(screen.queryByText(/^= /)).not.toBeInTheDocument();

    await user.type(amount, "000");
    expect(screen.getByText("= 100 萬銀兩")).toBeInTheDocument();
  });

  it("只有自己的回報給刪除鈕，確認後才真的打 DELETE", async () => {
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (init?.method === "DELETE") return { ok: true, json: async () => ({ ok: true }) };
      return { ok: true, json: async () => ({ reports: [report({ id: 7, mine: true })] }) };
    });
    vi.stubGlobal("fetch", fetchMock);
    const user = (await import("@testing-library/user-event")).default.setup();
    render(
      <MarketPriceSection
        itemId={24086}
        itemName="玄鐵重劍"
        user={{ nickname: "英雄", tag: "4b201" }}
      />,
    );

    const remove = await screen.findByRole("button", { name: "刪除我的回報" });
    // 自己的回報投不了票，那兩顆按鈕不該還在。
    expect(screen.queryByRole("button", { name: "認同這筆回報" })).not.toBeInTheDocument();

    vi.stubGlobal(
      "confirm",
      vi.fn(() => false),
    );
    await user.click(remove);
    expect(fetchMock.mock.calls.some(([, init]) => init?.method === "DELETE")).toBe(false);

    vi.stubGlobal(
      "confirm",
      vi.fn(() => true),
    );
    await user.click(remove);
    expect(fetchMock).toHaveBeenCalledWith("/api/reports/7", { method: "DELETE" });
    expect(await screen.findByText("已刪除這筆回報。")).toBeInTheDocument();
  });

  it("別人的回報沒有刪除鈕", async () => {
    mockPrices([report({ id: 1 })]);
    render(
      <MarketPriceSection
        itemId={24086}
        itemName="玄鐵重劍"
        user={{ nickname: "路人", tag: "8a3f2" }}
      />,
    );

    await screen.findByRole("button", { name: "認同這筆回報" });
    expect(screen.queryByRole("button", { name: "刪除我的回報" })).not.toBeInTheDocument();
  });

  it("已登入才出現回報表單", async () => {
    mockPrices([report({ id: 1 })]);
    render(
      <MarketPriceSection
        itemId={24086}
        itemName="玄鐵重劍"
        user={{ nickname: "英雄", tag: "8a3f2" }}
      />,
    );

    await waitFor(() => expect(screen.getByText("回報你看到的價格")).toBeInTheDocument());
    expect(screen.queryByText("使用 LINE 登入")).not.toBeInTheDocument();
  });
});

describe("MarketPriceSection 的補充狀態", () => {
  const LOGGED_IN = { nickname: "英雄", tag: "8a3f2" };

  it("強化過的回報不進參考價，另外列一區", async () => {
    mockPrices([
      report({ id: 1, amount: 19_000_000 }),
      report({ id: 2, amount: 18_000_000, tag: "8a3f2" }),
      report({ id: 3, amount: 940_000_000, tag: "1c8ee", awaken: 12, enhance: ["matk:8"] }),
    ]);
    render(
      <MarketPriceSection
        itemId={24086}
        itemName="玄鐵重劍"
        user={null}
        canEnhance
        awakenMax={20}
      />,
    );

    // 第三筆是 9.4 億，混進來中位數就會歪；參考價只吃前兩筆。
    await waitFor(() => expect(reference().getByText("1,850")).toBeInTheDocument());
    expect(reference().getByText(/由 2 筆乾淨裝回報算出/)).toBeInTheDocument();
    expect(screen.getByText("乾淨裝")).toBeInTheDocument();
    expect(screen.getByText("強化過 · 1 筆")).toBeInTheDocument();
    expect(screen.getByText("內勁 +8")).toBeInTheDocument();
    expect(screen.getByText("覺醒 +12")).toBeInTheDocument();
  });

  it("坐騎這種沒有強化槽的，那一區叫覺醒過，表單也不問強化", async () => {
    mockPrices([report({ id: 1 }), report({ id: 2, tag: "1c8ee", awaken: 5 })]);
    render(
      <MarketPriceSection itemId={24086} itemName="踏雪烏騅" user={LOGGED_IN} awakenMax={20} />,
    );

    await waitFor(() => expect(screen.getByText("覺醒過 · 1 筆")).toBeInTheDocument());
    await userEvent.click(screen.getByRole("button", { name: /補充狀態/ }));
    expect(screen.getByLabelText("覺醒")).toBeInTheDocument();
    expect(screen.queryByLabelText("強化屬性")).not.toBeInTheDocument();
  });

  it("兩者都沒有的道具連補充狀態都不出現", async () => {
    mockPrices([report({ id: 1 })]);
    render(<MarketPriceSection itemId={24086} itemName="金創藥" user={LOGGED_IN} />);

    // 表單一掛載就在，列表要等 fetch 回來；等錯對象就會隨著機器忙不忙時好時壞。
    await waitFor(() => expect(screen.getByText("最近的回報")).toBeInTheDocument());
    expect(screen.queryByRole("button", { name: /補充狀態/ })).not.toBeInTheDocument();
    expect(reference().getByText(/由 1 筆回報算出/)).toBeInTheDocument();
  });

  it("綁定次數只顯示，照樣算進參考價", async () => {
    mockPrices([report({ id: 1, bindLeft: 1, bindExpand: 0 })]);
    render(
      <MarketPriceSection
        itemId={24086}
        itemName="玄鐵重劍"
        user={null}
        canEnhance
        awakenMax={20}
      />,
    );

    await waitFor(() => expect(screen.getByText("綁 1 擴 0")).toBeInTheDocument());
    expect(reference().getByText(/由 1 筆乾淨裝回報算出/)).toBeInTheDocument();
  });
});
