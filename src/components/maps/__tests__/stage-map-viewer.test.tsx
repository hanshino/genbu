import { describe, it, expect } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { StageMapViewer, clusterPoints, letterTag, type MapMonster } from "../stage-map-viewer";
import type { StageMapImage, NpcPlacement } from "@/lib/queries/maps";

const image: StageMapImage = {
  url: "https://img.hanshino.dev/test.webp",
  imgWidth: 4880,
  imgHeight: 6480,
  tilesW: 122,
  tilesH: 162,
  tilePx: 40,
};
const placements: NpcPlacement[] = [
  { npcId: 6074, name: "打鐵舖伙計", rawX: 2640, rawY: 5000, image: null },
  { npcId: 6566, name: "珍品商人", rawX: 3960, rawY: 400, image: null },
];

// 仿 208 極之淵：一隻高血量單點 + 一般怪 + 一隻無座標。
const monsters: MapMonster[] = [
  {
    npcId: 5901,
    name: "▲餓鬼",
    level: 76,
    hp: 9829,
    spawnPoints: 3,
    highHp: false,
    hpRatio: 1,
    points: [
      { left: 10, top: 10 },
      { left: 20, top: 20 },
      // 與羅剎同座標：兩者都要能各自被點到。
      { left: 50, top: 50 },
    ],
  },
  {
    npcId: 5902,
    name: "羅剎",
    level: 79,
    hp: 10594,
    spawnPoints: 1,
    highHp: false,
    hpRatio: 1.1,
    points: [{ left: 50, top: 50 }],
  },
  {
    npcId: 5903,
    name: "千年狐妖",
    level: 80,
    hp: 9262,
    spawnPoints: 4,
    highHp: false,
    hpRatio: 0.9,
    points: [],
  },
  {
    npcId: 5970,
    name: "●影修羅",
    level: 81,
    hp: 1182004,
    spawnPoints: 1,
    highHp: true,
    hpRatio: 120.3,
    points: [{ left: 73.01587, top: 60.90909 }],
  },
];

const figureOf = () => screen.getByRole("img", { name: /地圖/ }).closest("figure")!;
const markers = () => within(figureOf()).queryAllByRole("button");
const markerLabels = () => markers().map((b) => b.getAttribute("aria-label"));

function renderFull(aside?: React.ReactNode) {
  return render(
    <StageMapViewer
      stageName="極之淵"
      image={image}
      placements={placements}
      monsters={monsters}
      aside={aside}
    />,
  );
}

describe("clusterPoints", () => {
  it("距離小於門檻的點合成一群，質心取平均；遠的點各自成群", () => {
    const groups = clusterPoints(
      [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 100, y: 100 },
      ],
      24,
    );
    expect(groups).toHaveLength(2);
    expect(groups[0]).toMatchObject({ x: 5, y: 0 });
    expect(groups[0].members).toHaveLength(2);
    expect(groups[1].members).toHaveLength(1);
  });

  it("門檻 <= 0 時完全不分群（含同座標）", () => {
    const pts = [
      { x: 5, y: 5 },
      { x: 5, y: 5 },
    ];
    expect(clusterPoints(pts, 0)).toHaveLength(2);
  });
});

describe("letterTag", () => {
  it("A..Z 之後接 AA、AB", () => {
    expect([0, 1, 25, 26, 27, 51, 52].map(letterTag)).toEqual([
      "A",
      "B",
      "Z",
      "AA",
      "AB",
      "AZ",
      "BA",
    ]);
  });
});

