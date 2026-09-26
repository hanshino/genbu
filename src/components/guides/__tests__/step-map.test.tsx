import type { ReactNode } from "react";
import { describe, it, expect } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import type { StepData } from "@/lib/guide-steps";
import type { StageMapImage } from "@/lib/queries/maps";
import { GRID_LAYOUT } from "@/lib/solvers/forest-matrix";
import { NineRoomGrid, StepMap, StepProvider, StepTargets } from "../step-map";

const image: StageMapImage = {
  url: "https://img.hanshino.dev/ioocuj.webp",
  imgWidth: 6040,
  imgHeight: 2800,
  tilesW: 151,
  tilesH: 70,
  tilePx: 40,
};

const row = (id: number, def: number, mdef: number, withImage = true) => ({
  id,
  name: "被汙染的機關",
  level: 165,
  hp: 2296154,
  def,
  mdef,
  dodge: 520,
  weakenRes: 95,
  bleedRes: 100,
  image: withImage ? { url: `https://img.hanshino.dev/${id}.webp`, width: 80, height: 80 } : null,
  count: 1,
});

const data: StepData = {
  stageId: 1932,
  stageName: "謎霧之森・水源",
  image,
  crop: [150, 380, 1400, 1380],
  groups: [
    { key: "g1", tag: "高防禦", color: 1, as: "pin", map: true, rows: [row(11034, 4800, 280)], points: [{ x: 480, y: 480 }] },
    { key: "g2", tag: "高護勁", color: 2, as: "pin", map: true, rows: [row(11035, 400, 3360, false)], points: [{ x: 1160, y: 840 }] },
  ],
  marks: [
    { key: "m1", id: 7712, name: "近衛隊長•葵", label: "葵", as: "npc", tbd: false, image: null, points: [{ x: 240, y: 1160 }] },
    { key: "m2", id: 11036, name: "水源淨化機關", label: null, as: "ok", tbd: false, image: null, points: [{ x: 520, y: 520 }] },
  ],
  hit: { dodge: 520, names: ["被汙染的機關"] },
  missing: [],
};

const renderStep = (d: StepData, extra?: ReactNode) =>
  render(
    <StepProvider data={d}>
      <StepMap />
      <StepTargets />
      {extra}
    </StepProvider>,
  );

