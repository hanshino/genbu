import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ItemPicker } from "../item-picker";
import {
  EQUIP_SLOTS,
  type EquipSlot,
  type EquippedItem,
  type GameData,
} from "@/lib/types/stat-sim";

const data: GameData = {
  itemsById: {
    601: {
      id: 601,
      name: "聖龍盔",
      level: 200,
      typeName: "HELMET",
      slotHint: ["cap"],
      stats: { uncanny_dodge: 6 },
      strongPathId: 1,
      randomOptions: [
        { attribute: "命中", stat: "hit", ranges: [[50, 85]] },
        {
          attribute: "防禦",
          stat: "def",
          ranges: [
            [55, 100],
            [101, 165],
          ],
        },
      ],
      randomCount: [0, 1],
      socketCount: 2,
      socketMin: 1,
      socketCategory: 1,
    },
    603: {
      id: 603,
      name: "五行冠",
      level: 150,
      typeName: "HELMET",
      slotHint: ["cap"],
      stats: {},
      strongPathId: null,
      randomOptions: [
        { attribute: "命中", stat: "hit", ranges: [[1, 9]] },
        { attribute: "閃躲", stat: "dodge", ranges: [[1, 9]] },
      ],
      randomCount: [2, 2],
      socketCount: 1,
      socketMin: 1,
    },
    602: {
      id: 602,
      name: "布帽",
      level: 1,
      typeName: "HELMET",
      slotHint: ["cap"],
      stats: { def: 2 },
      strongPathId: null,
    },
  },
  enhancementsByPath: { 1: { maxLevel: 2, levels: [{}, { def: 10 }, { def: 20, hp: 50 }] } },
  passives: [],
  meridianIds: [],
  socketRecipes: {
    10: { id: 10, name: "獵人強化裝備", effects: [{ stat: "hit", ranges: [[7, 7]] }] },
    11: {
      id: 11,
      name: "吉魂珠強化",
      effects: [
        {
          stat: "atk",
          ranges: [
            [25, 30],
            [10, 14],
            [15, 19],
            [20, 24],
          ],
        },
      ],
    },
    12: {
      id: 12,
      name: "玄武魂珠強化",
      effects: [
        { stat: "atk", ranges: [[10, 30]] },
        { stat: "def", ranges: [[5, 9]] },
      ],
    },
    13: { id: 13, name: "獵人小真元強化", effects: [{ stat: "hit", ranges: [[7, 7]] }] },
    14: { id: 14, name: "赤血巨蠍強化裝備", effects: [{ stat: "atk", ranges: [[30, 30]] }] },
    15: { id: 15, name: "牛魔人強化裝備", effects: [{ stat: "atk", ranges: [[21, 21]] }] },
    16: { id: 16, name: "藍頸熊強化裝備", effects: [{ stat: "atk", ranges: [[15, 15]] }] },
    17: { id: 17, name: "幽靈侍衛強化裝備", effects: [{ stat: "def", ranges: [[11, 11]] }] },
    // 不在這個類別：舊存檔仍要能顯示
    90: { id: 90, name: "絕版魂石", effects: [{ stat: "hit", ranges: [[3, 3]] }] },
  },
  socketRecipeIdsByCategory: { 1: [10, 11, 12, 13, 14, 15, 16, 17] },
};

function setup(cap: EquippedItem | null) {
  const user = userEvent.setup();
  const onApply = vi.fn<(slot: EquipSlot, value: EquippedItem | null) => void>();
  const onClose = vi.fn();
  const equipment = Object.fromEntries(EQUIP_SLOTS.map((s) => [s, null])) as Record<
    EquipSlot,
    EquippedItem | null
  >;
  equipment.cap = cap;
  render(
    <ItemPicker
      slot="cap"
      data={data}
      equipment={equipment}
      onSlotChange={() => {}}
      onClose={onClose}
      onApply={onApply}
    />,
  );
  const pick = async (combobox: string, option: string) => {
    await user.click(screen.getByRole("combobox", { name: combobox }));
    await user.click(await screen.findByRole("option", { name: option }));
  };
  /** 打開第 N 槽的配方選單，回傳 popup 內的查詢工具。 */
  const openRecipes = async (slot: string) => {
    await user.click(screen.getByRole("combobox", { name: `${slot}配方` }));
    return within(await screen.findByLabelText(`${slot}配方清單`));
  };
  const pickRecipe = async (slot: string, stem: string) => {
    const pop = await openRecipes(slot);
    await user.click(pop.getByRole("option", { name: new RegExp(`^${stem}`) }));
  };
  return {
    user,
    onApply,
    onClose,
    pick,
    openRecipes,
    pickRecipe,
    applied: () => onApply.mock.lastCall?.[1],
  };
}

