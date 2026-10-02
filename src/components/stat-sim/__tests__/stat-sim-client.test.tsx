import { beforeEach, describe, expect, it } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { StatSimClient } from "../stat-sim-client";
import type { GameData, UiControl, UiWindowLayout } from "@/lib/types/stat-sim";

const ctrl = (
  c: Partial<UiControl> & Pick<UiControl, "ctrlId" | "class" | "x" | "y" | "width" | "height">,
): UiControl => ({
  title: null,
  field: null,
  comment: null,
  color: "#000000",
  iconUrl: null,
  ...c,
});

/** 只留測試用得到的控制項，座標取自真實 ui_controls。 */
const attribute: UiWindowLayout = {
  window: "Attribute",
  name: "基本屬性",
  width: 400,
  height: 162,
  backgroundUrl: "/attr.png",
  controls: [
    ctrl({ ctrlId: 6, class: "BUTTON", x: 215, y: 29, width: 12, height: 12, iconUrl: "/up.png" }),
    ctrl({ ctrlId: 214, class: "STATIC", title: "外功", x: 158, y: 28, width: 24, height: 15 }),
    ctrl({ ctrlId: 222, class: "STATIC", title: "屬性點", x: 350, y: 48, width: 36, height: 15 }),
    ctrl({ ctrlId: 223, class: "STATIC", title: "物攻", x: 153, y: 86, width: 29, height: 15 }),
    ctrl({ ctrlId: 264, class: "STATIC", field: "外功", x: 184, y: 28, width: 28, height: 15 }),
    ctrl({ ctrlId: 819, class: "STATIC", field: "外功+", x: 230, y: 28, width: 18, height: 15 }),
    ctrl({ ctrlId: 948, class: "STATIC", field: "屬性點", x: 351, y: 64, width: 35, height: 15 }),
    ctrl({ ctrlId: 949, class: "STATIC", field: "物攻", x: 188, y: 86, width: 36, height: 15 }),
  ],
};
const equipment: UiWindowLayout = {
  window: "accoutrements_A",
  name: "裝備欄",
  width: 200,
  height: 318,
  backgroundUrl: "/eq.png",
  controls: [
    ctrl({
      ctrlId: 292,
      class: "BUTTON",
      comment: "BTN-8-N-帽子",
      x: 36,
      y: 26,
      width: 40,
      height: 40,
    }),
  ],
};

const data: GameData = {
  itemsById: {
    501: {
      id: 501,
      name: "測試帽",
      level: 10,
      typeName: "HELMET",
      slotHint: ["cap"],
      iconUrl: null,
      stats: { str: 5 },
      strongPathId: null,
    },
  },
  enhancementsByPath: {},
  passives: [
    // 惡人谷（預設角色）的主門派技能，Lv1 就能學滿
    {
      id: 13,
      name: "測試刀法",
      group: "main",
      clan: "CLASS_BAD",
      maxLevel: 2,
      learnLevels: [0, 1, 1],
      iconUrl: null,
      cumulative: [{}, { atk: 4 }, { atk: 8 }],
    },
  ],
};

beforeEach(() => localStorage.clear());

describe("StatSimClient", () => {
  it("加點、換裝、點被動都會即時更新面板", async () => {
    const user = userEvent.setup();
    render(<StatSimClient data={data} windows={{ attribute, equipment }} />);

    // 預設角色 Lv1：升級點數 6，六圍都是 1 → 物攻 3
    const total = await screen.findByTestId("source-total");
    expect(total).toHaveTextContent("3");
    expect(screen.getByTestId("remaining-points")).toHaveTextContent("6");

    await user.click(screen.getByRole("button", { name: "外功加 1 點（需要 1 點）" }));
    expect(screen.getByTestId("source-total")).toHaveTextContent("6");
    expect(screen.getByTestId("remaining-points")).toHaveTextContent("5");

    // 帽子 +5 外功：不含裝 2 → 含裝 7，物攻 floor(21 + 0.4 × 2) = 21
    await user.click(screen.getByRole("button", { name: /^帽子：未裝備/ }));
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("option", { name: "測試帽" }));
    await user.click(within(dialog).getByRole("button", { name: "套用" }));
    await waitFor(() => expect(screen.getByTestId("source-total")).toHaveTextContent("21"));
    expect(screen.getByRole("button", { name: /^外功 7/ })).toBeInTheDocument();

    // 被動全滿：測試刀法 Lv2 物攻 +8
    await user.click(screen.getByRole("tab", { name: /被動與加成/ }));
    await user.click(await screen.findByRole("button", { name: /全部點滿/ }));
    expect(screen.getByTestId("source-total")).toHaveTextContent("29");

    // 存進 localStorage 的是不含裝外功
    const saved = JSON.parse(localStorage.getItem("genbu.characters")!);
    expect(saved.characters[0].attributes.str).toBe(2);
    expect(saved.characters[0].equipment.cap).toEqual({
      itemId: 501,
      enhancementLevel: 0,
      manualBonuses: {},
    });
  });
});
