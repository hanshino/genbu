import { describe, it, expect } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { StageMapViewer } from "../stage-map-viewer";
import type { StageMapImage, NpcPlacement, StageMonsterMarker } from "@/lib/queries/maps";

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
const monsters: StageMonsterMarker[] = [
  {
    npcId: 5901,
    name: "餓鬼",
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
    spawnPoints: 2,
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
    name: "影修羅",
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

function renderFull() {
  return render(
    <StageMapViewer stageName="極之淵" image={image} placements={placements} monsters={monsters} />,
  );
}

describe("<StageMapViewer>", () => {
  it("無圖無 NPC 無怪物時不渲染", () => {
    const { container } = render(
      <StageMapViewer stageName="空地圖" image={null} placements={[]} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("有圖時渲染地圖圖與每個 NPC placement 的點", () => {
    render(<StageMapViewer stageName="莫愁谷村莊" image={image} placements={placements} />);
    expect(screen.getByRole("img", { name: /莫愁谷村莊/ })).toHaveAttribute("src", image.url);
    expect(screen.getByRole("button", { name: "打鐵舖伙計" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "珍品商人" })).toBeInTheDocument();
  });

  it("預設只顯示 NPC 與高血量怪物", () => {
    renderFull();
    const names = markers().map((b) => b.getAttribute("aria-label"));
    expect(names).toEqual(["打鐵舖伙計", "珍品商人", "影修羅"]);
    expect(screen.getByText(/不是怪物當下的即時位置/)).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "NPC" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "影修羅" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "餓鬼" })).not.toBeChecked();
  });

  it("可個別開關怪物，包含把高血量隱藏", async () => {
    const user = userEvent.setup();
    renderFull();
    await user.click(screen.getByRole("checkbox", { name: "餓鬼" }));
    expect(within(figureOf()).getAllByRole("button", { name: /^餓鬼/ })).toHaveLength(3);

    await user.click(screen.getByRole("checkbox", { name: "影修羅" }));
    expect(within(figureOf()).queryByRole("button", { name: "影修羅" })).toBeNull();
    // 高血量標籤仍留在清單，只是不畫在地圖上。
    expect(screen.getAllByText("高血量").length).toBeGreaterThan(0);

    await user.click(screen.getByRole("checkbox", { name: "NPC" }));
    expect(within(figureOf()).queryByRole("button", { name: "打鐵舖伙計" })).toBeNull();
    // NPC 清單不受開關影響。
    expect(screen.getByText("打鐵舖伙計")).toBeInTheDocument();
  });

  it("點名稱文字也能切換該怪物", async () => {
    const user = userEvent.setup();
    renderFull();
    await user.click(screen.getByText("羅剎"));
    expect(screen.getByRole("checkbox", { name: "羅剎" })).toBeChecked();
  });

  it("全部顯示／全部隱藏同時影響 NPC 與怪物", async () => {
    const user = userEvent.setup();
    renderFull();
    await user.click(screen.getByRole("button", { name: "全部顯示" }));
    // 2 NPC + 餓鬼 3 + 羅剎 1 + 影修羅 1；千年狐妖無座標不算。
    expect(markers()).toHaveLength(7);
    expect(screen.getByRole("button", { name: "全部顯示" })).toBeDisabled();

    await user.click(screen.getByRole("button", { name: "全部隱藏" }));
    expect(markers()).toHaveLength(0);
    for (const cb of screen.getAllByRole("checkbox")) expect(cb).not.toBeChecked();
  });

  it("同座標不同種類的點仍各自可被鍵盤選到", async () => {
    const user = userEvent.setup();
    renderFull();
    await user.click(screen.getByRole("button", { name: "全部顯示" }));
    const same = markers().filter((b) => b.style.left === "50%" && b.style.top === "50%");
    expect(same.map((b) => b.getAttribute("aria-label"))).toEqual(["餓鬼（刷怪點 3/3）", "羅剎"]);
  });

  it("無座標的怪物停用開關並說明原因，部分缺座標時顯示可標數量", () => {
    render(
      <StageMapViewer
        stageName="極之淵"
        image={image}
        placements={placements}
        monsters={monsters.map((m) => (m.npcId === 5902 ? { ...m, spawnPoints: 5 } : m))}
      />,
    );
    expect(screen.getByRole("checkbox", { name: "千年狐妖" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
    expect(screen.getByText("共 4 點，無可用座標，無法標在地圖上")).toBeInTheDocument();
    expect(screen.getByText("地圖可標 1 / 共 5 點")).toBeInTheDocument();
  });

  it("怪物詳情連結與開關分開，沒有互相包住", () => {
    renderFull();
    const link = screen.getByRole("link", { name: "影修羅 怪物資料" });
    expect(link).toHaveAttribute("href", "/monsters/5970");
    const checkbox = screen.getByRole("checkbox", { name: "影修羅" });
    expect(link.contains(checkbox)).toBe(false);
    expect(checkbox.contains(link)).toBe(false);
    expect(link.querySelector("button, a, [role=checkbox]")).toBeNull();
  });

  it("點擊地圖上的怪物點會開啟資訊，含高血量倍數說明與詳情連結", async () => {
    const user = userEvent.setup();
    renderFull();
    await user.click(within(figureOf()).getByRole("button", { name: "影修羅" }));
    const detail = await screen.findByRole("link", { name: /查看怪物資料/ });
    expect(detail).toHaveAttribute("href", "/monsters/5970");
    expect(
      screen.getByText("HP 約為本圖其他怪物 HP 中位數的 120 倍（10 倍以上標為高血量）"),
    ).toBeInTheDocument();
  });

  it("鍵盤可聚焦並用 Enter 開啟怪物點", async () => {
    const user = userEvent.setup();
    renderFull();
    const marker = within(figureOf()).getByRole("button", { name: "影修羅" });
    marker.focus();
    await user.keyboard("{Enter}");
    expect(await screen.findByRole("link", { name: /查看怪物資料/ })).toBeInTheDocument();
  });

  it("標亮按鈕只在該種已顯示時可用，並讓其他點變淡", async () => {
    const user = userEvent.setup();
    renderFull();
    expect(screen.getByRole("button", { name: "在地圖上標亮 餓鬼" })).toBeDisabled();
    const locate = screen.getByRole("button", { name: "在地圖上標亮 影修羅" });
    await user.click(locate);
    expect(locate).toHaveAttribute("aria-pressed", "true");
    // 變淡的點同時不吃點擊，重疊時才點得到被標亮那一種。
    expect(within(figureOf()).getByRole("button", { name: "打鐵舖伙計" })).toHaveClass(
      "opacity-30",
      "pointer-events-none",
    );
    expect(within(figureOf()).getByRole("button", { name: "影修羅" })).not.toHaveClass(
      "opacity-30",
    );

    // 隱藏被標亮的種類後，其他點不能維持變淡。
    await user.click(screen.getByRole("checkbox", { name: "影修羅" }));
    expect(within(figureOf()).getByRole("button", { name: "打鐵舖伙計" })).not.toHaveClass(
      "opacity-30",
    );
  });

  it("無地圖圖片時保留怪物資訊與連結，不出現開關", () => {
    render(
      <StageMapViewer
        stageName="某地圖"
        image={null}
        placements={placements}
        monsters={monsters}
      />,
    );
    expect(screen.queryByRole("img")).toBeNull();
    expect(screen.queryByRole("checkbox")).toBeNull();
    expect(screen.queryByRole("button", { name: "全部顯示" })).toBeNull();
    expect(screen.getByText("影修羅")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "千年狐妖 怪物資料" })).toHaveAttribute(
      "href",
      "/monsters/5903",
    );
    // 無圖時不提「無座標」，只顯示刷怪點數。
    expect(screen.getByText("×4")).toBeInTheDocument();
    expect(screen.getByText("打鐵舖伙計")).toBeInTheDocument();
  });
});
