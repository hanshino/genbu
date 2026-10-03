import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ImportDialog } from "../import-dialog";
import { ImportCompareCard } from "../import-compare-card";
import { ImportResultCard } from "../import-result-card";

describe("ImportDialog", () => {
  it("空白時不能送出；錯誤時保留輸入內容", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    const props = { open: true, onOpenChange: () => {}, onSubmit };
    const { rerender } = render(<ImportDialog {...props} status="idle" />);

    const submit = screen.getByRole("button", { name: "匯入" });
    expect(submit).toBeDisabled();
    await user.type(screen.getByLabelText("貼上匯入字串"), "   ");
    expect(submit).toBeDisabled();

    await user.type(screen.getByLabelText("貼上匯入字串"), "TTHOL1.abc");
    await user.click(submit);
    expect(onSubmit).toHaveBeenCalledWith("TTHOL1.abc");

    rerender(<ImportDialog {...props} status="pending" />);
    expect(screen.getByRole("button", { name: "匯入中" })).toBeDisabled();
    expect(screen.getByRole("status")).toBeInTheDocument();

    rerender(<ImportDialog {...props} status="error" error="字串不完整，請重新複製" />);
    const area = screen.getByLabelText("貼上匯入字串");
    expect(area).toHaveValue("   TTHOL1.abc");
    expect(area).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByRole("alert")).toHaveTextContent("字串不完整，請重新複製");
    expect(screen.getByRole("button", { name: "重新匯入" })).toBeEnabled();
  });
});

describe("ImportCompareCard", () => {
  it("模擬值為 null 顯示無法計算，差值為 0 的列淡化", () => {
    render(
      <ImportCompareCard
        onClose={() => {}}
        rows={[
          { key: "str", label: "力", group: "六圍", game: 69, sim: 59, reason: "可能有屬性丹藥" },
          { key: "pow", label: "內", group: "六圍", game: 1, sim: 1 },
          {
            key: "atk",
            label: "物攻",
            group: "攻防",
            game: 753,
            sim: null,
            reason: "遠程物攻公式未定",
          },
        ]}
      />,
    );
    const atk = screen.getByTestId("compare-row-atk");
    expect(within(atk).getByText("無法計算")).toBeInTheDocument();
    expect(within(atk).getByText("—")).toBeInTheDocument();
    expect(within(atk).getByText("遠程物攻公式未定")).toBeInTheDocument();

    expect(screen.getByTestId("compare-row-pow")).toHaveAttribute("data-same", "true");
    const str = screen.getByTestId("compare-row-str");
    expect(str).not.toHaveAttribute("data-same");
    expect(within(str).getByText("+10")).toBeInTheDocument();
    expect(screen.getByText("差值只是給你參考，不是錯誤。", { exact: false })).toBeInTheDocument();
  });
});

describe("ImportResultCard", () => {
  const base = {
    characterName: "止戰詩園（匯入）",
    renamed: true,
    app: "tthol-reader v1.8.2",
    at: "2026-10-02T06:31:00Z",
    summary: {
      sectName: "天師",
      level: 112,
      rebirthPoints: 0,
      equipCount: 8,
      passiveCount: 11,
      meridianHref: "/tools/meridian#x",
    },
    onClose: () => {},
  };

  it("依 severity 分成需要注意／已自動調整", () => {
    render(
      <ImportResultCard
        {...base}
        diagnostics={[
          { code: "a", severity: "warning", message: "轉生點數無法推算，已填 0" },
          { code: "b", severity: "info", message: "嫁衣神功 Lv5 超過上限，已改為 Lv4" },
          { code: "c", severity: "warning", message: "副門派技能超過兩個" },
        ]}
      />,
    );
    const warn = screen.getByRole("region", { name: "需要注意" });
    expect(within(warn).getAllByRole("listitem")).toHaveLength(2);
    expect(within(warn).getByText("2 項")).toBeInTheDocument();
    const info = screen.getByRole("region", { name: "已自動調整" });
    expect(within(info).getByText("嫁衣神功 Lv5 超過上限，已改為 Lv4")).toBeInTheDocument();
    expect(screen.getByText("原名撞名，已自動改名")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "在經脈模擬器開啟" })).toHaveAttribute(
      "href",
      "/tools/meridian#x",
    );
  });

  it("沒有提示時顯示乾淨成功狀態", () => {
    render(
      <ImportResultCard
        {...base}
        renamed={false}
        summary={{ ...base.summary, meridianHref: null }}
        diagnostics={[]}
      />,
    );
    expect(
      screen.getByText("全部都對得上，沒有要提醒你的地方。", { exact: false }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "需要注意" })).toBeNull();
    expect(screen.queryByText("原名撞名，已自動改名")).toBeNull();
    expect(screen.getByText("無")).toBeInTheDocument();
  });
});
