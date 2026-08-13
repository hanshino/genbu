import { describe, expect, it } from "vitest";
import { getGuideBySlug, getPublishedGuides, guides } from "../guides";

describe("guides data contract", () => {
  it("keeps slugs unique and published guides complete", () => {
    expect(new Set(guides.map((guide) => guide.slug)).size).toBe(guides.length);
    for (const guide of getPublishedGuides()) {
      expect(guide.summary.trim().length).toBeGreaterThan(0);
      expect(guide.sections.length).toBeGreaterThan(0);
      for (const section of guide.sections) {
        expect(section.paragraphs.length).toBeGreaterThan(0);
        expect(section.sourceIds.length).toBeGreaterThan(0);
        for (const link of section.links ?? []) expect(link.href.startsWith("/")).toBe(true);
        for (const sourceId of section.sourceIds) {
          expect(guide.sources.some((source) => source.id === sourceId)).toBe(true);
        }
      }
    }
  });

  it("validates dates and source-specific evidence rules", () => {
    for (const guide of guides) {
      for (const source of guide.sources) {
        expect(/^\d{4}-\d{2}-\d{2}$/.test(source.lastVerified)).toBe(true);
        expect(Number.isNaN(Date.parse(`${source.lastVerified}T00:00:00Z`))).toBe(false);
        if (source.tier === "official" || source.tier === "community") {
          expect(source.url).toMatch(/^https:\/\//);
        }
        if (source.tier === "field-test") expect(source.evidence.trim().length).toBeGreaterThan(0);
      }
    }
  });

  it("looks up the first published guide and filters drafts", () => {
    expect(getGuideBySlug("monster-drops-training")?.status).toBe("published");
    expect(getGuideBySlug("does-not-exist")).toBeUndefined();
    expect(getPublishedGuides().every((guide) => guide.status === "published")).toBe(true);
    expect(Object.hasOwn(getGuideBySlug("monster-drops-training")!, "image")).toBe(false);
  });

  it("publishes the three Phase 1 database-only guides", () => {
    const phase1Slugs = ["monster-drops-training", "equipment-progression", "mission-dungeon"];
    const phase1 = phase1Slugs.map((slug) => getGuideBySlug(slug));
    expect(phase1.every((guide) => guide?.status === "published")).toBe(true);
    for (const guide of phase1) {
      expect(guide!.sources.every((source) => source.tier === "database")).toBe(true);
      expect(new Set(guide!.sources.map((source) => source.id)).size).toBe(guide!.sources.length);
    }
  });

  it("keeps Phase 1 guide navigation targets", () => {
    const equipment = getGuideBySlug("equipment-progression")!;
    const mission = getGuideBySlug("mission-dungeon")!;
    const hrefs = (guide: typeof equipment) => guide.sections.flatMap((section) =>
      (section.links ?? []).map((link) => link.href),
    );
    expect(hrefs(equipment)).toEqual(
      expect.arrayContaining([
        "/items",
        "/monsters?hasDrop=1",
        "/shops",
        "/missions",
        "/compounds",
        "/ranking?type=HORSE",
        "/ranking?type=WING",
        "/compare?type=HORSE",
        "/compare?type=WING",
      ]),
    );
    expect(hrefs(mission)).toEqual(
      expect.arrayContaining([
        "/missions",
        "/maps",
        "/items",
        "/tools",
        "/tools/160",
        "/tools/175",
        "/tools/180",
      ]),
    );
  });
});
