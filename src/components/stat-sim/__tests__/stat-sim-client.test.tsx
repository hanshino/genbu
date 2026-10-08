import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { StrictMode } from "react";
import { Blob as NodeBlob } from "node:buffer";
import { deflateRawSync } from "node:zlib";
import { CompressionStream, DecompressionStream } from "node:stream/web";
import userEvent from "@testing-library/user-event";
import { StatSimClient } from "../stat-sim-client";
import type { GameData, UiControl, UiWindowLayout } from "@/lib/types/stat-sim";
import { EQUIP_SLOTS } from "@/lib/types/stat-sim";
import { track } from "@/lib/analytics/track";

vi.mock("@/lib/analytics/track", () => ({ track: vi.fn() }));

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
  equipSlots: [{ slot: "cap", label: "帽子", ctrlId: 292, x: 36, y: 26, width: 40, height: 40 }],
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
  meridianIds: [],
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

beforeEach(() => {
  vi.mocked(track).mockClear();
  localStorage.clear();
  window.history.replaceState(null, "", "/tools/stat-sim");
});
afterEach(() => vi.unstubAllGlobals());

function importCode() {
  vi.stubGlobal("Blob", NodeBlob);
  vi.stubGlobal("CompressionStream", CompressionStream);
  vi.stubGlobal("DecompressionStream", DecompressionStream);
  return `TTHOL1.${deflateRawSync(JSON.stringify({
    v: 1, app: "proto", at: "2026-10-03T00:00:00Z", name: "匯入測試", sect: 2,
    level: 1, bare: { str: 1, pow: 1, vit: 1, agi: 1, dex: 1, wis: 1 }, remainingPoints: 6,
    equipment: Object.fromEntries(EQUIP_SLOTS.map((slot) => [slot, null])),
    skills: { 13: 1, 855: 3 }, panel: { attributes: { str: 1 }, hp: 100 },
  })).toString("base64url")}`;
}

