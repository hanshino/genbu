import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { HeroCombinationList } from "../hero-combination-list";
import type { HeroCombination } from "@/lib/types/hero";

const combo: HeroCombination = {
  id: 1,
  name: "酸酸甜甜",
  help: "組合加成說明",
  heroCount: 2,
  members: [
    { slot: 1, heroId: 13, name: "夥伴英雄" },
    { slot: 2, heroId: 1, name: "本頁英雄" },
  ],
  bonus: {
    hp: 4170,
    mp: 0,
    atk: 155,
    matk: null,
    def: null,
    mdef: null,
    dodge: 65,
    hit: null,
  },
};

describe("HeroCombinationList", () => {
  it("只顯示非 null 且非 0 的加成欄位", () => {
    render(<HeroCombinationList combinations={[combo]} currentHeroId={1} />);
    expect(screen.getByText("體力")).toBeInTheDocument();
    expect(screen.getByText("4,170")).toBeInTheDocument();
    // mp=0 與 matk/def/mdef/hit=null 都不該出現，避免缺值被讀成加成為零
    expect(screen.queryByText("真氣")).not.toBeInTheDocument();
    expect(screen.queryByText("內勁")).not.toBeInTheDocument();
    expect(screen.queryByText("命中")).not.toBeInTheDocument();
  });

  it("成員中標出目前英雄，其他成員連到英雄頁", () => {
    render(<HeroCombinationList combinations={[combo]} currentHeroId={1} />);
    expect(screen.getByText("（本頁）")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "夥伴英雄" })).toHaveAttribute("href", "/heroes/13");
  });

  it("沒有組合時顯示 empty state", () => {
    render(<HeroCombinationList combinations={[]} currentHeroId={1} />);
    expect(screen.getByText(/沒有出現在任何 hero_connect 組合/)).toBeInTheDocument();
  });
});
