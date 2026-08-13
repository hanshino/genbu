import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HeroTeamBuilder } from "../hero-team-builder";
import type { HeroTeamResult } from "@/lib/hero-team-optimizer";
import type { HeroCombination, HeroSummary } from "@/lib/types/hero";

/**
 * 錄下每一次 render 實際傳進結果卡的 result。
 * jsdom 下 DOM 在事件結束前就 settle，事後檢查會漏掉 useDeferredValue 的 pending 幀，
 * 因此改在 render 邊界攔截。
 */
const renderedResults: HeroTeamResult[] = [];
vi.mock("@/components/heroes/hero-team-result-card", async () => {
  const actual = await vi.importActual<typeof import("../hero-team-result-card")>(
    "../hero-team-result-card",
  );
  return {
    ...actual,
    HeroTeamResultCard: (props: Parameters<typeof actual.HeroTeamResultCard>[0]) => {
      renderedResults.push(props.result);
      return actual.HeroTeamResultCard(props);
    },
  };
});

beforeEach(() => {
  renderedResults.length = 0;
});

/** 最小 fixture：4 位英雄、3 組連結，形狀取自真實 schema（nullable bonus 保留 null）。 */
const heroes: HeroSummary[] = [
  { id: 1, groupId: "1", name: "甲英雄", starUp: 100, combinationCount: 2 },
  { id: 2, groupId: "1", name: "乙英雄", starUp: 100, combinationCount: 2 },
  { id: 3, groupId: "2", name: "丙英雄", starUp: 100, combinationCount: 1 },
  { id: 4, groupId: "2", name: "丁英雄", starUp: 100, combinationCount: 1 },
];

const combo = (
  id: number,
  name: string,
  memberIds: number[],
  bonus: Partial<HeroCombination["bonus"]>,
): HeroCombination => ({
  id,
  name,
  help: `${name} 的加成說明`,
  heroCount: memberIds.length,
  members: memberIds.map((heroId, i) => ({
    slot: i + 1,
    heroId,
    name: heroes.find((h) => h.id === heroId)!.name,
  })),
  bonus: {
    hp: null,
    mp: null,
    atk: null,
    matk: null,
    def: null,
    mdef: null,
    dodge: null,
    hit: null,
    ...bonus,
  },
});

const combinations: HeroCombination[] = [
  combo(1, "甲乙同心", [1, 2], { hp: 500 }),
  combo(2, "乙丙相惜", [2, 3], { hp: 300 }),
  combo(3, "丙丁夜話", [3, 4], { atk: 90 }),
];

function setup() {
  return render(<HeroTeamBuilder heroes={heroes} combinations={combinations} />);
}