describe("<StageMapViewer>", () => {
  it("無圖、無 NPC、無怪物、無右欄時不渲染", () => {
    const { container } = render(
      <StageMapViewer stageName="空地圖" image={null} placements={[]} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("無圖無清單時仍渲染右欄內容", () => {
    render(
      <StageMapViewer stageName="空地圖" image={null} placements={[]} aside={<p>相關任務</p>} />,
    );
    expect(screen.getByText("相關任務")).toBeInTheDocument();
  });

  it("預設全部圖層可見：怪物編號標記 + NPC 字母標記，名稱保留 ●／▲ 前綴", () => {
    renderFull();
    expect(markerLabels()).toEqual([
      "▲餓鬼 Lv 76（刷怪點 1/3）",
      "▲餓鬼 Lv 76（刷怪點 2/3）",
      "▲餓鬼 Lv 76（刷怪點 3/3）",
      "羅剎 Lv 79",
      "●影修羅 Lv 81",
      "打鐵舖伙計",
      "珍品商人",
    ]);
    const labelled = (name: string) => within(figureOf()).getByRole("button", { name });
    expect(labelled("●影修羅 Lv 81")).toHaveTextContent("4");
    expect(labelled("打鐵舖伙計")).toHaveTextContent("A");
    expect(labelled("珍品商人")).toHaveTextContent("B");
    // 說明只有一段。
    expect(screen.getAllByText(/不是怪物當下在哪/)).toHaveLength(1);
  });

  it("同座標不同種類的點（未量到寬度時不分群）仍各自可被點到", () => {
    renderFull();
    const same = markers().filter((b) => b.style.left === "50%" && b.style.top === "50%");
    expect(same.map((b) => b.getAttribute("aria-label"))).toEqual([
      "▲餓鬼 Lv 76（刷怪點 3/3）",
      "羅剎 Lv 79",
    ]);
  });

  it("眼睛按鈕隱藏該種；地圖上方提示已隱藏數量並可一鍵全部顯示", async () => {
    const user = userEvent.setup();
    renderFull();
    const eye = screen.getByRole("button", { name: "在地圖上顯示 ▲餓鬼 Lv 76" });
    expect(eye).toHaveAttribute("aria-pressed", "true");
    await user.click(eye);
    expect(eye).toHaveAttribute("aria-pressed", "false");
    expect(markerLabels().some((l) => l?.startsWith("▲餓鬼"))).toBe(false);
    expect(screen.getByText(/已隱藏 1 項/)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "全部顯示" }));
    expect(markers()).toHaveLength(7);
    expect(screen.queryByText(/已隱藏/)).toBeNull();
  });

  it("NPC 區塊的全部隱藏只影響 NPC", async () => {
    const user = userEvent.setup();
    renderFull();
    const [, npcToggle] = screen.getAllByRole("button", { name: "全部隱藏" });
    await user.click(npcToggle);
    expect(markerLabels()).not.toContain("打鐵舖伙計");
    expect(markerLabels()).toContain("羅剎 Lv 79");
    expect(screen.getByText(/已隱藏 2 項/)).toBeInTheDocument();
  });

  it("點清單列會標亮該種、其餘變淡，上方出現可取消的標籤", async () => {
    const user = userEvent.setup();
    renderFull();
    await user.click(screen.getByText("羅剎"));
    expect(screen.getByRole("button", { name: "在地圖上標亮 羅剎 Lv 79" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    const fig = within(figureOf());
    expect(fig.getByRole("button", { name: "羅剎 Lv 79" })).not.toHaveAttribute("data-dimmed");
    expect(fig.getByRole("button", { name: "打鐵舖伙計" })).toHaveAttribute("data-dimmed");

    await user.click(screen.getByRole("button", { name: "取消標亮" }));
    expect(fig.getByRole("button", { name: "打鐵舖伙計" })).not.toHaveAttribute("data-dimmed");
  });

  it("隱藏被標亮的種類後，其他點不會維持變淡", async () => {
    const user = userEvent.setup();
    renderFull();
    await user.click(screen.getByText("羅剎"));
    await user.click(screen.getByRole("button", { name: "在地圖上顯示 羅剎 Lv 79" }));
    expect(within(figureOf()).getByRole("button", { name: "打鐵舖伙計" })).not.toHaveAttribute(
      "data-dimmed",
    );
    expect(screen.queryByRole("button", { name: "取消標亮" })).toBeNull();
  });

  it("點眼睛或資料連結不會觸發列的標亮", async () => {
    const user = userEvent.setup();
    renderFull();
    await user.click(screen.getByRole("button", { name: "在地圖上顯示 羅剎 Lv 79" }));
    expect(screen.queryByRole("button", { name: "取消標亮" })).toBeNull();
    const link = screen.getByRole("link", { name: "●影修羅 Lv 81 怪物資料" });
    expect(link).toHaveAttribute("href", "/monsters/5970");
  });

  it("無座標的怪物不能標亮、眼睛停用，刷怪點顯示可標數量", () => {
    renderFull();
    expect(screen.getByRole("button", { name: "在地圖上顯示 千年狐妖 Lv 80" })).toBeDisabled();
    expect(screen.queryByRole("button", { name: "在地圖上標亮 千年狐妖 Lv 80" })).toBeNull();
    expect(screen.getByText("0/4 點")).toBeInTheDocument();
  });

  it("點地圖上的怪物點會開啟資訊，含 Lv、HP、高血量倍數與詳情連結", async () => {
    const user = userEvent.setup();
    renderFull();
    await user.click(within(figureOf()).getByRole("button", { name: "●影修羅 Lv 81" }));
    const detail = await screen.findByRole("link", { name: /^怪物資料/ });
    expect(detail).toHaveAttribute("href", "/monsters/5970");
    expect(screen.getByText("高血量：HP 約為本圖其他怪物中位數的 120 倍")).toBeInTheDocument();
    expect(screen.getByText("HP 1,182,004")).toBeInTheDocument();
  });

  it("鍵盤可聚焦並用 Enter 開啟怪物點", async () => {
    const user = userEvent.setup();
    renderFull();
    within(figureOf()).getByRole("button", { name: "●影修羅 Lv 81" }).focus();
    await user.keyboard("{Enter}");
    expect(await screen.findByRole("link", { name: /^怪物資料/ })).toBeInTheDocument();
  });

  it("有右欄時與清單並排渲染", () => {
    renderFull(<p>同區域地圖</p>);
    expect(screen.getByRole("complementary")).toHaveTextContent("同區域地圖");
  });

  it("無地圖圖片時只有清單與連結，沒有眼睛或標亮", () => {
    render(
      <StageMapViewer
        stageName="某地圖"
        image={null}
        placements={placements}
        monsters={monsters}
      />,
    );
    expect(screen.queryByRole("img")).toBeNull();
    expect(screen.queryByRole("button", { name: /在地圖上/ })).toBeNull();
    expect(screen.getByText("●影修羅")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "千年狐妖 Lv 80 怪物資料" })).toHaveAttribute(
      "href",
      "/monsters/5903",
    );
    // 無圖時不提座標，只顯示刷怪點數。
    expect(screen.getByText("4 點")).toBeInTheDocument();
    expect(screen.getByText("打鐵舖伙計")).toBeInTheDocument();
  });
});
