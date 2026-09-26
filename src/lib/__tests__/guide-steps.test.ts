import { describe, it, expect } from "vitest";
import {
  buildStepData,
  formatStatusResistance,
  cropFrame,
  fullFrameBox,
  inCrop,
  routeBox,
  ROUTE_ASPECT,
  toPercent,
  type BuildStepDataInput,
  type Crop,
  type StepStatInput,
} from "../guide-steps";
import { regionPath, walkRegion, type StageMapImage } from "@/lib/queries/maps";

// oracle from plan.md: img 6040×2800, crop [150,380,1400,1380]
const IMG: StageMapImage = {
  url: "https://img.hanshino.dev/ioocuj.webp",
  imgWidth: 6040,
  imgHeight: 2800,
  tilesW: 151,
  tilesH: 70,
  tilePx: 40,
};
const CROP: Crop = [150, 380, 1400, 1380];

describe("cropFrame", () => {
  it("matches the plan.md oracle for stage 1932 crop", () => {
    const f = cropFrame(IMG, CROP);
    expect(f.aspect).toBeCloseTo(1250 / 1000, 6);
    expect(f.width).toBeCloseTo(483.2, 5);
    expect(f.left).toBeCloseTo(-12, 5);
    expect(f.top).toBeCloseTo(-38, 5);
  });
});

describe("toPercent", () => {
  it("relative to crop: (480,480) → 26.4% / 10%", () => {
    const p = toPercent({ x: 480, y: 480 }, IMG, CROP);
    expect(p.left).toBeCloseTo(26.4, 5);
    expect(p.top).toBeCloseTo(10, 5);
  });

  it("relative to full image when crop=null", () => {
    const p = toPercent({ x: 480, y: 480 }, IMG, null);
    expect(p.left).toBeCloseTo((480 / 6040) * 100, 6);
    expect(p.top).toBeCloseTo((480 / 2800) * 100, 6);
  });
});

describe("fullFrameBox", () => {
  it("matches the plan.md oracle: left 2.483%, top 13.571%, width 20.695%, height 35.714%", () => {
    const b = fullFrameBox(IMG, CROP);
    expect(b.left).toBeCloseTo(2.483, 2);
    expect(b.top).toBeCloseTo(13.571, 2);
    expect(b.width).toBeCloseTo(20.695, 2);
    expect(b.height).toBeCloseTo(35.714, 2);
  });
});

describe("inCrop", () => {
  it("crop=null always true", () => {
    expect(inCrop({ x: -999, y: 999999 }, null)).toBe(true);
  });

  it("points inside the box are true, including edges", () => {
    expect(inCrop({ x: 150, y: 380 }, CROP)).toBe(true); // top-left corner
    expect(inCrop({ x: 1400, y: 1380 }, CROP)).toBe(true); // bottom-right corner
    expect(inCrop({ x: 480, y: 480 }, CROP)).toBe(true);
  });

  it("points outside the box (any axis) are false", () => {
    expect(inCrop({ x: 149, y: 480 }, CROP)).toBe(false);
    expect(inCrop({ x: 1401, y: 480 }, CROP)).toBe(false);
    expect(inCrop({ x: 480, y: 379 }, CROP)).toBe(false);
    expect(inCrop({ x: 480, y: 1381 }, CROP)).toBe(false);
  });
});

/* ── buildStepData ── */

function stat(overrides: Partial<StepStatInput> & { id: number }): StepStatInput {
  return {
    name: "被汙染的機關",
    level: 165,
    hp: 2296154,
    def: 4800,
    mdef: 280,
    dodge: 520,
    weakenRes: 100,
    bleedRes: 100,
    image: null,
    ...overrides,
  };
}

function baseInput(overrides: Partial<BuildStepDataInput> = {}): BuildStepDataInput {
  return {
    stageId: 1932,
    stageName: "謎霧之森",
    image: IMG,
    crop: CROP,
    groups: [],
    marks: [],
    stats: new Map(),
    points: new Map(),
    ...overrides,
  };
}

