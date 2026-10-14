import { describe, it, expect } from "vitest";
import {
  parseSkillColumns,
  isDefaultSkillColumns,
  DEFAULT_SKILL_COLUMNS,
} from "../constants/skill-columns";

describe("parseSkillColumns", () => {
  it("drops unknown keys and returns canonical order", () => {
    expect(parseSkillColumns("range,bogus,id,spend_mp")).toEqual(["id", "spend_mp", "range"]);
  });

  it("returns null when nothing usable (falls through to cookie/default)", () => {
    expect(parseSkillColumns(undefined)).toBeNull();
    expect(parseSkillColumns("")).toBeNull();
    expect(parseSkillColumns("name,foo")).toBeNull();
  });

  it("detects the default set regardless of order", () => {
    expect(isDefaultSkillColumns([...DEFAULT_SKILL_COLUMNS].reverse())).toBe(true);
    expect(isDefaultSkillColumns(["id"])).toBe(false);
  });
});
