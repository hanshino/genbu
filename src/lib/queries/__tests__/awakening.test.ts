import { describe, it, expect } from "vitest";
import { levelToGenPrefix } from "../awakening";

describe("levelToGenPrefix", () => {
  it("returns null for level 0 and below", () => {
    expect(levelToGenPrefix(0)).toBeNull();
    expect(levelToGenPrefix(-1)).toBeNull();
  });

  it("maps 1~39 to '20' (first generation has wider range)", () => {
    expect(levelToGenPrefix(1)).toBe("20");
    expect(levelToGenPrefix(7)).toBe("20");
    expect(levelToGenPrefix(20)).toBe("20");
    expect(levelToGenPrefix(39)).toBe("20");
  });

  it("maps 40~59 to '40'", () => {
    expect(levelToGenPrefix(40)).toBe("40");
    expect(levelToGenPrefix(59)).toBe("40");
  });

  it("maps 60~79 to '60'", () => {
    expect(levelToGenPrefix(60)).toBe("60");
    expect(levelToGenPrefix(79)).toBe("60");
  });

  it("maps 80~99 to '80'", () => {
    expect(levelToGenPrefix(80)).toBe("80");
    expect(levelToGenPrefix(99)).toBe("80");
  });

  it("maps 100~119 to '100'", () => {
    expect(levelToGenPrefix(100)).toBe("100");
    expect(levelToGenPrefix(119)).toBe("100");
  });

  it("maps 120~139 to '120'", () => {
    expect(levelToGenPrefix(120)).toBe("120");
    expect(levelToGenPrefix(139)).toBe("120");
  });

  it("maps 140~159 to '140'", () => {
    expect(levelToGenPrefix(140)).toBe("140");
    expect(levelToGenPrefix(159)).toBe("140");
  });

  it("maps 160~179 to '160'", () => {
    expect(levelToGenPrefix(160)).toBe("160");
    expect(levelToGenPrefix(179)).toBe("160");
  });

  it("maps 180~199 to '180'", () => {
    expect(levelToGenPrefix(180)).toBe("180");
    expect(levelToGenPrefix(199)).toBe("180");
  });

  it("maps 200+ to '200'", () => {
    expect(levelToGenPrefix(200)).toBe("200");
    expect(levelToGenPrefix(250)).toBe("200");
  });
});