describe("HeroTeamBuilder", () => {
  it("預設以全部英雄可用、體力為目標算出結果，並標示連結加成總和", async () => {
    setup();
    // 預設 slots=2、target=hp：甲 + 乙丙 觸發甲乙同心(500) + 乙丙相惜(300)
    expect((await screen.findAllByText("+800")).length).toBeGreaterThan(0);
    expect(screen.getAllByText("連結加成總和").length).toBeGreaterThan(0);
    expect(screen.getByText(/這組的體力連結加成總和最高/)).toBeInTheDocument();
  });

  it("切換目標屬性會改變排序依據", async () => {
    const user = userEvent.setup();
    setup();
    await user.click(screen.getByRole("radio", { name: "物攻" }));
    // 物攻只有丙丁夜話(90)，且不含主英雄 → 仍應列出並顯示 +90
    expect((await screen.findAllByText("+90")).length).toBeGreaterThan(0);
  });

  it("相惜英雄數量不足時顯示「可使用英雄不足」，與無連結的 empty state 不同", async () => {
    const user = userEvent.setup();
    setup();
    await user.click(screen.getByRole("radio", { name: /只用我勾選的英雄/ }));
    // 只剩主英雄自動保留，slots=2 → companions 只有 0 位
    expect(await screen.findByText("可使用英雄不足")).toBeInTheDocument();
    expect(screen.queryByText("沒有可完整啟動的連結")).not.toBeInTheDocument();
  });

  it("人數足夠但湊不出完整連結時顯示「沒有可完整啟動的連結」", async () => {
    const user = userEvent.setup();
    render(
      <HeroTeamBuilder
        heroes={heroes}
        combinations={[combo(9, "孤例", [1, 2, 3, 4], { hp: 10 })]}
      />,
    );
    // slots=1 時無法讓 4 人連結全員到齊
    await user.click(screen.getByRole("radio", { name: "1 位" }));
    expect(await screen.findByText("沒有可完整啟動的連結")).toBeInTheDocument();
    expect(screen.queryByText("可使用英雄不足")).not.toBeInTheDocument();
  });

  it("結果分開列出含主英雄與相惜英雄彼此的連結", async () => {
    const user = userEvent.setup();
    setup();
    const [firstToggle] = await screen.findAllByRole("button", { name: /展開啟動連結明細/ });
    await user.click(firstToggle);
    expect(screen.getByText(/含主英雄的連結（1）/)).toBeInTheDocument();
    expect(screen.getByText(/相惜英雄彼此連結（1）/)).toBeInTheDocument();
  });

  it("顯示假設文案，且不宣稱最強戰力", () => {
    setup();
    expect(screen.getByText(/hero_connect 全員到齊才啟動/)).toBeInTheDocument();
    expect(screen.getByText(/多組加成直接相加，是本站的計算假設/)).toBeInTheDocument();
    expect(screen.getByText(/null 加成在計算時以 0 相加/)).toBeInTheDocument();
    // 「官方推薦／完整戰力」只允許出現在否定句中，不可作為對結果的宣稱
    expect(document.body.textContent).not.toMatch(/最強/);
    expect(screen.getByText(/不代表官方推薦或完整戰力比較/)).toBeInTheDocument();
  });

  it("radiogroup 有可辨識的 label，主英雄搜尋有 accessible name", () => {
    setup();
    expect(screen.getByRole("radiogroup", { name: "可使用英雄範圍" })).toBeInTheDocument();
    expect(screen.getByRole("radiogroup", { name: "目標屬性" })).toBeInTheDocument();
    expect(screen.getByRole("radiogroup", { name: "相惜英雄數量" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "主英雄" })).toBeInTheDocument();
  });

  it("受限模式：從名冊勾選後可算出結果，且答案只用勾選的英雄", async () => {
    const user = userEvent.setup();
    render(
      <HeroTeamBuilder
        heroes={heroes}
        combinations={[
          combo(1, "甲乙同心", [1, 2], { hp: 500 }),
          combo(2, "甲丙同心", [1, 3], { hp: 900 }),
        ]}
      />,
    );
    await user.click(screen.getByRole("radio", { name: /只用我勾選的英雄/ }));
    await user.click(screen.getByRole("radio", { name: "1 位" }));
    expect(await screen.findByText("可使用英雄不足")).toBeInTheDocument();

    await user.click(screen.getAllByRole("button", { name: "管理可使用英雄" })[0]);
    await user.click(await screen.findByRole("checkbox", { name: /乙英雄/ }));
    await user.click(screen.getByRole("button", { name: "完成" }));

    await waitFor(() => expect(screen.queryByText("可使用英雄不足")).not.toBeInTheDocument());
    // 只勾了乙 → 只能用甲乙同心(500)，未勾的丙(900) 不得混進結果
    expect((await screen.findAllByText("+500")).length).toBeGreaterThan(0);
    expect(screen.queryByText("+900")).not.toBeInTheDocument();
  });

  it("未持有英雄只出現在「再多一位會更好」，附增幅且不進入結果", async () => {
    const user = userEvent.setup();
    render(
      <HeroTeamBuilder
        heroes={heroes}
        combinations={[
          combo(1, "甲乙同心", [1, 2], { hp: 500 }),
          combo(2, "甲丙同心", [1, 3], { hp: 900 }),
        ]}
      />,
    );
    await user.click(screen.getByRole("radio", { name: /只用我勾選的英雄/ }));
    await user.click(screen.getByRole("radio", { name: "1 位" }));
    await user.click(screen.getAllByRole("button", { name: "管理可使用英雄" })[0]);
    await user.click(await screen.findByRole("checkbox", { name: /乙英雄/ }));
    await user.click(screen.getByRole("button", { name: "完成" }));

    expect(await screen.findByText("再多一位會更好")).toBeInTheDocument();
    expect(screen.getByText("尚未勾選，不計入上方結果")).toBeInTheDocument();
    expect(screen.getByText(/可解鎖：甲丙同心/)).toBeInTheDocument();
    expect(screen.getByText("+400")).toBeInTheDocument();
  });
});

