import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ComponentProps } from "react";
import { SalonClient } from "./salon-client";

const { track, replace } = vi.hoisted(() => ({ track: vi.fn(), replace: vi.fn() }));
vi.mock("@/lib/analytics/track", () => ({ track }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace }) }));
vi.mock("./doll-preview", () => ({
  DollPreview: () => <div />,
  buildDollLayers: () => [],
}));

const look = {
  key: "right:1",
  slot: "right" as const,
  layers: [{ slot: "right" as const, sequence: 1 }],
  offhandLayers: [{ slot: "left" as const, sequence: 1 }],
  icon: null,
  items: [{ itemId: 123, name: "測試武器", isExtra: false }],
  hasImage: true,
};
const props: ComponentProps<typeof SalonClient> = {
  gender: "m",
  slots: [{ slot: "right", label: "武器", sortOrder: 0, replaces: null }],
  counts: { right: 1 },
  heads: [1, 2].map((sequence) => ({ sequence, label: `頭型 ${sequence}`, itemId: sequence })),
  hairColors: [1, 2].map((sequence) => ({ sequence, color: 1, label: "紅色", r: 1, g: 0, b: 0 })),
  initialHair: 0,
  rules: [],
  initialFrames: [1, 2].flatMap((sequence) => [0, 1].map((color) => ({
    slot: "head" as const, sequence, color, dir: 7, action: "wait" as const,
    url: "/test.png", width: 10, height: 10, anchorX: 0, anchorY: 0, points: null,
  }))),
  initialTab: "right",
  initialLooks: [look],
  initialWorn: { right: { itemId: 123, look } },
  defaultWorn: {},
  initialHead: 1,
  defaultHead: 1,
  initialDir: 7,
  initialHand: "r",
  base: {},
};

beforeEach(() => vi.clearAllMocks());
afterEach(cleanup);

describe("SalonClient analytics", () => {
  it("does not track initial URL hydration, search, unchanged selections or reset", () => {
    render(<SalonClient {...props} />);
    fireEvent.change(screen.getByRole("textbox", { name: "搜尋武器" }), {
      target: { value: "測試" },
    });
    fireEvent.click(screen.getByLabelText("頭型 1"));
    fireEvent.click(screen.getByLabelText("方向 正面"));
    fireEvent.click(within(screen.getByRole("group", { name: "性別" })).getByText("男"));
    fireEvent.click(screen.getByRole("button", { name: "重設" }));
    fireEvent.click(screen.getByRole("option", { name: "不穿武器" }));
    expect(track).not.toHaveBeenCalled();
  });

  it("tracks discrete appearance selections with only control and gender", () => {
    render(<SalonClient {...props} />);
    fireEvent.click(screen.getByLabelText("頭型 2"));
    fireEvent.click(screen.getByLabelText("髮色：紅色"));
    fireEvent.click(within(screen.getByRole("group", { name: "武器拿在哪一手" })).getByText("左手"));
    fireEvent.click(screen.getByRole("option", { name: "測試武器" }));
    fireEvent.click(screen.getByRole("option", { name: "測試武器" }));
    fireEvent.click(screen.getByRole("option", { name: "不穿武器" }));
    fireEvent.click(screen.getByLabelText("方向 右側"));
    fireEvent.keyDown(document.body, { key: "ArrowRight" });
    fireEvent.keyDown(document.body, { key: "ArrowRight", repeat: true });
    fireEvent.keyDown(screen.getByRole("textbox", { name: "搜尋武器" }), { key: "ArrowLeft" });
    fireEvent.click(within(screen.getByRole("group", { name: "性別" })).getByText("女"));
    expect(track.mock.calls).toEqual([
      ["salon_change", { control: "head", gender: "m" }],
      ["salon_change", { control: "hair", gender: "m" }],
      ["salon_change", { control: "hand", gender: "m" }],
      ...Array.from({ length: 3 }, () => ["salon_change", { control: "right", gender: "m" }]),
      ...Array.from({ length: 2 }, () => ["salon_change", { control: "dir", gender: "m" }]),
      ["salon_change", { control: "gender", gender: "f" }],
    ]);
    expect(replace).toHaveBeenCalledOnce();
  });

  it("tracks sharing only after a successful clipboard write", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
    const prompt = vi.spyOn(window, "prompt").mockReturnValue(null);
    try {
      render(<SalonClient {...props} />);
      fireEvent.click(screen.getByRole("button", { name: "複製分享連結" }));
      expect(track).not.toHaveBeenCalled();
      await waitFor(() => expect(track).toHaveBeenCalledWith("salon_share", { gender: "m" }));
      expect(writeText).toHaveBeenCalledWith(expect.stringContaining("/tools/salon?"));

      track.mockClear();
      writeText.mockRejectedValue(new Error("clipboard unavailable"));
      fireEvent.click(screen.getByRole("button", { name: "已複製連結" }));
      await waitFor(() => expect(prompt).toHaveBeenCalledOnce());
      expect(track).not.toHaveBeenCalled();
    } finally {
      prompt.mockRestore();
      Reflect.deleteProperty(navigator, "clipboard");
    }
  });
});
