import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

let pathname = "/items";
const back = vi.fn();
vi.mock("next/navigation", () => ({
  usePathname: () => pathname,
  useRouter: () => ({ back }),
}));

// nav-history 用 module 層變數記錄，每個測試重新載入才是乾淨狀態
async function load() {
  vi.resetModules();
  const history = await import("@/lib/nav-history");
  const { BackLink } = await import("../back-link");
  const { DetailBreadcrumb } = await import("../detail-breadcrumb");
  return { ...history, BackLink, DetailBreadcrumb };
}

function goTo(path: string) {
  pathname = path;
  window.history.replaceState(null, "", path);
}

describe("站內返回", () => {
  beforeEach(() => {
    back.mockReset();
    Object.defineProperty(document, "referrer", { value: "https://www.google.com/", configurable: true });
  });

  it("從站外直接進詳情頁：返回連結走 href，不會 history.back() 離開網站", async () => {
    const { NavigationTracker, BackLink } = await load();
    goTo("/items/1");
    render(
      <>
        <NavigationTracker />
        <BackLink href="/items" />
      </>,
    );
    const link = screen.getByRole("link", { name: "返回上一頁" });
    expect(fireEvent.click(link)).toBe(true); // 沒被 preventDefault
    expect(back).not.toHaveBeenCalled();
  });

  it("從列表點進詳情：麵包屑的列表連結 history.back() 還原篩選", async () => {
    const { NavigationTracker, DetailBreadcrumb, cameFrom } = await load();
    goTo("/items?type=SWORD");
    const { rerender } = render(<NavigationTracker />);
    goTo("/items/1");
    rerender(
      <>
        <NavigationTracker />
        <DetailBreadcrumb parent={{ href: "/items", label: "道具" }} current="血風刃" />
      </>,
    );
    expect(cameFrom("/items")).toBe(true);
    expect(fireEvent.click(screen.getByRole("link", { name: "道具" }))).toBe(false);
    expect(back).toHaveBeenCalledTimes(1);
    expect(screen.getByText("血風刃")).toHaveAttribute("aria-current", "page");
  });

  it("從其他詳情頁過來：麵包屑直接連到列表，不是倒回上一頁", async () => {
    const { NavigationTracker, DetailBreadcrumb } = await load();
    goTo("/monsters/5");
    const { rerender } = render(<NavigationTracker />);
    goTo("/items/1");
    rerender(
      <>
        <NavigationTracker />
        <DetailBreadcrumb parent={{ href: "/items", label: "道具" }} current="血風刃" />
      </>,
    );
    expect(fireEvent.click(screen.getByRole("link", { name: "道具" }))).toBe(true);
    expect(back).not.toHaveBeenCalled();
  });
});
