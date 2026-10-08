import { it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MysteryContentsSection, MysterySourcesSection } from "../mystery-sections";
import { getMysteryContents, getMysterySources } from "@/lib/queries/mystery";

it("隨機寶箱區塊：分頁、搜尋、巢狀展開、未公開、數量分布", () => {
  const { container, unmount } = render(<MysteryContentsSection contents={getMysteryContents(32403)} />);
  // 區塊預設收合，但內容（含超過上限的列）仍在 DOM 裡
  expect(container.querySelectorAll("tbody tr").length).toBeGreaterThanOrEqual(113);
  fireEvent.click(screen.getByRole("button", { name: /^開啟可能獲得(?!.*說明)/ }));
  expect(screen.getAllByRole("row").length).toBe(11);
  fireEvent.click(screen.getByRole("button", { name: /顯示全部 113 項/ }));
  expect(screen.getAllByRole("row").length).toBe(114);
  fireEvent.change(screen.getByLabelText("搜尋寶箱內容"), { target: { value: "zzz" } });
  expect(screen.getByText(/找不到符合/)).toBeTruthy();
  unmount();

  const r2 = render(<MysteryContentsSection contents={getMysteryContents(24059)} />);
  fireEvent.click(screen.getByRole("button", { name: /^開啟可能獲得(?!.*說明)/ }));
  expect(screen.getAllByRole("table").length).toBe(1);
  fireEvent.click(screen.getByRole("button", { name: /展開內容/ }));
  expect(screen.getAllByRole("table").length).toBe(2);
  r2.unmount();

  const r3 = render(<MysteryContentsSection contents={getMysteryContents(32862)} />);
  expect(screen.getByText("此寶箱內容由伺服器決定，客戶端資料未公開")).toBeTruthy();
  r3.unmount();

  const r4 = render(<MysterySourcesSection sources={getMysterySources(24980)} />);
  expect(document.body.textContent).toContain("×1–120");
  expect(document.body.textContent).toContain("合計");
  r4.unmount();

  const r5 = render(<MysteryContentsSection contents={getMysteryContents(24066)} />);
  expect(document.body.textContent).toContain("每次開出 2–4 樣");
  r5.unmount();
});
