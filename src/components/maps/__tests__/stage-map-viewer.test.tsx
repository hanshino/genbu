import { describe, it, expect, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { StageMapViewer, clusterPoints, letterTag, type MapMonster } from "../stage-map-viewer";
import type { StageMapImage, NpcPlacement, PortalExit } from "@/lib/queries/maps";

const image: StageMapImage = {
  url: "https://img.hanshino.dev/test.webp",
  imgWidth: 4880,
  imgHeight: 6480,
  tilesW: 122,
  tilesH: 162,
  tilePx: 40,
};
const placements: NpcPlacement[] = [
  { placementId: 101, npcId: 6074, name: "打鐵舖伙計", rawX: 2640, rawY: 5000, image: null },
  { placementId: 102, npcId: 6566, name: "珍品商人", rawX: 3960, rawY: 400, image: null },
];

// 仿 208 極之淵：一隻菁英單點 + 一般怪 + 一隻無座標。
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

// 傳點卡片的縮圖 alt 是「… 地圖縮圖」，這裡只抓主地圖。
const figureOf = () => screen.getByRole("img", { name: / 地圖$/ }).closest("figure")!;
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
  it("深連結只標亮並聚焦指定 placement，同 NPC 的其他點保持變淡", () => {
    const scrollIntoView = vi.fn();
    const originalScroll = HTMLElement.prototype.scrollIntoView;
    HTMLElement.prototype.scrollIntoView = scrollIntoView;
    try {
      const { container } = render(
        <StageMapViewer
          stageName="極之淵"
          image={image}
          placements={[...placements, { ...placements[0], placementId: 103, rawX: 100 }]}
          focusedPlacementId={103}
        />,
      );
      const target = container.querySelector('[data-point-id="n:6074#103"]')!;
      const sibling = container.querySelector('[data-point-id="n:6074#101"]')!;
      expect(target).toHaveClass("scale-115");
      expect(target).not.toHaveAttribute("data-dimmed");
      expect(sibling).toHaveAttribute("data-dimmed");
      expect(target).toHaveFocus();
      expect(scrollIntoView).toHaveBeenCalledWith({ block: "center", inline: "center" });
      expect(screen.getByRole("button", { name: "在地圖上標亮 打鐵舖伙計" })).toHaveAttribute(
        "aria-pressed",
        "true",
      );
    } finally {
      HTMLElement.prototype.scrollIntoView = originalScroll;
    }
  });

  it("深連結會重新顯示原本隱藏的 NPC 圖層", async () => {
    const user = userEvent.setup();
    const props = { stageName: "極之淵", image, placements };
    const { rerender } = render(<StageMapViewer {...props} />);
    await user.click(screen.getByRole("button", { name: "全部隱藏" }));
    expect(markers()).toHaveLength(0);
    rerender(<StageMapViewer {...props} focusedPlacementId={101} />);
    expect(within(figureOf()).getByRole("button", { name: "打鐵舖伙計" })).toHaveClass("scale-115");
    expect(screen.getByRole("button", { name: "在地圖上顯示 打鐵舖伙計" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(markerLabels()).not.toContain("珍品商人");
  });

  it.each([999, 0, -1, 1.5, NaN])("無效 placement %s 不改變預設顯示", (id) => {
    render(
      <StageMapViewer
        stageName="極之淵"
        image={image}
        placements={placements}
        focusedPlacementId={id}
      />,
    );
    expect(markers()).toHaveLength(2);
    expect(markers().every((m) => !m.hasAttribute("data-dimmed"))).toBe(true);
    expect(screen.queryByRole("button", { name: "取消標亮" })).toBeNull();
  });

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

  it("點地圖上的怪物點會開啟資訊，含 Lv、HP、菁英倍數與詳情連結", async () => {
    const user = userEvent.setup();
    renderFull();
    await user.click(within(figureOf()).getByRole("button", { name: "●影修羅 Lv 81" }));
    const detail = await screen.findByRole("link", { name: /^怪物資料/ });
    expect(detail).toHaveAttribute("href", "/monsters/5970");
    expect(screen.getByText("菁英：HP 約為本圖其他怪物中位數的 120 倍")).toBeInTheDocument();
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

const destImage: StageMapImage = {
  ...image,
  url: "https://img.hanshino.dev/dest.webp",
  imgWidth: 3200,
  imgHeight: 2400,
};
const direct: PortalExit = {
  key: "256-1",
  eventTag: 256,
  part: 1,
  parts: 1,
  cells: [
    [2004, 84],
    [2084, 84],
  ],
  center: [2044, 84],
  prompt: null,
  options: [
    {
      key: "1",
      label: null,
      dest: { id: 2, kind: "stage", name: "莫愁谷村莊", image: destImage },
      landings: [
        [320, 2136],
        [280, 2056],
      ],
      instance: false,
    },
  ],
};
const menuA: PortalExit = {
  key: "300-1",
  eventTag: 300,
  part: 1,
  parts: 2,
  cells: [[100, 3000]],
  center: [100, 3000],
  prompt: "要回到流星村火島何處呢？",
  options: [
    {
      key: "2",
      label: "回到流星冰島˙南",
      dest: { id: 57, kind: "stage", name: "流星村", image: destImage },
      landings: [[1555, 1692]],
      instance: true,
    },
    {
      key: "3",
      label: "前往莫愁谷",
      dest: { id: 1, kind: "stage", name: "莫愁谷入口", image: destImage },
      landings: [],
      instance: false,
    },
  ],
};
const menuB: PortalExit = {
  ...menuA,
  key: "300-2",
  part: 2,
  cells: [[4000, 3000]],
  center: [4000, 3000],
};
const sameMap: PortalExit = {
  ...direct,
  key: "400-1",
  eventTag: 400,
  cells: [[2000, 2000]],
  center: [2000, 2000],
  options: [
    {
      key: "4",
      label: null,
      dest: { id: 99, kind: "stage", name: "極之淵", image },
      landings: [[2400, 3000]],
      instance: false,
    },
  ],
};

function renderPortals(portals: PortalExit[]) {
  return render(
    <StageMapViewer
      stageName="極之淵"
      image={image}
      placements={[]}
      portals={portals}
      stageKind="stage"
      stageId={99}
    />,
  );
}
const thumb = () => document.querySelector("[data-portal-thumb]");
const portalMarker = (name: string) =>
  within(figureOf()).getByRole("button", { name: `傳點：${name}` });
const menuTitle = (part: number) => `對話選擇（2 個目的地）・第 ${part} 區／共 2 區`;

describe("<StageMapViewer> 傳點", () => {
  it("單一目的地：點開自動選取，縮圖畫落點且不是連結，前往按鈕連到目的地", async () => {
    const user = userEvent.setup();
    renderPortals([direct]);
    expect(thumb()).toBeNull();
    await user.click(portalMarker("往莫愁谷村莊"));
    const go = await screen.findByRole("link", { name: "前往莫愁谷村莊" });
    expect(go).toHaveAttribute("href", "/maps/2");
    const img = screen.getByRole("img", { name: "莫愁谷村莊 地圖縮圖" });
    expect(img).toHaveAttribute("loading", "lazy");
    expect(img.closest("a")).toBeNull();
    expect(thumb()!.querySelectorAll("[data-portal-landing]")).toHaveLength(2);
    expect(screen.getByText("縮圖上的點是傳過去後的落點（2 處）。")).toBeInTheDocument();
  });

  it("對話選單：不預選、沒有縮圖；選了才顯示目的地、副本標示與落點未收錄", async () => {
    const user = userEvent.setup();
    renderPortals([menuA, menuB]);
    await user.click(portalMarker(menuTitle(1)));
    expect(await screen.findByText("選一個選項來看目的地")).toBeInTheDocument();
    expect(screen.getByText("「要回到流星村火島何處呢？」")).toBeInTheDocument();
    expect(thumb()).toBeNull();
    const ice = screen.getByRole("button", { name: /回到流星冰島˙南/ });
    expect(ice).toHaveAttribute("aria-pressed", "false");

    await user.click(ice);
    expect(ice).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("副本")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "前往流星村" })).toHaveAttribute("href", "/maps/57");
    expect(thumb()).not.toBeNull();

    await user.click(screen.getByRole("button", { name: /前往莫愁谷/ }));
    expect(screen.getByText("落點未收錄")).toBeInTheDocument();
    expect(screen.queryByText("副本")).toBeNull();
  });

  it("換開另一區出口時清掉先前的選項", async () => {
    const user = userEvent.setup();
    renderPortals([menuA, menuB]);
    await user.click(portalMarker(menuTitle(1)));
    await user.click(await screen.findByRole("button", { name: /回到流星冰島˙南/ }));
    expect(thumb()).not.toBeNull();

    await user.click(screen.getByRole("button", { name: "關閉傳點資訊" }));
    await user.click(portalMarker(menuTitle(2)));
    expect(await screen.findByText("選一個選項來看目的地")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /回到流星冰島˙南/ })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
    expect(thumb()).toBeNull();
  });

  it("目的地是本圖：不放縮圖，改在地圖上畫弧線與落點", async () => {
    const user = userEvent.setup();
    const { container } = renderPortals([sameMap]);
    expect(container.querySelector("[data-portal-arc]")).toBeNull();
    await user.click(portalMarker("往極之淵"));
    expect(await screen.findByText("目的地就是本圖，落點已標在地圖上。")).toBeInTheDocument();
    expect(container.querySelector("[data-portal-arc]")).not.toBeNull();
    expect(within(figureOf()).getByRole("img", { name: "落點 1" })).toBeInTheDocument();
    expect(thumb()).toBeNull();
    expect(screen.queryByRole("link", { name: /^前往/ })).toBeNull();

    await user.click(screen.getByRole("button", { name: "關閉傳點資訊" }));
    expect(container.querySelector("[data-portal-arc]")).toBeNull();
    expect(portalMarker("往極之淵")).toHaveFocus();
  });

  it("清單列可開卡片；眼睛隱藏單一傳點並關掉卡片，群組可全部隱藏", async () => {
    const user = userEvent.setup();
    renderPortals([direct, menuA]);
    await user.click(screen.getByRole("button", { name: "開啟傳點資訊 往莫愁谷村莊" }));
    expect(await screen.findByRole("link", { name: "前往莫愁谷村莊" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "在地圖上顯示 往莫愁谷村莊" }));
    expect(screen.queryByRole("link", { name: "前往莫愁谷村莊" })).toBeNull();
    expect(markerLabels()).toEqual([`傳點：${menuTitle(1)}`]);

    await user.click(screen.getByRole("button", { name: "全部隱藏" }));
    expect(markers()).toHaveLength(0);
  });

  it("手機寬度：卡片放在地圖下方，只掛一份縮圖", async () => {
    const user = userEvent.setup();
    const original = window.matchMedia;
    window.matchMedia = ((q: string) => ({
      matches: false,
      media: q,
      addEventListener: () => {},
      removeEventListener: () => {},
    })) as unknown as typeof window.matchMedia;
    try {
      renderPortals([direct]);
      await user.click(portalMarker("往莫愁谷村莊"));
      const panel = screen.getByRole("region", { name: "傳點資訊" });
      expect(within(panel).getByRole("link", { name: "前往莫愁谷村莊" })).toBeInTheDocument();
      expect(document.querySelectorAll("[data-portal-thumb]")).toHaveLength(1);
      await user.click(within(panel).getByRole("button", { name: "關閉傳點資訊" }));
      expect(screen.queryByRole("region", { name: "傳點資訊" })).toBeNull();
    } finally {
      window.matchMedia = original;
    }
  });
});

describe("傳點縮圖視窗", () => {
  // 仿 231 杭州城：2400×8000 的長圖，落點在下方。
  const tall: StageMapImage = { ...image, imgWidth: 2400, imgHeight: 8000 };
  const toTall = (landings: [number, number][]): PortalExit => ({
    ...direct,
    options: [
      {
        ...direct.options[0],
        dest: { id: 231, kind: "stage", name: "杭州城", image: tall },
        landings,
      },
    ],
  });
  const pctOf = (s: string) => parseFloat(s);

  it("長圖：框固定 4:3，視窗夾在圖內、落點在框中", async () => {
    const user = userEvent.setup();
    renderPortals([
      toTall([
        [280, 6656],
        [360, 6656],
      ]),
    ]);
    await user.click(portalMarker("往杭州城"));
    const frame = thumb() as HTMLElement;
    expect(frame).toHaveClass("aspect-[4/3]");
    expect(frame).toHaveAttribute("data-view", "landings");
    // 60 格 × 40px = 2400 寬（等於圖寬）、1800 高；左緣 0，上緣 6656 − 900 = 5756（未超過 8000 − 1800）。
    const img = within(frame).getByRole("img", { name: "杭州城 地圖縮圖" });
    expect(pctOf(img.style.width)).toBeCloseTo(100);
    expect(pctOf(img.style.left)).toBeCloseTo(0);
    expect(pctOf(img.style.top)).toBeCloseTo((-5756 / 1800) * 100);
    const dots = [...frame.querySelectorAll<HTMLElement>("[data-portal-landing]")];
    expect(dots.map((d) => pctOf(d.style.left))).toEqual([
      expect.closeTo((280 / 2400) * 100),
      expect.closeTo((360 / 2400) * 100),
    ]);
    for (const d of dots) {
      expect(pctOf(d.style.top)).toBeCloseTo(50);
    }
  });

  it("切到全圖改成 contain，再切回落點附近", async () => {
    const user = userEvent.setup();
    renderPortals([toTall([[280, 6656]])]);
    await user.click(portalMarker("往杭州城"));
    const frame = thumb() as HTMLElement;
    await user.click(within(frame).getByRole("button", { name: "全圖" }));
    expect(frame).toHaveAttribute("data-view", "full");
    const img = within(frame).getByRole("img");
    // 高度撐滿，寬度 2400 / (8000 × 4/3) = 22.5%，水平置中。
    expect(pctOf(img.style.height)).toBeCloseTo(100);
    expect(pctOf(img.style.width)).toBeCloseTo(22.5);
    expect(pctOf(img.style.left)).toBeCloseTo(38.75);
    await user.click(within(frame).getByRole("button", { name: "落點附近" }));
    expect(frame).toHaveAttribute("data-view", "landings");
  });

  it("落點未收錄：整張圖 contain，沒有切換鈕", async () => {
    const user = userEvent.setup();
    renderPortals([toTall([])]);
    await user.click(portalMarker("往杭州城"));
    const frame = thumb() as HTMLElement;
    expect(frame).toHaveAttribute("data-view", "full");
    expect(pctOf(within(frame).getByRole("img").style.width)).toBeCloseTo(22.5);
    expect(within(frame).queryByRole("button")).toBeNull();
    expect(screen.getByText("落點未收錄")).toBeInTheDocument();
  });
});