describe("StepMap", () => {
  it("預設只看本區塊，切換後才出現「本區塊」框", () => {
    renderStep(data);
    const btn = screen.getByRole("button", { name: "查看完整地圖" });
    expect(btn).toHaveAttribute("aria-pressed", "false");
    expect(screen.queryByTestId("step-frame")).toBeNull();
    // 區塊內座標：(480,480) → 26.4% / 10%
    const m = screen.getAllByRole("button", { name: /1 號/ }).find((e) => e.dataset.marker)!;
    expect(parseFloat(m.style.left)).toBeCloseTo(26.4, 2);
    expect(parseFloat(m.style.top)).toBeCloseTo(10, 2);

    fireEvent.click(btn);
    const back = screen.getByRole("button", { name: "只看本區塊" });
    expect(back).toHaveAttribute("aria-pressed", "true");
    const frame = screen.getByTestId("step-frame");
    expect(frame).toHaveTextContent("本區塊");
    expect(parseFloat(frame.style.left)).toBeCloseTo(2.483, 2);
    expect(parseFloat(frame.style.width)).toBeCloseTo(20.695, 2);
    const full = screen.getAllByRole("button", { name: /1 號/ }).find((e) => e.dataset.marker)!;
    expect(parseFloat(full.style.left)).toBeCloseTo(7.947, 2);
  });

  it("葵和淨化機關是不可互動的圖示", () => {
    renderStep(data);
    expect(screen.getByRole("img", { name: "近衛隊長•葵" })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: /水源淨化機關：已完成/ })).toBeInTheDocument();
  });

  it("通道圖層：圖例可只看一條，隱藏後圖例停用；兩條以上才說互不相通", () => {
    const walk = [
      { label: "甲通道", note: "外圈", path: "M200 400 600 400 600 800 200 800Z", labelAt: { x: 400, y: 420 }, portal: { x: 560, y: 760 }, landing: { x: 240, y: 440 } },
      { label: "乙通道", note: null, path: "M800 400 1200 400 1200 800 800 800Z", labelAt: { x: 1000, y: 420 }, portal: { x: 1160, y: 760 }, landing: null },
    ];
    renderStep({ ...data, walk });
    const layer = screen.getByTestId("walk-layer");
    expect(layer).toHaveAttribute("viewBox", "150 380 1250 1000");
    expect(screen.getByText("兩條通道互不相通：看得到對面的人，也走不過去。")).toBeInTheDocument();
    const only = screen.getByRole("button", { name: "只看甲通道" });
    fireEvent.click(only);
    expect(only).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(screen.getByRole("button", { name: "隱藏通道" }));
    expect(screen.getByTestId("walk-layer")).toHaveClass("opacity-0");
    expect(only).toBeDisabled();
    expect(only).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("button", { name: "顯示通道" })).toHaveAttribute("aria-pressed", "false");
  });

  it("傳點與落點：各通道畫出標記、圖例列出兩種；只看一條時另一條的標記一起藏起來", () => {
    const walk = [
      { label: "甲通道", note: null, path: "M200 400 600 400 600 800 200 800Z", labelAt: { x: 400, y: 420 }, portal: { x: 560, y: 760 }, landing: { x: 240, y: 440 } },
      { label: "乙通道", note: null, path: "M800 400 1200 400 1200 800 800 800Z", labelAt: { x: 1000, y: 420 }, portal: { x: 1160, y: 760 }, landing: { x: 840, y: 440 } },
    ];
    const { container } = renderStep({ ...data, walk });
    for (const name of ["甲通道傳點", "甲通道落點", "乙通道傳點", "乙通道落點"]) {
      expect(screen.getByRole("img", { name })).toBeInTheDocument();
    }
    // 位置：(560,760) 在 crop [150,380,1400,1380] → 32.8% / 38%
    const portal = screen.getByRole("img", { name: "甲通道傳點" });
    expect(parseFloat(portal.style.left)).toBeCloseTo(32.8, 2);
    expect(parseFloat(portal.style.top)).toBeCloseTo(38, 2);
    expect(container.querySelector('[data-legend="portal"]')).toHaveTextContent("傳點・清完走上去傳送");
    expect(container.querySelector('[data-legend="landing"]')).toHaveTextContent("落點・傳送過來時出現的位置");

    fireEvent.click(screen.getByRole("button", { name: "只看甲通道" }));
    expect(screen.getByRole("img", { name: "甲通道傳點" })).toBeInTheDocument();
    expect(screen.queryByRole("img", { name: "乙通道傳點" })).toBeNull();
    expect(screen.queryByRole("img", { name: "乙通道落點" })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "只看甲通道" }));
    fireEvent.click(screen.getByRole("button", { name: "隱藏通道" }));
    expect(screen.queryByRole("img", { name: /通道(傳點|落點)/ })).toBeNull();
  });

  it("路線：畫出落點、編號傳點與方向；只看一條時放大並藏起其他路線，可回到全部", () => {
    const routes = [
      {
        label: "甲島",
        note: "跳一次",
        points: [
          { as: "landing" as const, x: 200, y: 500 },
          { as: "portal" as const, x: 300, y: 500 },
          { as: "landing" as const, x: 700, y: 900 },
          { as: "boss" as const, x: 1100, y: 900 },
        ],
        box: [150, 380, 775, 880] as [number, number, number, number],
      },
      {
        label: "乙島",
        note: "不用跳",
        points: [
          { as: "landing" as const, x: 900, y: 500 },
          { as: "boss" as const, x: 1300, y: 600 },
        ],
        box: [150, 380, 1400, 1380] as [number, number, number, number],
      },
    ];
    const { container } = renderStep({ ...data, routes });
    const layer = screen.getByTestId("route-layer");
    expect(layer.querySelectorAll('[data-seg="jump"]')).toHaveLength(1);
    expect(layer.querySelectorAll('[data-seg="walk"]')).toHaveLength(3);
    expect(screen.getByRole("img", { name: "甲島起點" })).toBeInTheDocument();
    const portal = screen.getByRole("img", { name: "甲島第 1 個傳點" });
    expect(portal).toHaveTextContent("1");
    expect(screen.getByRole("img", { name: "甲島第 1 跳落點" })).toBeInTheDocument();
    expect(container.querySelectorAll('[data-route-point="boss"]')).toHaveLength(2);
    expect(screen.getByRole("button", { name: "隱藏路線" })).toBeInTheDocument();
    // (200,500) 在 crop [150,380,1400,1380] → 4% / 12%
    const start = screen.getByRole("img", { name: "甲島起點" });
    expect(parseFloat(start.style.left)).toBeCloseTo(4, 2);

    fireEvent.click(screen.getByRole("button", { name: "只看甲島" }));
    expect(screen.queryByRole("img", { name: "乙島起點" })).toBeNull();
    // 放大到 [150,380,775,880]：同一點變成 8% / 24%
    const zoomed = screen.getByRole("img", { name: "甲島起點" });
    expect(parseFloat(zoomed.style.left)).toBeCloseTo(8, 2);
    expect(parseFloat(zoomed.style.top)).toBeCloseTo(24, 2);
    expect(screen.getByTestId("route-layer")).toHaveAttribute("viewBox", "150 380 625 500");

    fireEvent.click(screen.getByRole("button", { name: "看全部路線" }));
    expect(screen.getByRole("img", { name: "乙島起點" })).toBeInTheDocument();
    expect(screen.getByTestId("route-layer")).toHaveAttribute("viewBox", "150 380 1250 1000");
  });

  it("路線：傳送弧線繞開王，太短的線段不畫箭頭", () => {
    const box: [number, number, number, number] = [150, 380, 1400, 1380];
    const routes = [
      {
        label: "甲島",
        note: null,
        points: [
          { as: "portal" as const, x: 300, y: 500 },
          { as: "landing" as const, x: 700, y: 500 },
          { as: "portal" as const, x: 700, y: 700 },
          { as: "boss" as const, x: 800, y: 800 },
        ],
        box,
      },
      // 乙島的王剛好在甲島第一段預設往上彎的弧線中間
      { label: "乙島", note: null, points: [{ as: "landing" as const, x: 900, y: 1200 }, { as: "boss" as const, x: 500, y: 444 }], box },
    ];
    const { container } = renderStep({ ...data, routes });
    const jumps = screen.getByTestId("route-layer").querySelectorAll('[data-seg="jump"] path');
    // 預設會往上彎（控制點 y=388）壓到王，改往下彎
    const ctrlY = Number(jumps[0].getAttribute("d")!.match(/Q\S+ (\S+)/)![1]);
    expect(ctrlY).toBeGreaterThan(500);
    // 400 長的弧線有箭頭；141 長的第二段傳送沒有
    expect(container.querySelectorAll("[data-route-arrow]")).toHaveLength(2);
  });

  it("只有一條通道時不說互不相通", () => {
    renderStep({ ...data, walk: [{ label: "甲通道", note: null, path: "M0 0 40 0 40 40 0 40Z", labelAt: { x: 20, y: 20 }, portal: null, landing: null }] });
    expect(screen.queryByText(/互不相通/)).toBeNull();
  });

  it("沒有地圖圖檔時仍顯示表格", () => {
    renderStep({ ...data, image: null });
    expect(screen.queryByRole("button", { name: "查看完整地圖" })).toBeNull();
    expect(screen.getByRole("table")).toBeInTheDocument();
  });
});

