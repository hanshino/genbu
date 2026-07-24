import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { StageMapViewer } from "../stage-map-viewer";
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

describe("<StageMapViewer>", () => {
  it("無圖無 NPC 時不渲染", () => {
    const { container } = render(
      <StageMapViewer stageName="空地圖" image={null} placements={[]} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("有圖時渲染地圖圖與每個 placement 的圓點按鈕", () => {
    render(<StageMapViewer stageName="莫愁谷村莊" image={image} placements={placements} />);
    const img = screen.getByRole("img", { name: /莫愁谷村莊/ });
    expect(img).toHaveAttribute("src", image.url);
    expect(screen.getByRole("button", { name: "打鐵舖伙計" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "珍品商人" })).toBeInTheDocument();
  });

  it("無圖有 NPC 時只渲染清單、無地圖圖", () => {
    render(<StageMapViewer stageName="某地圖" image={null} placements={placements} />);
    expect(screen.queryByRole("img")).toBeNull();
    expect(screen.getByText("打鐵舖伙計")).toBeInTheDocument();
    expect(screen.getByText("珍品商人")).toBeInTheDocument();
  });
});