const fresh = (extra: Partial<EquippedItem> = {}): EquippedItem => ({
  itemId: 601,
  enhancementLevel: 0,
  manualBonuses: {},
  ...extra,
});

describe("ItemPicker 裝備編輯", () => {
  it("隨機素質：勾選預填最小值、超出範圍擋住套用，修正後寫入 randomRolls", async () => {
    const { user, pick, applied } = setup(fresh());
    const hit = screen.getByRole("textbox", { name: "命中數值" });
    expect(hit).toBeDisabled();
    expect(screen.getByText("55–165")).toBeInTheDocument(); // 相連區段合併

    await user.click(screen.getByRole("checkbox", { name: /^命中/ }));
    expect(hit).toHaveValue("50");
    await user.clear(hit);
    await user.type(hit, "92");
    expect(hit).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByText("需介於 50–85")).toBeInTheDocument();
    expect(screen.getByText("有 1 項需修正")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "套用" })).toBeDisabled();
    expect(
      within(screen.getByRole("region", { name: "本件合計" })).getByText("數值待修正"),
    ).toBeInTheDocument();

    await user.clear(hit);
    await user.type(hit, "72");
    await pick("強化等級", "+2");
    await user.click(screen.getByRole("button", { name: "套用" }));
    expect(applied()).toEqual({
      itemId: 601,
      enhancementLevel: 2,
      manualBonuses: {},
      randomRolls: [{ attribute: "命中", value: 72 }],
    });
  });

  it("插槽：固定效果唯讀、隨機填值顯示檔位、多屬性先選屬性，合計列出來源", async () => {
    const { user, pickRecipe, applied } = setup(
      fresh({ randomRolls: [{ attribute: "命中", value: 72 }] }),
    );
    expect(screen.getByText("第 1 槽")).toBeInTheDocument();
    await pickRecipe("第 1 槽", "獵人");
    expect(screen.queryByRole("textbox", { name: "第 1 槽數值" })).not.toBeInTheDocument();
    expect(screen.getByText("+7")).toBeInTheDocument();

    await pickRecipe("第 2 槽", "吉魂珠");
    const value = screen.getByRole("textbox", { name: "第 2 槽數值" });
    expect(value).toHaveValue("10");
    await user.clear(value);
    await user.type(value, "22");
    expect(screen.getByText("20–24（目前）")).toBeInTheDocument();

    const sum = within(screen.getByRole("region", { name: "本件合計" }));
    expect(sum.getByText("隨機 72 ＋ 插槽 7")).toBeInTheDocument();
    expect(sum.getByText("固定")).toBeInTheDocument();
    const rows = sum.getAllByRole("listitem").map((li) => li.textContent);
    expect(rows[0]).toMatch(/^命中/); // 隨機素質順序在前
    expect(rows).toContain("物攻插槽+22");

    await user.click(screen.getByRole("button", { name: "套用" }));
    expect(applied()?.sockets).toEqual([
      { recipeId: 10, stat: "hit", value: 7 },
      { recipeId: 11, stat: "atk", value: 22 },
    ]);
  });

  it("多屬性配方：先選屬性，換屬性會重填該屬性的最小值", async () => {
    const { pick, pickRecipe, applied, user } = setup(fresh());
    await pickRecipe("第 1 槽", "玄武魂珠");
    expect(screen.getByRole("textbox", { name: "第 1 槽數值" })).toHaveValue("10");
    await pick("第 1 槽屬性", "防禦");
    expect(screen.getByRole("textbox", { name: "第 1 槽數值" })).toHaveValue("5");
    await user.click(screen.getByRole("button", { name: "套用" }));
    expect(applied()?.sockets).toEqual([{ recipeId: 12, stat: "def", value: 5 }, null]);
  });

  it("舊版手動合計只顯示提醒，可清除", async () => {
    const { user, applied } = setup(fresh({ manualBonuses: { atk: 40 } }));
    expect(
      screen.getByText("此裝備有舊版手動合計（物攻 +40），本件合計不含這筆，面板會另外加上。"),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "清除舊合計" }));
    expect(screen.queryByText(/舊版手動合計/)).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "套用" }));
    expect(applied()).toEqual(fresh());
  });

  it("換成別件裝備會清掉舊件的手動合計、隨機素質與插槽；挑回原件則還原", async () => {
    const saved = fresh({
      manualBonuses: { atk: 40 },
      randomRolls: [{ attribute: "命中", value: 60 }],
      sockets: [{ recipeId: 10, stat: "hit", value: 7 }, null],
    });
    const { user, applied } = setup(saved);
    await user.click(screen.getByRole("option", { name: "布帽" }));
    expect(screen.queryByRole("region", { name: "隨機素質" })).not.toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "插槽" })).not.toBeInTheDocument();
    expect(screen.queryByText(/舊版手動合計/)).not.toBeInTheDocument();
    await user.click(screen.getByRole("option", { name: "聖龍盔" }));
    expect(screen.getByRole("textbox", { name: "命中數值" })).toHaveValue("60");
    await user.click(screen.getByRole("option", { name: "布帽" }));
    await user.click(screen.getByRole("button", { name: "套用" }));
    expect(applied()).toEqual({ itemId: 602, enhancementLevel: 0, manualBonuses: {} });
  });

  it("條數與插槽數提示：勾太多只提醒不擋套用", async () => {
    const { user, applied } = setup(fresh());
    const rolls = within(screen.getByRole("region", { name: "隨機素質" }));
    expect(rolls.getByText(/^這件會出現 0–1 條。/)).toBeInTheDocument();
    expect(
      within(screen.getByRole("region", { name: "插槽" })).getByText(
        /^這件有 1–2 個插槽，沒有的槽留空即可。/,
      ),
    ).toBeInTheDocument();
    expect(rolls.queryByRole("status")).not.toBeInTheDocument();

    await user.click(screen.getByRole("checkbox", { name: /^命中/ }));
    await user.click(screen.getByRole("checkbox", { name: /^防禦/ }));
    expect(rolls.getByRole("status")).toHaveTextContent("勾了 2 條，超過這件最多 1 條，請確認");
    expect(screen.queryByText(/項需修正/)).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "套用" }));
    expect(applied()?.randomRolls).toHaveLength(2);
  });

  it("固定條數：少勾時溫和提示；槽數上下限相同不多說明", async () => {
    const { user } = setup({ itemId: 603, enhancementLevel: 0, manualBonuses: {} });
    const rolls = within(screen.getByRole("region", { name: "隨機素質" }));
    expect(rolls.getByText(/^這件固定出現 2 條。/)).toBeInTheDocument();
    expect(rolls.getByRole("status")).toHaveTextContent("這件應該有 2 條");
    expect(screen.queryByText(/個插槽，沒有的槽留空即可/)).not.toBeInTheDocument();
    await user.click(screen.getByRole("checkbox", { name: /^命中/ }));
    await user.click(screen.getByRole("checkbox", { name: /^閃躲/ }));
    expect(rolls.queryByRole("status")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "套用" })).toBeEnabled();
  });

  it("取消不會套用草稿", async () => {
    const { user, onApply, onClose } = setup(fresh());
    await user.click(screen.getByRole("checkbox", { name: /^命中/ }));
    await user.click(screen.getByRole("button", { name: "取消" }));
    expect(onClose).toHaveBeenCalled();
    expect(onApply).not.toHaveBeenCalled();
  });
});