describe("buildStepData — crop filtering", () => {
  it("drops points outside crop, keeps in-crop points; out-of-crop-only id becomes missing", () => {
    const stats = new Map([
      [11034, stat({ id: 11034 })],
      [7712, stat({ id: 7712, name: "葵" })],
    ]);
    const points = new Map([
      [11034, [{ x: 480, y: 480 }]], // inside CROP
      [7712, [{ x: 0, y: 0 }]], // outside CROP
    ]);
    const data = buildStepData(
      baseInput({
        groups: [{ ids: [11034, 7712] }],
        stats,
        points,
      }),
    );
    expect(data.groups[0].points).toEqual([{ x: 480, y: 480 }]);
    expect(data.missing).toContain(7712);
    expect(data.missing).not.toContain(11034);
  });

  it("full view (crop=null passed at call site) draws only points still tied to the group; buildStepData itself only filters by the crop given in input", () => {
    const stats = new Map([[11034, stat({ id: 11034 })]]);
    const points = new Map([[11034, [{ x: 480, y: 480 }]]]);
    const data = buildStepData(
      baseInput({ crop: null, groups: [{ ids: [11034] }], stats, points }),
    );
    expect(data.groups[0].points).toEqual([{ x: 480, y: 480 }]);
    expect(data.missing).toEqual([]);
  });
});

describe("buildStepData — dedupe", () => {
  it("dedupes identical (x,y) points within a group", () => {
    const stats = new Map([[11034, stat({ id: 11034 })]]);
    const points = new Map([
      [
        11034,
        [
          { x: 480, y: 480 },
          { x: 480, y: 480 },
          { x: 500, y: 500 },
        ],
      ],
    ]);
    const data = buildStepData(baseInput({ groups: [{ ids: [11034] }], stats, points }));
    expect(data.groups[0].points).toEqual([
      { x: 480, y: 480 },
      { x: 500, y: 500 },
    ]);
  });
});

describe("buildStepData — grouping / merge / elite sub-rows", () => {
  it("preserves resistance fields and does not merge different resistances", () => {
    const stats = new Map([
      [1, stat({ id: 1, weakenRes: 95, bleedRes: 100 })],
      [2, stat({ id: 2, weakenRes: 100, bleedRes: 100 })],
      [3, stat({ id: 3, weakenRes: 100, bleedRes: 95 })],
    ]);
    const data = buildStepData(baseInput({ groups: [{ ids: [1, 2, 3], map: false }], stats }));
    expect(data.groups[0].rows.map((r) => [r.weakenRes, r.bleedRes])).toEqual([
      [95, 100],
      [100, 100],
      [100, 95],
    ]);
  });

  it("merges ids with identical stats into one row with count", () => {
    const stats = new Map([
      [11034, stat({ id: 11034 })],
      [11035, stat({ id: 11035 })], // same stats as 11034
    ]);
    const points = new Map([
      [11034, [{ x: 480, y: 480 }]],
      [11035, [{ x: 500, y: 500 }]],
    ]);
    const data = buildStepData(baseInput({ groups: [{ ids: [11034, 11035] }], stats, points }));
    expect(data.groups[0].rows).toHaveLength(1);
    expect(data.groups[0].rows[0].count).toBe(2);
    expect(data.groups[0].rows[0].id).toBe(11034); // first-seen id wins
  });

  it("different stats (elite ▲ vs normal) become separate sub-rows", () => {
    const stats = new Map([
      [11039, stat({ id: 11039, name: "▲黑化貝", hp: 164670, def: 1000, mdef: 616, dodge: 440 })],
      [11040, stat({ id: 11040, name: "黑化貝", hp: 173622, def: 880, mdef: 700, dodge: 440 })],
    ]);
    const points = new Map([
      [11039, [{ x: 700, y: 700 }]],
      [11040, [{ x: 750, y: 750 }]],
    ]);
    const data = buildStepData(baseInput({ groups: [{ ids: [11039, 11040] }], stats, points }));
    expect(data.groups[0].rows).toHaveLength(2);
    expect(data.groups[0].rows.map((r) => r.name)).toEqual(["▲黑化貝", "黑化貝"]);
    expect(data.groups[0].rows.every((r) => r.count === 1)).toBe(true);
  });
});

