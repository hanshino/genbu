import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { StrictMode } from "react";
import { track } from "@/lib/analytics/track";
import type { MeridianData, UiImage } from "@/lib/types/meridian";
import { MeridianSimulator } from "./meridian-simulator";

vi.mock("@/lib/analytics/track", () => ({ track: vi.fn() }));

const image: UiImage = {
  iconId: 1, state: "normal", frame: 0, url: "/meridian.png",
  width: 100, height: 100, posX: 0, posY: 0, anchorX: 0, anchorY: 0,
};
const data: MeridianData = {
  channels: [{ channelNo: 1, name: "任脈", tabImage: image, baseImage: image, baseX: 0, baseY: 0 }],
  points: [{
    id: 855, name: "承漿", channelNo: 1, maxLevel: 3, isRoot: true, slot: 1, btnX: 100, btnY: 100,
    levels: [1, 2, 3].map((level) => ({
      level, cost: level === 1 ? null : 10, prob: 100, prereqs: [], stats: [], help: null,
    })),
  }],
  images: {},
};

beforeEach(() => {
  localStorage.clear();
  window.history.replaceState(null, "", "/tools/meridian");
  vi.mocked(track).mockClear();
});

describe("MeridianSimulator analytics", () => {
  it("URL hydration 不記錄事件；升降級、全滿、清空、分享各記錄一次", async () => {
    const user = userEvent.setup();
    window.history.replaceState(null, "", "/tools/meridian?p=855.2");
    render(<MeridianSimulator data={data} />);
    expect(screen.getByRole("tab", { name: "規劃模式" })).toHaveAttribute("aria-selected", "true");
    expect(track).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "承漿 升一級" }));
    await user.click(screen.getByRole("button", { name: "承漿 降一級" }));
    await user.click(screen.getByRole("button", { name: "本脈全滿" }));
    await user.click(screen.getByRole("button", { name: "本脈清空" }));
    await user.click(screen.getByRole("button", { name: "全滿" }));
    await user.click(screen.getByRole("button", { name: "複製分享連結" }));
    await user.click(screen.getByRole("button", { name: "清空" }));
    expect(vi.mocked(track).mock.calls).toEqual([
      ["meridian_point", { action: "add" }],
      ["meridian_point", { action: "remove" }],
      ["meridian_fill", { scope: "channel" }],
      ["meridian_reset", { mode: "plan", scope: "channel" }],
      ["meridian_fill", { scope: "all" }],
      ["meridian_share", { via: "clipboard" }],
      ["meridian_reset", { mode: "plan", scope: "all" }],
    ]);
  });

  it("輸入丹田不記錄；套用、兌換、打通、重來及模式切換記錄事件", async () => {
    const user = userEvent.setup();
    render(<StrictMode><MeridianSimulator data={data} /></StrictMode>);
    await user.clear(screen.getByRole("spinbutton", { name: "起始丹田" }));
    await user.type(screen.getByRole("spinbutton", { name: "起始丹田" }), "123");
    expect(track).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "套用並重來" }));
    await user.click(screen.getByRole("button", { name: "用經驗換" }));
    await user.click(screen.getByRole("button", { name: "打通經脈" }));
    await user.click(screen.getByRole("button", { name: "重來" }));
    await user.click(screen.getByRole("tab", { name: "規劃模式" }));
    expect(vi.mocked(track).mock.calls).toEqual([
      ["meridian_reset", { mode: "play" }],
      ["meridian_convert_exp"],
      ["meridian_attempt", { outcome: "success" }],
      ["meridian_reset", { mode: "play" }],
      ["meridian_mode", { mode: "plan" }],
    ]);
  });

  it("Slider 只在結束操作時記錄，分享 fallback 不重複記錄", async () => {
    const user = userEvent.setup();
    render(<MeridianSimulator data={data} />);
    await user.click(screen.getByRole("tab", { name: "規劃模式" }));
    vi.mocked(track).mockClear();
    // jsdom 沒有 layout；Base UI thumb 在量到尺寸前維持 visibility:hidden。
    const slider = within(screen.getByRole("group", { name: "承漿 等級" })).getByRole("slider", { hidden: true });
    act(() => slider.focus());
    await user.keyboard("{ArrowRight>}");
    // Base UI 將鍵盤單次調級視為立即 commit；keyup 不應重送。
    expect(track).toHaveBeenCalledExactlyOnceWith("meridian_point", { action: "add" });
    await user.keyboard("{/ArrowRight}");
    expect(track).toHaveBeenCalledExactlyOnceWith("meridian_point", { action: "add" });
    vi.mocked(track).mockClear();
    vi.spyOn(navigator.clipboard, "writeText").mockRejectedValueOnce(new Error("denied"));
    const prompt = vi.spyOn(window, "prompt").mockReturnValue(null);
    await user.click(screen.getByRole("button", { name: "複製分享連結" }));
    expect(track).toHaveBeenCalledExactlyOnceWith("meridian_share", { via: "prompt" });
    prompt.mockRestore();
  });
});