describe("StepTargets", () => {
  it("命中摘要、說明與特徵標籤，不顯示 ID", () => {
    renderStep(data);
    expect(screen.getByText(/本步驟要求命中：/)).toHaveTextContent("本步驟要求命中：＞520（被汙染的機關）");
    expect(screen.getByText(/要求命中＝玩家命中需大於怪物閃躲/)).toHaveTextContent("依怪物抗性推算，待實機驗證");
    const table = screen.getByRole("table");
    expect(within(table).getByRole("columnheader", { name: "卸冑" })).toBeInTheDocument();
    expect(within(table).getByRole("columnheader", { name: "中毒" })).toBeInTheDocument();
    for (const row of within(table).getAllByRole("row").slice(1)) {
      expect(within(row).getAllByRole("cell").slice(-2).map(cell => cell.textContent)).toEqual(["可", "不可"]);
    }
    expect(within(table).getByText("高防禦")).toBeInTheDocument();
    expect(within(table).getByText("高護勁")).toBeInTheDocument();
    expect(within(table).queryByText(/11034/)).toBeNull();
    expect(within(table).getAllByText("＞520")).toHaveLength(2);
  });

  it("沒有頭像時用 Ghost 代替", () => {
    renderStep(data);
    const rows = screen.getAllByRole("row").slice(1);
    expect(rows[0].querySelector("img")).not.toBeNull();
    expect(rows[1].querySelector("img")).toBeNull();
    expect(rows[1].querySelector("svg.lucide-ghost")).not.toBeNull();
  });

  it("表格列與地圖標記互相高亮", () => {
    renderStep(data);
    const [r1, r2] = screen.getAllByRole("row").slice(1);
    const marker = () => screen.getAllByRole("button", { name: /1 號/ }).find((e) => e.dataset.marker)!;

    // 列 → 標記（hover）
    fireEvent.mouseEnter(r1);
    expect(marker().className).toMatch(/scale-125/);
    fireEvent.mouseLeave(r1);
    expect(marker().className).not.toMatch(/scale-125/);

    // 列 → 標記（鍵盤按編號按鈕）
    const pick = within(r1).getByRole("button", { name: "在地圖上標出 1 號" });
    fireEvent.click(pick);
    expect(pick).toHaveAttribute("aria-pressed", "true");
    expect(marker()).toHaveAttribute("aria-pressed", "true");
    expect(r1).toHaveAttribute("data-active");

    // 標記 → 列
    const m2 = screen.getAllByRole("button", { name: /2 號/ }).find((e) => e.dataset.marker)!;
    fireEvent.click(m2);
    expect(r2).toHaveAttribute("data-active");
    expect(r1).not.toHaveAttribute("data-active");
  });
});

