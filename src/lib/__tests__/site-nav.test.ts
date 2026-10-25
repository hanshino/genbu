import { describe, expect, it } from "vitest";
import { NAV_SECTIONS, splitSubgroups } from "@/lib/site-nav";

describe("splitSubgroups", () => {
  it("相鄰同名切成一段，沒有小分類的整組一段", () => {
    expect(
      splitSubgroups([
        { href: "/a", label: "A", subgroup: "甲" },
        { href: "/b", label: "B", subgroup: "甲" },
        { href: "/c", label: "C", subgroup: "乙" },
      ]).map((s) => [s.label, s.items.map((i) => i.label)]),
    ).toEqual([
      ["甲", ["A", "B"]],
      ["乙", ["C"]],
    ]);
    expect(splitSubgroups([{ href: "/a", label: "A" }])).toEqual([
      { label: null, items: [{ href: "/a", label: "A" }] },
    ]);
  });

  it("同一小分類在每組裡只出現一段（入口要相鄰），且有小分類的組每項都有", () => {
    for (const section of NAV_SECTIONS) {
      const labels = splitSubgroups(section.items).map((s) => s.label);
      expect(new Set(labels).size).toBe(labels.length);
      if (labels.some((l) => l !== null)) expect(labels).not.toContain(null);
    }
  });
});