describe("插槽配方選單", () => {
  it("同怪物、效果相同的配方合併成一筆，舊存檔的配方 id 也能顯示", async () => {
    const { openRecipes } = setup(
      fresh({
        sockets: [
          { recipeId: 13, stat: "hit", value: 7 },
          { recipeId: 90, stat: "hit", value: 3 },
        ],
      }),
    );
    expect(screen.getByRole("combobox", { name: "第 1 槽配方" })).toHaveTextContent(
      "獵人· 命中 +7",
    );
    expect(screen.getByRole("combobox", { name: "第 2 槽配方" })).toHaveTextContent("絕版魂石");

    const pop = await openRecipes("第 1 槽");
    const hunter = pop.getByRole("option", { name: /^獵人/ });
    expect(hunter).toHaveTextContent("小真元強化／強化裝備");
    expect(hunter).toHaveAttribute("aria-selected", "true");
    expect(pop.getByRole("option", { name: /^赤血巨蠍/ })).toHaveTextContent("僅強化裝備");
    expect(pop.getByRole("option", { name: /^吉魂珠/ })).toHaveTextContent(
      "魂珠強化 數值隨機物攻 10–30", // 全形空白會被正規化,
    );
    expect(pop.getByTestId("recipe-count")).toHaveTextContent("全部 · 7 筆");
    expect(pop.getByText("效果一樣的配方已合併")).toBeInTheDocument();
    expect(pop.getAllByRole("option")[0]).toHaveTextContent("空槽不插配方");
  });

  it("屬性 chip 篩選後依數值由高到低，隨機配方用最小值排", async () => {
    const { openRecipes, user } = setup(fresh());
    const pop = await openRecipes("第 1 槽");
    const chips = within(pop.getByRole("group", { name: "屬性篩選" }));
    expect(chips.getAllByRole("button").map((b) => b.textContent)).toEqual([
      "全部",
      "物攻",
      "命中",
      "防禦",
    ]);
    await user.click(chips.getByRole("button", { name: "物攻" }));
    expect(chips.getByRole("button", { name: "物攻" })).toHaveAttribute("aria-pressed", "true");
    expect(pop.getByTestId("recipe-count")).toHaveTextContent("物攻 · 5 筆");
    const order = pop.getAllByRole("option").map((o) => o.textContent);
    expect(order.slice(1, 4)).toEqual([
      "赤血巨蠍僅強化裝備物攻 +30",
      "牛魔人僅強化裝備物攻 +21",
      "藍頸熊僅強化裝備物攻 +15",
    ]);
    expect(order.slice(4).every((t) => /^(吉魂珠|玄武魂珠)/.test(t ?? ""))).toBe(true);
  });

  it("搜尋怪物名稱或屬性；查無結果時保留搜尋框與 chip", async () => {
    const { openRecipes, user } = setup(fresh());
    const pop = await openRecipes("第 1 槽");
    const search = pop.getByRole("combobox", { name: "搜尋配方" });
    await user.type(search, "幽靈");
    expect(pop.getAllByRole("option").map((o) => o.textContent)).toEqual([
      "空槽不插配方",
      "幽靈侍衛僅強化裝備防禦 +11",
    ]);
    expect(pop.getByTestId("recipe-count")).toHaveTextContent("「幽靈」 · 1 筆");

    await user.clear(search);
    await user.type(search, "防禦");
    expect(
      pop
        .getAllByRole("option")
        .slice(1)
        .map((o) => o.textContent?.slice(0, 4)),
    ).toEqual(expect.arrayContaining(["幽靈侍衛", "玄武魂珠"]));

    await user.clear(search);
    await user.type(search, "麒麟");
    expect(pop.getByText("找不到符合的配方，換個關鍵字或把屬性改回「全部」。")).toBeInTheDocument();
    expect(pop.queryAllByRole("option")).toHaveLength(0);
    expect(pop.getByRole("group", { name: "屬性篩選" })).toBeInTheDocument();
    expect(search).toBeInTheDocument();
  });

  it("鍵盤：方向鍵移動、Enter 選取、Esc 關閉；合併列存第一筆配方 id", async () => {
    const { openRecipes, user, applied } = setup(fresh());
    await openRecipes("第 1 槽");
    await user.keyboard("獵人{ArrowDown}{ArrowDown}{Enter}");
    await waitFor(() => expect(screen.queryByLabelText("第 1 槽配方清單")).not.toBeInTheDocument());
    expect(screen.getByRole("combobox", { name: "第 1 槽配方" })).toHaveTextContent("獵人");

    await openRecipes("第 2 槽");
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByLabelText("第 2 槽配方清單")).not.toBeInTheDocument());
    expect(screen.getByRole("dialog")).toBeInTheDocument(); // Esc 只關選單，不關整個視窗

    await user.click(screen.getByRole("button", { name: "套用" }));
    expect(applied()?.sockets).toEqual([{ recipeId: 10, stat: "hit", value: 7 }, null]);
  });
});
