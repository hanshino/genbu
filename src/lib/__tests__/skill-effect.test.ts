import { describe, it, expect } from "vitest";
import {
  casterPose,
  effectFrameIndex,
  hitTicks,
  indexSprites,
  msPerTick,
  referencedSprites,
  stripFrameIndex,
  targetPose,
  totalTicks,
  type ActorStrip,
  type EffectSprite,
  type StripSet,
  type TimelineFrame,
  type TimelineObject,
} from "../skill-effect";

function strip(delays: number[]): ActorStrip {
  return {
    url: "x.png", width: null, height: null, cellW: 10, cellH: 10,
    frames: delays.length, anchorX: 0, anchorY: 0, delays,
  };
}

const casterStrips: StripSet = {
  prepare: strip([7, 7, 7, 7]),
  wait: strip([8]),
  chop: strip([4, 4, 4, 4]),
};
const targetStrips: StripSet = {
  wait: strip([15, 15, 15, 15]),
  hurt: strip([6, 6, 6, 6]),
  death: strip([5, 5, 5, 999]),
};

function obj(
  id: number,
  seq: number | null,
  action: string,
  frame: number,
  delay: number | null = null,
): TimelineObject {
  return [id, seq, action, frame, 0, 0, 0, 1, 1, 32, delay, 0];
}

describe("stripFrameIndex", () => {
  const d = [4, 4, 4, 4];
  it("依 delays 累加找出所在格", () => {
    expect(stripFrameIndex(d, 0)).toBe(0);
    expect(stripFrameIndex(d, 3)).toBe(0);
    expect(stripFrameIndex(d, 4)).toBe(1);
    expect(stripFrameIndex(d, 15)).toBe(3);
  });
  it("播完回傳 -1", () => {
    expect(stripFrameIndex(d, 16)).toBe(-1);
    expect(stripFrameIndex([], 0)).toBe(-1);
  });
  it("override 取代每一格的 delay", () => {
    expect(stripFrameIndex(d, 13, 7)).toBe(1);
    expect(stripFrameIndex(d, 28, 7)).toBe(-1);
    expect(stripFrameIndex(d, 27, 7)).toBe(3);
  });
  it("override 為 null 或 0 時沿用原 delay", () => {
    expect(stripFrameIndex(d, 4, null)).toBe(1);
    expect(stripFrameIndex(d, 4, 0)).toBe(1);
  });
});

describe("hitTicks", () => {
  it("只取 hit 事件，沒有 e 的格子不會出錯", () => {
    const frames: TimelineFrame[] = [
      { t: 0, o: [] },
      { t: 3, o: [], e: [{ type: "hit" }] },
      { t: 5, o: [], e: [{ type: "other" }] },
      { t: 9, o: [], e: [{ type: "hit" }, { type: "hit" }] },
    ];
    expect(hitTicks(frames)).toEqual([3, 9]);
    expect(hitTicks([])).toEqual([]);
  });
});

describe("casterPose", () => {
  it("腳本動作播放中：依 frame 取格", () => {
    expect(casterPose(obj(1, null, "CHOP", 5), casterStrips, 5)).toEqual({ action: "chop", index: 1 });
  });
  it("delay 覆寫生效", () => {
    expect(casterPose(obj(1, null, "CHOP", 13, 7), casterStrips, 13)).toEqual({ action: "chop", index: 1 });
  });
  it("動作播完回到 prepare 循環", () => {
    // prepare 總長 28；tick 30 → 取餘數 2 → 第 0 格
    expect(casterPose(obj(1, null, "CHOP", 99), casterStrips, 30)).toEqual({ action: "prepare", index: 0 });
    expect(casterPose(obj(1, null, "CHOP", 99), casterStrips, 9)).toEqual({ action: "prepare", index: 1 });
  });
  it("wait、未知動作、腳本已結束都走 prepare", () => {
    expect(casterPose(obj(1, null, "WAIT", 0), casterStrips, 0)?.action).toBe("prepare");
    expect(casterPose(obj(1, null, "NOPE", 0), casterStrips, 0)?.action).toBe("prepare");
    expect(casterPose(undefined, casterStrips, 0)?.action).toBe("prepare");
  });
  it("沒有 prepare 時退到 wait，都沒有就是 null", () => {
    expect(casterPose(undefined, { wait: strip([8]) }, 0)?.action).toBe("wait");
    expect(casterPose(undefined, {}, 0)).toBeNull();
  });
});

