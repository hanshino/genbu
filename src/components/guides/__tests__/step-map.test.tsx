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
    expect(screen.getByText("要求命中＝玩家命中需大於怪物閃躲")).toBeInTheDocument();
    const table = screen.getByRole("table");
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
