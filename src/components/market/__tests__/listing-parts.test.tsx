import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CopyNameButton } from "@/components/market/copy-name-button";
import {
  PriceScaleBar,
  StaleNotice,
  StallLine,
  StallOwner,
} from "@/components/market/listing-parts";

afterEach(() => vi.unstubAllGlobals());

describe("CopyNameButton", () => {
  it("clipboard 被拒時不丟錯，改顯示無法複製", async () => {
    const writeText = vi.fn().mockRejectedValue(new DOMException("denied", "NotAllowedError"));
    vi.stubGlobal("navigator", { ...navigator, clipboard: { writeText } });
    render(<CopyNameButton name="木之精靈" />);
    await userEvent.click(screen.getByRole("button", { name: "複製攤主名稱 木之精靈" }));
    expect(writeText).toHaveBeenCalledWith("木之精靈");
    expect(await screen.findByText("無法複製")).toBeInTheDocument();
  });

  it("沒有 clipboard API 也不丟錯", async () => {
    vi.stubGlobal("navigator", { ...navigator, clipboard: undefined });
    render(<CopyNameButton name="沈默" />);
    await userEvent.click(screen.getByRole("button", { name: "複製攤主名稱 沈默" }));
    expect(await screen.findByText("無法複製")).toBeInTheDocument();
  });

  it("成功時顯示已複製", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { ...navigator, clipboard: { writeText } });
    render(<CopyNameButton name="沈默" />);
    await userEvent.click(screen.getByRole("button", { name: "複製攤主名稱 沈默" }));
    expect(await screen.findByText("已複製")).toBeInTheDocument();
  });
});

describe("StallOwner", () => {
  it("名稱為 null 時請玩家認招牌，不給複製按鈕", () => {
    render(<StallOwner name={null} />);
    expect(screen.getByText("攤主名稱未取得，請認招牌")).toBeInTheDocument();
    expect(screen.queryByRole("button")).toBeNull();
  });
});

describe("StallLine", () => {
  it("招牌與攤主名稱都沒有時顯示沒有攤位資料", () => {
    render(<StallLine listing={{ sign: null, name: null }} />);
    expect(screen.getByText("沒有攤位資料")).toBeInTheDocument();
    expect(screen.queryByText("攤主名稱未取得，請認招牌")).toBeNull();
  });

  it("有招牌但沒有名稱時維持請認招牌", () => {
    render(<StallLine listing={{ sign: "收購", name: null }} />);
    expect(screen.getByText("收購")).toBeInTheDocument();
    expect(screen.getByText("攤主名稱未取得，請認招牌")).toBeInTheDocument();
  });
});

describe("PriceScaleBar", () => {
  it("有價差時給可讀的 aria-label", () => {
    render(<PriceScaleBar prices={[2_000_000, 5_000_000, 2_000_000]} />);
    expect(
      screen.getByRole("img", {
        name: "掛單價從 200 萬銀兩 到 500 萬銀兩，共 3 筆，每一條線是一筆掛單",
      }),
    ).toBeInTheDocument();
  });

  it("全部同價時只顯示單一價格", () => {
    render(<PriceScaleBar prices={[300_000, 300_000]} />);
    expect(screen.queryByRole("img")).toBeNull();
    expect(screen.getByText("2 筆同價")).toBeInTheDocument();
    expect(screen.getByText("30")).toBeInTheDocument();
  });
});

describe("StaleNotice", () => {
  const now = 1_800_000_000_000;
  const scan = { scanId: 1, server: "flower" as const };

  it("3 小時內的掃描不顯示提示", () => {
    const { container } = render(
      <StaleNotice scan={{ ...scan, started: now / 1000 - 23 * 60 }} now={now} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("超過 3 小時顯示過期提示", () => {
    render(<StaleNotice scan={{ ...scan, started: now / 1000 - 5 * 3600 }} now={now} />);
    expect(screen.getByRole("status")).toHaveTextContent(
      "這是 5 小時前的掛單，可能已經賣掉或改價。",
    );
  });
});
