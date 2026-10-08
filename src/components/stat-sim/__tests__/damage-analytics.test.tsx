import { afterEach, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { StrictMode } from "react";
import { track } from "@/lib/analytics/track";
import { createDefaultCharacter } from "@/lib/stat-character";
import { computePanel } from "@/lib/stat-sim";
import type { GameData } from "@/lib/types/stat-sim";
import { DamageTab } from "../damage-tab";

vi.mock("@/lib/analytics/track", () => ({ track: vi.fn() }));
afterEach(() => vi.unstubAllGlobals());

it("傷害分頁不記錄 hydration 或輸入字元，只記錄選擇、按鈕和 blur commit", async () => {
  localStorage.clear();
  vi.mocked(track).mockClear();
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({
      skills: [],
      monsters: [{ id: 1, name: "測試怪", level: 1, hp: 100, extraDef: 0, magicDef: 0 }],
    }),
  }));
  const data: GameData = { itemsById: {}, enhancementsByPath: {}, passives: [], meridianIds: [] };
  const character = createDefaultCharacter();
  const user = userEvent.setup();
  render(<StrictMode><DamageTab character={character} data={data} panel={computePanel(character, data)} /></StrictMode>);
  const target = await screen.findByRole("combobox", { name: "目標怪物" });
  expect(track).not.toHaveBeenCalled();
  await user.type(target, "測試");
  expect(track).not.toHaveBeenCalled();
  await user.click(await screen.findByRole("option", { name: /測試怪/ }));
  expect(track).toHaveBeenCalledExactlyOnceWith("statsim_edit", { area: "target" });
  vi.mocked(track).mockClear();
  await user.click(screen.getByRole("button", { name: "加入連段：普攻" }));
  expect(track).toHaveBeenCalledExactlyOnceWith("statsim_edit", { area: "skill" });
  vi.mocked(track).mockClear();
  const count = screen.getByRole("spinbutton", { name: "普攻次數" });
  await user.clear(count);
  await user.type(count, "12");
  expect(track).not.toHaveBeenCalled();
  await user.tab();
  expect(track).toHaveBeenCalledExactlyOnceWith("statsim_edit", { area: "skill" });
  vi.mocked(track).mockClear();
  const timing = screen.getByRole("spinbutton", { name: /普攻間隔/ });
  await user.clear(timing);
  await user.type(timing, "1.25");
  expect(track).not.toHaveBeenCalled();
  await user.tab();
  expect(track).toHaveBeenCalledExactlyOnceWith("statsim_edit", { area: "skill" });
  vi.mocked(track).mockClear();
  await user.click(within(screen.getByRole("region", { name: "循環試算" })).getByRole("button", { name: "清空" }));
  expect(track).toHaveBeenCalledExactlyOnceWith("statsim_edit", { area: "skill" });
});
