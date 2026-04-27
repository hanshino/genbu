import { describe, it, expect } from "vitest";
import { nextSortHref } from "../sortable-head";

describe("nextSortHref", () => {
  it("no active sort → clicking any column starts at asc", () => {
    const href = nextSortHref("search=foo", "/items", "level", undefined, undefined);
    expect(href).toBe("/items?search=foo&sortBy=level&sortDir=asc");
  });

  it("active column asc → clicking it gives desc", () => {
    const href = nextSortHref("sortBy=level&sortDir=asc", "/items", "level", "level", "asc");
    expect(href).toBe("/items?sortBy=level&sortDir=desc");
  });

  it("active column desc → clicking it resets to default (no sort params)", () => {
    const href = nextSortHref("sortBy=level&sortDir=desc", "/items", "level", "level", "desc");
    expect(href).toBe("/items");
  });

  it("different column → starts at asc regardless of current sort", () => {
    const href = nextSortHref("sortBy=level&sortDir=desc", "/items", "weight", "level", "desc");
    expect(href).toBe("/items?sortBy=weight&sortDir=asc");
  });

  it("always deletes page param", () => {
    const href = nextSortHref("search=a&page=5", "/monsters", "level", undefined, undefined);
    expect(href).toBe("/monsters?search=a&sortBy=level&sortDir=asc");
    expect(href).not.toContain("page=");
  });

  it("preserves other params (search, type, etc.)", () => {
    const href = nextSortHref(
      "search=foo&type=%E5%BA%A7%E9%A8%B2",
      "/items",
      "level",
      undefined,
      undefined,
    );
    expect(href).toContain("search=foo");
    expect(href).toContain("sortBy=level");
  });
});