describe("formatStatusResistance", () => {
  it.each([
    [100, "不可"],
    [95, "可"],
    [0, "可"],
    [null, "待確認"],
    [101, "待確認"],
  ] as const)("%s → %s", (value, expected) => expect(formatStatusResistance(value)).toBe(expected));
});

describe("buildStepData — hit (max dodge, null ignored)", () => {
  it("hit.dodge is the max dodge across all group rows; hit.names lists tied-max names", () => {
    const stats = new Map([
      [11034, stat({ id: 11034, name: "被汙染的機關", dodge: 520 })],
      [11036, stat({ id: 11036, name: "水源淨化機關", dodge: 447 })],
      [11038, stat({ id: 11038, name: "淨化水晶", dodge: null })], // ignored
    ]);
    const points = new Map([
      [11034, [{ x: 480, y: 480 }]],
      [11036, [{ x: 500, y: 500 }]],
      [11038, [{ x: 600, y: 600 }]],
    ]);
    const data = buildStepData(
      baseInput({
        groups: [{ ids: [11034] }, { ids: [11036] }, { ids: [11038] }],
        stats,
        points,
      }),
    );
    expect(data.hit).toEqual({ dodge: 520, names: ["被汙染的機關"] });
  });

  it("all-null dodge across every row → hit is null", () => {
    const stats = new Map([[11038, stat({ id: 11038, dodge: null })]]);
    const points = new Map([[11038, [{ x: 600, y: 600 }]]]);
    const data = buildStepData(baseInput({ groups: [{ ids: [11038] }], stats, points }));
    expect(data.hit).toBeNull();
  });

  it("ties on max dodge list every distinct tied name once", () => {
    const stats = new Map([
      [11039, stat({ id: 11039, name: "▲黑化貝", dodge: 500 })],
      [11041, stat({ id: 11041, name: "▲黑化電龜", dodge: 500 })],
      [11036, stat({ id: 11036, name: "水源淨化機關", dodge: 447 })],
    ]);
    const points = new Map([
      [11039, [{ x: 700, y: 700 }]],
      [11041, [{ x: 710, y: 710 }]],
      [11036, [{ x: 500, y: 500 }]],
    ]);
    const data = buildStepData(
      baseInput({ groups: [{ ids: [11039, 11041, 11036] }], stats, points }),
    );
    expect(data.hit?.dodge).toBe(500);
    expect(data.hit?.names.sort()).toEqual(["▲黑化貝", "▲黑化電龜"].sort());
  });
});

describe("buildStepData — color order", () => {
  it("group.color is 1-based index into the input groups array", () => {
    const stats = new Map([
      [11034, stat({ id: 11034 })],
      [11036, stat({ id: 11036, name: "水源淨化機關" })],
      [11038, stat({ id: 11038, name: "淨化水晶" })],
    ]);
    const points = new Map([
      [11034, [{ x: 480, y: 480 }]],
      [11036, [{ x: 500, y: 500 }]],
      [11038, [{ x: 600, y: 600 }]],
    ]);
    const data = buildStepData(
      baseInput({
        groups: [{ ids: [11034] }, { ids: [11036] }, { ids: [11038] }],
        stats,
        points,
      }),
    );
    expect(data.groups.map((g) => g.color)).toEqual([1, 2, 3]);
  });
});

