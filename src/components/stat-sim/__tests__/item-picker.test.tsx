import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
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
      socketCount: 2,
      socketCategory: 1,
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
  },
  socketRecipeIdsByCategory: { 1: [10, 11, 12] },
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
  return { user, onApply, onClose, pick, applied: () => onApply.mock.lastCall?.[1] };
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
    const { user, pick, applied } = setup(
      fresh({ randomRolls: [{ attribute: "命中", value: 72 }] }),
    );
    expect(screen.getByText("第 1 槽")).toBeInTheDocument();
    await pick("第 1 槽配方", "獵人強化裝備");
    expect(screen.queryByRole("textbox", { name: "第 1 槽數值" })).not.toBeInTheDocument();
    expect(screen.getByText("+7")).toBeInTheDocument();

    await pick("第 2 槽配方", "吉魂珠強化");
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
    const { pick, applied, user } = setup(fresh());
    await pick("第 1 槽配方", "玄武魂珠強化");
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

  it("取消不會套用草稿", async () => {
    const { user, onApply, onClose } = setup(fresh());
    await user.click(screen.getByRole("checkbox", { name: /^命中/ }));
    await user.click(screen.getByRole("button", { name: "取消" }));
    expect(onClose).toHaveBeenCalled();
    expect(onApply).not.toHaveBeenCalled();
  });
});