describe("HeroTeamBuilder 重算期間不顯示舊答案", () => {
  /**
   * useDeferredValue 在設定變更時會先 commit 一次「還在用舊 deferred 值」的畫面。
   * 只在事件結束後檢查 DOM 會漏掉那一幀（jsdom 下 DOM 早已 settle），
   * 所以直接錄下每一次 render 實際傳給結果卡的 companionIds。
   */
  function renderedCompanionIds(): number[][] {
    return renderedResults.map((r) => r.companionIds);
  }

  it("取消勾選已使用的英雄後，答案立即不再出現該英雄（含中間的 pending 幀）", async () => {
    const user = userEvent.setup();
    render(
      <HeroTeamBuilder
        heroes={heroes}
        combinations={[
          combo(1, "甲乙同心", [1, 2], { hp: 500 }),
          combo(2, "甲丙同心", [1, 3], { hp: 120 }),
        ]}
      />,
    );
    await user.click(screen.getByRole("radio", { name: /只用我勾選的英雄/ }));
    await user.click(screen.getByRole("radio", { name: "1 位" }));
    await user.click(screen.getAllByRole("button", { name: "管理可使用英雄" })[0]);
    await user.click(await screen.findByRole("checkbox", { name: /乙英雄/ }));
    await user.click(await screen.findByRole("checkbox", { name: /丙英雄/ }));
    await user.click(screen.getByRole("button", { name: "完成" }));

    // 乙(500) 勝過丙(120)，此時乙在結果中
    await waitFor(() => expect(screen.getAllByText("+500").length).toBeGreaterThan(0));
    expect(renderedCompanionIds().some((c) => c.includes(2))).toBe(true);

    // 開啟名冊本身不改設定，此時結果仍合法含乙；從「取消勾選」那一刻才開始錄
    await user.click(screen.getAllByRole("button", { name: "管理可使用英雄" })[0]);
    const checkbox = await screen.findByRole("checkbox", { name: /乙英雄/ });
    renderedResults.length = 0;
    await user.click(checkbox);
    await user.click(screen.getByRole("button", { name: "完成" }));

    await waitFor(() =>
      expect(screen.getByTestId("hero-team-results").textContent).toMatch(/丙英雄/),
    );
    expect(renderedCompanionIds().length).toBeGreaterThan(0);
    // 每一次 render 都不能還帶著已取消勾選的乙英雄
    expect(renderedCompanionIds().filter((c) => c.includes(2))).toEqual([]);
    expect(screen.queryByText("+500")).not.toBeInTheDocument();
  });

  it("切換目標屬性時不會 render 舊 target 的結果", async () => {
    const user = userEvent.setup();
    setup();
    await waitFor(() => expect(screen.getAllByText("+800").length).toBeGreaterThan(0));

    renderedResults.length = 0;
    await user.click(screen.getByRole("radio", { name: "物攻" }));
    await waitFor(() => expect(screen.getAllByText("+90").length).toBeGreaterThan(0));

    // 舊的體力答案(targetScore 800)不得出現在任何一幀
    expect(renderedResults.map((r) => r.targetScore).filter((s) => s === 800)).toEqual([]);
    expect(renderedResults.length).toBeGreaterThan(0);
  });

  it("結果容器以 aria-busy 標示計算狀態", async () => {
    setup();
    await waitFor(() =>
      expect(screen.getByTestId("hero-team-results")).toHaveAttribute("aria-busy", "false"),
    );
  });

  it("未持有英雄的建議不會殘留在切換後的畫面", async () => {
    const user = userEvent.setup();
    render(
      <HeroTeamBuilder
        heroes={heroes}
        combinations={[
          combo(1, "甲乙同心", [1, 2], { hp: 500 }),
          combo(2, "甲丙同心", [1, 3], { hp: 900 }),
        ]}
      />,
    );
    await user.click(screen.getByRole("radio", { name: /只用我勾選的英雄/ }));
    await user.click(screen.getByRole("radio", { name: "1 位" }));
    await user.click(screen.getAllByRole("button", { name: "管理可使用英雄" })[0]);
    await user.click(await screen.findByRole("checkbox", { name: /乙英雄/ }));
    await user.click(screen.getByRole("button", { name: "完成" }));
    expect(await screen.findByText("再多一位會更好")).toBeInTheDocument();

    // 切回全部可用：沒有未持有英雄，建議區必須消失
    await user.click(screen.getByRole("radio", { name: /全部 4 位皆可用/ }));
    await waitFor(() => expect(screen.queryByText("再多一位會更好")).not.toBeInTheDocument());
  });
});