describe("StatSimClient", () => {
  it("匯入新增一隻角色、顯示結果與面板對照，切換角色時隱藏", async () => {
    const code = importCode();
    const user = userEvent.setup();
    render(<StatSimClient data={{ ...data, meridianIds: [855] }} windows={{ attribute, equipment }} />);
    await screen.findByTestId("source-total");
    expect(track).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "匯入" }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText("貼上匯入字串"), { target: { value: code } });
    await user.click(within(dialog).getByRole("button", { name: "匯入" }));
    await screen.findByRole("region", { name: "匯入結果" });
    expect(track).toHaveBeenCalledExactlyOnceWith("statsim_import", { ok: true, via: "paste" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByRole("region", { name: "遊戲當時面板 vs 目前模擬" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "在經脈模擬器開啟" })).toHaveAttribute("href", "/tools/meridian?p=855.3");
    const saved = JSON.parse(localStorage.getItem("genbu.characters")!);
    expect(saved.characters).toHaveLength(2);
    expect(saved.activeCharacterId).toBe(saved.characters[1].id);
    expect(saved.characters[1].name).toBe("匯入測試");
    await user.click(screen.getByRole("button", { name: /新角色.*Lv1/ }));
    expect(screen.queryByRole("region", { name: "匯入結果" })).not.toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "遊戲當時面板 vs 目前模擬" })).not.toBeInTheDocument();
  });

  it("StrictMode hash 匯入只執行一次，清除 fragment 並保留 path/query", async () => {
    const code = importCode();
    window.history.replaceState(null, "", `/tools/stat-sim?keep=1#import=${code}`);
    render(<StrictMode><StatSimClient data={data} windows={{ attribute, equipment }} /></StrictMode>);
    await screen.findByRole("region", { name: "匯入結果" });
    await waitFor(() => expect(JSON.parse(localStorage.getItem("genbu.characters")!).characters).toHaveLength(2));
    expect(window.location.hash).toBe("");
    expect(window.location.pathname + window.location.search).toBe("/tools/stat-sim?keep=1");
    expect(track).toHaveBeenCalledExactlyOnceWith("statsim_import", { ok: true, via: "hash" });
  });

  it("匯入失敗時保留原角色與輸入內容", async () => {
    const user = userEvent.setup();
    render(<StatSimClient data={data} windows={{ attribute, equipment }} />);
    await screen.findByTestId("source-total");
    const before = localStorage.getItem("genbu.characters");
    await user.click(screen.getByRole("button", { name: "匯入" }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText("貼上匯入字串"), { target: { value: "TTHOL2.invalid" } });
    await user.click(within(dialog).getByRole("button", { name: "匯入" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("格式版本是 v2，請更新網站");
    expect(screen.getByLabelText("貼上匯入字串")).toHaveValue("TTHOL2.invalid");
    expect(localStorage.getItem("genbu.characters")).toBe(before);
    expect(track).toHaveBeenCalledExactlyOnceWith("statsim_import", { ok: false, via: "paste" });
  });

  it("hash 匯入失敗時開啟預填對話框，空清單不新增角色", async () => {
    localStorage.setItem("genbu.characters", JSON.stringify({ version: 1, activeCharacterId: null, characters: [] }));
    window.history.replaceState(null, "", "/tools/stat-sim#import=TTHOL2.invalid");
    render(<StatSimClient data={data} windows={{ attribute, equipment }} />);
    expect(await screen.findByRole("alert")).toHaveTextContent("格式版本是 v2");
    expect(screen.getByRole<HTMLTextAreaElement>("textbox", { name: "貼上匯入字串" }).value).toContain("#import=TTHOL2.invalid");
    expect(window.location.hash).toBe("");
    expect(JSON.parse(localStorage.getItem("genbu.characters")!).characters).toHaveLength(0);
    expect(track).toHaveBeenCalledExactlyOnceWith("statsim_import", { ok: false, via: "hash" });
  });

  it("成就全滿／選級、收藏值換算與含裝輸入扣掉被動加成", async () => {
    const user = userEvent.setup();
    const reward = (id: number, name: string, group: "achievement" | "collection") => ({
      id,
      name,
      group,
      clan: null,
      maxLevel: 3,
      obtainableMax: group === "achievement" ? 2 : undefined,
      learnLevels: [0, -1, -1, -1],
      iconUrl: null,
      cumulative: [{}, { str: 1 }, { str: 2 }, { str: 3 }],
    });
    const rewards: GameData = {
      ...data,
      passives: [
        ...data.passives,
        reward(1189, "成就外功", "achievement"),
        reward(1151, "收藏體力", "collection"),
      ],
      collectionThresholds: [
        { value: 50, magicId: 1151, level: 1 },
        { value: 100, magicId: 1151, level: 2 },
      ],
    };
    render(<StatSimClient data={rewards} windows={{ attribute, equipment }} />);
    await screen.findByTestId("source-total");
    await user.click(screen.getByRole("tab", { name: /被動與加成/ }));
    const achievement = screen.getByLabelText("成就");
    await user.click(within(achievement).getByRole("button", { name: "全滿" }));
    expect(screen.getByRole("button", { name: /^外功 3/ })).toBeInTheDocument();
    screen.getByRole("combobox", { name: "成就外功等級" }).focus();
    await user.keyboard("{ArrowDown}");
    await screen.findByRole("option", { name: "Lv1" });
    expect(screen.queryByRole("option", { name: "Lv3" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("option", { name: "Lv1" }));
    expect(screen.getByRole("button", { name: /^外功 2/ })).toBeInTheDocument();
    const value = screen.getByRole("spinbutton", { name: "收藏值" });
    vi.mocked(track).mockClear();
    await user.type(value, "100");
    expect(track).not.toHaveBeenCalled();
    expect(screen.getByRole("spinbutton", { name: "收藏體力等級" })).toHaveValue(2);
    expect(screen.getByRole("button", { name: /^外功 4/ })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /^外功 4/ }));
    expect(track).toHaveBeenCalledExactlyOnceWith("statsim_edit", { area: "passive" });
    vi.mocked(track).mockClear();
    const attr = screen.getByRole("textbox", { name: "輸入含裝外功" });
    await user.clear(attr);
    await user.type(attr, "10{Enter}");
    expect(track).toHaveBeenCalledExactlyOnceWith("statsim_edit", { area: "stats" });
    const saved = () => JSON.parse(localStorage.getItem("genbu.characters")!).characters[0];
    expect(saved().attributes.str).toBe(7); // 10 − 成就1 − 收藏2
    expect(saved().passiveLevels).toMatchObject({ 1189: 1, 1151: 2 });
    await user.clear(value);
    await user.type(value, "0");
    expect(saved().passiveLevels[1151]).toBe(0);
    const perSkill = screen.getByRole("spinbutton", { name: "收藏體力等級" });
    await user.clear(perSkill);
    await user.type(perSkill, "1");
    expect(value).toHaveValue(null);
    expect(saved().passiveLevels[1151]).toBe(1);
    expect(saved()).not.toHaveProperty("collectionValue");
  });

  it("加點、換裝、點被動都會即時更新面板", async () => {
    const user = userEvent.setup();
    render(<StatSimClient data={data} windows={{ attribute, equipment }} />);

    // 預設角色 Lv1：升級點數 6，六圍都是 1 → 物攻 3
    const total = await screen.findByTestId("source-total");
    expect(total).toHaveTextContent("3");
    expect(track).not.toHaveBeenCalled();
    expect(screen.getByTestId("remaining-points")).toHaveTextContent("6");

    await user.click(screen.getByRole("button", { name: "外功加 1 點（需要 1 點）" }));
    expect(screen.getByTestId("source-total")).toHaveTextContent("6");
    expect(screen.getByTestId("remaining-points")).toHaveTextContent("5");
    expect(track).toHaveBeenCalledExactlyOnceWith("statsim_edit", { area: "stats" });
    vi.mocked(track).mockClear();

    // 帽子 +5 外功：不含裝 2 → 含裝 7，物攻 floor(21 + 0.4 × 2) = 21
    await user.click(screen.getByRole("button", { name: /^帽子：未裝備/ }));
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("option", { name: "測試帽" }));
    expect(track).not.toHaveBeenCalled();
    await user.click(within(dialog).getByRole("button", { name: "套用" }));
    await waitFor(() => expect(screen.getByTestId("source-total")).toHaveTextContent("21"));
    expect(screen.getByRole("button", { name: /^外功 7/ })).toBeInTheDocument();
    expect(track).toHaveBeenCalledExactlyOnceWith("statsim_edit", { area: "equipment" });
    vi.mocked(track).mockClear();

    // 被動全滿：測試刀法 Lv2 物攻 +8
    await user.click(screen.getByRole("tab", { name: /被動與加成/ }));
    await user.click(await screen.findByRole("button", { name: /全部點滿/ }));
    expect(screen.getByTestId("source-total")).toHaveTextContent("29");
    expect(track).toHaveBeenCalledExactlyOnceWith("statsim_edit", { area: "passive" });

    // 存進 localStorage 的是不含裝外功
    const saved = JSON.parse(localStorage.getItem("genbu.characters")!);
    expect(saved.characters[0].attributes.str).toBe(2);
    expect(saved.characters[0].equipment.cap).toEqual({
      itemId: 501,
      enhancementLevel: 0,
      manualBonuses: {},
    });
  });

  it("角色操作只在確認時記錄，不記錄改名字元或取消刪除", async () => {
    const user = userEvent.setup();
    render(<StrictMode><StatSimClient data={data} windows={{ attribute, equipment }} /></StrictMode>);
    await screen.findByTestId("source-total");
    expect(track).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "新增" }));
    await user.click(screen.getByRole("button", { name: "複製" }));
    await user.click(screen.getAllByRole("button", { name: /^新角色.*Lv1/ })[0]);
    expect(vi.mocked(track).mock.calls).toEqual([
      ["statsim_character", { action: "add" }],
      ["statsim_character", { action: "duplicate" }],
      ["statsim_character", { action: "switch" }],
    ]);
    vi.mocked(track).mockClear();
    await user.click(screen.getByRole("button", { name: "改名" }));
    await user.type(screen.getByRole("textbox", { name: "角色名稱" }), "測試");
    expect(track).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "儲存" }));
    expect(track).toHaveBeenCalledExactlyOnceWith("statsim_character", { action: "rename" });
    vi.mocked(track).mockClear();
    await user.click(screen.getByRole("button", { name: "刪除角色" }));
    await user.click(screen.getByRole("button", { name: "取消" }));
    expect(track).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "刪除角色" }));
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "刪除" }));
    expect(track).toHaveBeenCalledExactlyOnceWith("statsim_character", { action: "remove" });
  });

  it("等級輸入在 blur 後記錄一次；未變更不記錄", async () => {
    const user = userEvent.setup();
    render(<StatSimClient data={data} windows={{ attribute, equipment }} />);
    await screen.findByTestId("source-total");
    const level = screen.getByRole("spinbutton", { name: "等級" });
    await user.click(level);
    await user.keyboard("123");
    expect(track).not.toHaveBeenCalled();
    await user.tab();
    expect(track).toHaveBeenCalledExactlyOnceWith("statsim_edit", { area: "stats" });
    vi.mocked(track).mockClear();
    await user.click(level);
    await user.tab();
    expect(track).not.toHaveBeenCalled();
  });

  it("含裝模式換裝後可選擇維持剛才填的含裝數值，或照新裝備計算", async () => {
    const user = userEvent.setup();
    render(<StatSimClient data={data} windows={{ attribute, equipment }} />);
    await screen.findByTestId("source-total");
    expect(screen.getByText("請先填好裝備，再照遊戲角色視窗填六圍。")).toBeInTheDocument();
    const saved = () => JSON.parse(localStorage.getItem("genbu.characters")!).characters[0];

    // 點數值就全選，直接打字覆蓋
    await user.click(screen.getByRole("button", { name: /^外功 1/ }));
    const input = screen.getByRole<HTMLInputElement>("textbox", { name: "輸入含裝外功" });
    expect([input.selectionStart, input.selectionEnd]).toEqual([0, 1]);
    await user.keyboard("7{Enter}");
    expect(saved().attributes.str).toBe(7);

    const equipHat = async (button: "套用" | "卸下") => {
      await user.click(screen.getByRole("button", { name: /^帽子：/ }));
      const dialog = await screen.findByRole("dialog");
      if (button === "套用")
        await user.click(within(dialog).getByRole("option", { name: "測試帽" }));
      await user.click(within(dialog).getByRole("button", { name: button }));
    };

    // 帽子 +5 外功：含裝變 12，跳提示；維持 → 不含裝 7 − 5 = 2，含裝回到 7
    await equipHat("套用");
    expect(await screen.findByText("裝備變了，要維持剛才填的含裝數值嗎？")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "維持含裝數值" }));
    expect(saved().attributes.str).toBe(2);
    expect(screen.getByRole("button", { name: /^外功 7/ })).toBeInTheDocument();
    expect(screen.queryByText("裝備變了，要維持剛才填的含裝數值嗎？")).not.toBeInTheDocument();

    // 卸下帽子再跳一次；照新裝備計算 → 不含裝維持 2
    await equipHat("卸下");
    await user.click(await screen.findByRole("button", { name: "照新裝備計算" }));
    expect(screen.queryByText("裝備變了，要維持剛才填的含裝數值嗎？")).not.toBeInTheDocument();
    expect(saved().attributes.str).toBe(2);
    expect(screen.getByRole("button", { name: /^外功 2/ })).toBeInTheDocument();
  });

  it("新裝備的六圍超過填的含裝值時不能維持，改顯示錯誤", async () => {
    const user = userEvent.setup();
    render(<StatSimClient data={data} windows={{ attribute, equipment }} />);
    await screen.findByTestId("source-total");
    await user.click(screen.getByRole("button", { name: /^外功 1/ }));
    await user.keyboard("3{Enter}");
    await user.click(screen.getByRole("button", { name: /^帽子：/ }));
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("option", { name: "測試帽" }));
    await user.click(within(dialog).getByRole("button", { name: "套用" }));
    await user.click(await screen.findByRole("button", { name: "維持含裝數值" }));
    expect(screen.getByRole("alert")).toHaveTextContent("換算後不含裝會小於 1");
    expect(JSON.parse(localStorage.getItem("genbu.characters")!).characters[0].attributes.str).toBe(
      3,
    );
  });
});