describe("targetPose", () => {
  const hits = [18];
  it("命中前播 wait 循環", () => {
    expect(targetPose(0, hits, targetStrips, false)).toEqual({ action: "wait", index: 0 });
    expect(targetPose(17, hits, targetStrips, false)).toEqual({ action: "wait", index: 1 });
  });
  it("命中那刻起播 hurt", () => {
    expect(targetPose(18, hits, targetStrips, false)).toEqual({ action: "hurt", index: 0 });
    expect(targetPose(18 + 7, hits, targetStrips, false)).toEqual({ action: "hurt", index: 1 });
    expect(targetPose(18 + 23, hits, targetStrips, false)).toEqual({ action: "hurt", index: 3 });
  });
  it("hurt 播完（沒勾擊倒）回到 wait", () => {
    expect(targetPose(18 + 24, hits, targetStrips, false)?.action).toBe("wait");
  });
  it("擊倒：最後一次命中的 hurt 播完接 death，並停在最後一格", () => {
    expect(targetPose(18 + 23, hits, targetStrips, true)).toEqual({ action: "hurt", index: 3 });
    expect(targetPose(18 + 24, hits, targetStrips, true)).toEqual({ action: "death", index: 0 });
    expect(targetPose(18 + 24 + 6, hits, targetStrips, true)).toEqual({ action: "death", index: 1 });
    expect(targetPose(18 + 24 + 15, hits, targetStrips, true)).toEqual({ action: "death", index: 3 });
    expect(targetPose(18 + 24 + 500, hits, targetStrips, true)).toEqual({ action: "death", index: 3 });
  });
  it("多段命中：只有最後一次命中後才會倒地", () => {
    const multi = [10, 20];
    expect(targetPose(10 + 8, multi, targetStrips, true)).toEqual({ action: "hurt", index: 1 });
    expect(targetPose(20, multi, targetStrips, true)).toEqual({ action: "hurt", index: 0 });
    expect(targetPose(20 + 24, multi, targetStrips, true)?.action).toBe("death");
  });
  it("缺少 hurt 或 death 動作時退回 wait", () => {
    expect(targetPose(20, hits, { wait: strip([15]) }, false)?.action).toBe("wait");
    expect(targetPose(18 + 30, hits, { wait: strip([15]), hurt: strip([6]) }, true)?.action).toBe("wait");
  });
});

describe("特效與時間", () => {
  it("referencedSprites 去重、state 轉小寫、略過角色物件", () => {
    const frames: TimelineFrame[] = [
      { t: 0, o: [obj(1, null, "CHOP", 0), obj(2, null, "WAIT", 0), obj(10, 5, "Fly", 0)] },
      { t: 1, o: [obj(10, 5, "FLY", 1), obj(11, 6, "Boom", 0)] },
    ];
    expect(referencedSprites(frames)).toEqual([
      { seq: 5, state: "fly" },
      { seq: 6, state: "boom" },
    ]);
  });
  it("indexSprites 以 seq + 小寫 state 為 key", () => {
    const map = indexSprites([{ seq: 5, state: "Fly" } as EffectSprite]);
    expect(map.has("5:fly")).toBe(true);
  });
  it("effectFrameIndex 超出就停在最後一格", () => {
    const sprite = { delays: [1, 1, 1], frames: 3 };
    expect(effectFrameIndex(1, sprite)).toBe(1);
    expect(effectFrameIndex(9, sprite)).toBe(2);
    expect(effectFrameIndex(-1, sprite)).toBe(0);
  });
  it("totalTicks 多留 30 個 tick；速度選項", () => {
    expect(totalTicks(92)).toBe(122);
    expect(msPerTick("tick", 16.67)).toBe(16.67);
    expect(msPerTick("slow", 16.67)).toBe(33.3);
    expect(msPerTick("step", 16.67)).toBe(100);
  });
});