describe("NineRoomGrid", () => {
  const rooms: StepData = {
    ...data,
    groups: [],
    hit: null,
    marks: GRID_LAYOUT.map((r, i) => ({
      key: `r${i}`,
      id: 11047 + i,
      name: `淨化水晶`,
      label: r,
      as: "room" as const,
      tbd: false,
      image: null,
      points: [{ x: 200 + (i % 3) * 400, y: 400 + Math.floor(i / 3) * 300 }],
    })),
  };

  it("依 GRID_LAYOUT 排列，點格子會亮起地圖上的房名", () => {
    renderStep(rooms, (
      <NineRoomGrid>
        <p>規則說明</p>
      </NineRoomGrid>
    ));
    const cells = within(screen.getByRole("group", { name: "九宮格房名" })).getAllByRole("button");
    expect(cells.map((c) => c.textContent)).toEqual([...GRID_LAYOUT]);
    expect(screen.getByText("規則說明")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /解題工具/ })).toHaveAttribute("href", "/tools/160");

    fireEvent.click(cells[4]);
    expect(cells[4]).toHaveAttribute("aria-pressed", "true");
    const label = screen.getByRole("button", { name: "帝之間" });
    expect(label).toHaveAttribute("aria-pressed", "true");

    // 反向：點地圖上的房名 → 格子亮
    fireEvent.click(screen.getByRole("button", { name: "魁之間" }));
    expect(cells[0]).toHaveAttribute("aria-pressed", "true");
    expect(cells[4]).toHaveAttribute("aria-pressed", "false");
  });
});