describe("buildStepData — missing", () => {
  it("group id with no DB record is missing", () => {
    const data = buildStepData(
      baseInput({ groups: [{ ids: [99999999] }], stats: new Map(), points: new Map() }),
    );
    expect(data.missing).toEqual([99999999]);
    expect(data.groups[0].rows).toEqual([]);
  });

  it("group id with a DB record but no in-crop point is missing when map is enabled (default)", () => {
    const stats = new Map([[11034, stat({ id: 11034 })]]);
    const data = buildStepData(baseInput({ groups: [{ ids: [11034] }], stats, points: new Map() }));
    expect(data.missing).toEqual([11034]);
  });

  it("map: false skips the missing-point check even with no coordinates", () => {
    const stats = new Map([[11034, stat({ id: 11034 })]]);
    const data = buildStepData(
      baseInput({ groups: [{ ids: [11034], map: false }], stats, points: new Map() }),
    );
    expect(data.missing).toEqual([]);
    expect(data.groups[0].map).toBe(false);
  });

  it("mark with tbd:true skips the missing-point check", () => {
    const stats = new Map([[5738, stat({ id: 5738, name: "●丹爐童子" })]]);
    const data = buildStepData(
      baseInput({
        groups: [],
        marks: [{ id: 5738, as: "npc", tbd: true }],
        stats,
        points: new Map(),
      }),
    );
    expect(data.missing).toEqual([]);
    expect(data.marks[0].tbd).toBe(true);
  });

  it("mark without tbd and with no DB record is missing", () => {
    const data = buildStepData(
      baseInput({
        groups: [],
        marks: [{ id: 99999999, as: "npc" }],
        stats: new Map(),
        points: new Map(),
      }),
    );
    expect(data.missing).toEqual([99999999]);
  });
});

describe("可行走通道（map_walkability）", () => {
  it("regionPath：斜角相接與中空環都畫成封閉外框", () => {
    // 3×3 中空環 → 外框＋洞兩個環；兩格斜角相接 → 兩個方塊在共用頂點串成一個 8 字環
    expect(regionPath([0, 1, 2, 3, 5, 6, 7, 8], 3)).toBe(
      "M0 0 120 0 120 120 0 120ZM80 40 40 40 40 80 80 80Z",
    );
    expect(regionPath([0, 3], 2)).toBe("M0 0 40 0 40 40 80 40 80 80 40 80 40 40 0 40Z");
    expect(walkRegion("1001", 2, 2, 10, 10)).toEqual([0, 3]); // 八鄰接：斜向算相連
    expect(walkRegion("0000", 2, 2, 10, 10)).toBeNull();
  });

  it("烈漠禁地第二層：兩個起點各展開成一條通道，範圍不同；起點附近不可走就沒有通道", async () => {
    const { getStepData } = await import("../guide-steps.server");
    const crop: Crop = [300, 1050, 2500, 2900];
    const data = getStepData({
      stage: 1723,
      crop,
      walk: [
        { at: [2044, 2604], label: "金甲通道" },
        { at: [1774, 2108], label: "銅甲通道" },
        { at: [20, 20], label: "空白處" },
      ],
    });
    expect(data.walk?.map((w) => w.label)).toEqual(["金甲通道", "銅甲通道"]);
    const [gold, bronze] = data.walk!;
    expect(gold.path).toMatch(/^M[\d ]+Z/);
    expect(bronze.path).toMatch(/^M[\d ]+Z/);
    expect(gold.path).not.toBe(bronze.path);
    for (const w of data.walk!) expect(inCrop(w.labelAt, crop)).toBe(true);
    expect(gold.portal).toEqual({ x: 2044, y: 2604 });
    expect(gold.landing).toBeNull(); // 沒給落點
  });

  it("烈漠禁地第二層：落點要在同一條通道、也要在本區塊內，否則不畫；傳點在區塊外也不畫", async () => {
    const { getStepData } = await import("../guide-steps.server");
    const crop: Crop = [300, 1050, 2500, 2900];
    const walk = (landing: [number, number], c: Crop = crop) =>
      getStepData({
        stage: 1723,
        crop: c,
        walk: [{ at: [2044, 2604], landing, label: "金甲通道" }],
      }).walk![0];

    // 金甲落點在金甲通道內
    expect(walk([708, 1326]).landing).toEqual({ x: 708, y: 1326 });
    // 銅甲落點不屬於金甲通道
    expect(walk([505, 1170]).landing).toBeNull();
    // 裁掉落點所在的上半部：落點與通道仍在，但落點不在區塊內
    const lower: Crop = [300, 2000, 2500, 2900];
    expect(walk([708, 1326], lower).landing).toBeNull();
    expect(walk([708, 1326], lower).portal).toEqual({ x: 2044, y: 2604 });
    // 只留上半部：傳點在區塊外
    const upper: Crop = [300, 1050, 2500, 2000];
    const top = walk([708, 1326], upper);
    expect(top.portal).toBeNull();
    expect(top.landing).toEqual({ x: 708, y: 1326 });
  });
});

describe("路線（routes）", () => {
  it("routeBox：包住點再加一圈邊、固定 ROUTE_ASPECT、推回本區塊內；太大時縮進本區塊", () => {
    const bounds: Crop = [0, 0, 2800, 2550];
    const box = routeBox(
      [
        { x: 100, y: 100 },
        { x: 500, y: 300 },
      ],
      bounds,
    );
    const [x0, y0, x1, y1] = box;
    expect((x1 - x0) / (y1 - y0)).toBeCloseTo(ROUTE_ASPECT, 2);
    expect(x0).toBe(0); // 左上角放不下一圈邊，推回框內
    expect(y0).toBe(0);
    expect(x1).toBeGreaterThanOrEqual(500 + 180);
    expect(y1).toBeGreaterThanOrEqual(300 + 180);
    // 比本區塊還大時縮到放得進去，比例不變
    const big = routeBox(
      [
        { x: 0, y: 0 },
        { x: 2800, y: 2550 },
      ],
      bounds,
    );
    expect(big[2] - big[0]).toBeLessThanOrEqual(2800);
    expect(big[3] - big[1]).toBeLessThanOrEqual(2550);
    expect((big[2] - big[0]) / (big[3] - big[1])).toBeCloseTo(ROUTE_ASPECT, 2);
    expect(big[0]).toBeGreaterThanOrEqual(0);
    expect(big[1]).toBeGreaterThanOrEqual(0);
  });

  it("出口傳點可作路線終點，裁切包含落點、王與傳點", () => {
    const points = [{ x: 4797, y: 1453 }, { x: 4602, y: 1579 }, { x: 4615, y: 1782 }];
    const box = routeBox(points, [4160, 1200, 5020, 2080]);
    for (const point of points) expect(inCrop(point, box)).toBe(true);
  });

  it("烈漠禁地第四層：路線要全在區塊內、步行段要走得到，否則整條略過", async () => {
    const { getStepData } = await import("../guide-steps.server");
    const crop: Crop = [250, 2700, 5050, 5250];
    const claw: ["landing" | "portal" | "walk" | "boss", number, number][] = [
      ["landing", 440, 3296],
      ["portal", 632, 3177],
      ["landing", 627, 3928],
      ["portal", 804, 3884],
      ["landing", 1428, 3256],
      ["portal", 1285, 3339],
      ["landing", 962, 3662],
      ["boss", 1040, 3600],
    ];
    const data = getStepData({
      stage: 1723,
      crop,
      routes: [
        { label: "鬼爪島", note: "跳三次", points: claw },
        // 起點在區塊外
        {
          label: "區塊外",
          points: [
            ["landing", 100, 100],
            ["boss", 1040, 3600],
          ],
        },
        // 鬼爪島落點直接「走」到鬼馬王：不同島，走不到
        {
          label: "走不到",
          points: [
            ["landing", 440, 3296],
            ["boss", 2760, 3640],
          ],
        },
        // 最後一點是出口傳點，不需捏造傳送目的地
        {
          label: "出口",
          points: [
            ["landing", 440, 3296],
            ["portal", 632, 3177],
          ],
        },
      ],
    });
    expect(data.routes?.map((r) => r.label)).toEqual(["鬼爪島", "出口"]);
    const [r] = data.routes!;
    expect(r.note).toBe("跳三次");
    expect(r.points.map((p) => p.as)).toEqual(claw.map((p) => p[0]));
    expect(r.points[0]).toEqual({ as: "landing", x: 440, y: 3296 });
    const [x0, y0, x1, y1] = r.box;
    expect(x0).toBeGreaterThanOrEqual(crop[0]);
    expect(y0).toBeGreaterThanOrEqual(crop[1]);
    expect(x1).toBeLessThanOrEqual(crop[2]);
    expect(y1).toBeLessThanOrEqual(crop[3]);
    expect((x1 - x0) / (y1 - y0)).toBeCloseTo(ROUTE_ASPECT, 2);
    for (const p of r.points) expect(inCrop(p, r.box)).toBe(true);
  });
});
