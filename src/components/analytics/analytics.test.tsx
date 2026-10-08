import { runInNewContext } from "node:vm";
import { StrictMode } from "react";
import { act, cleanup, render } from "@testing-library/react";
import Script from "next/script";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { track } from "@/lib/analytics/track";
import { SearchBeacon } from "./search-beacon";
import { UmamiAnalytics } from "./umami";

vi.mock("@/lib/analytics/track", () => ({ track: vi.fn() }));
vi.mock("next/script", () => ({ default: vi.fn(() => null) }));

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe("Umami before-send", () => {
  it("drops only consecutive same-path pageviews, never custom events", () => {
    const { container } = render(<UmamiAnalytics />);
    const inline = container.querySelector("script#umami-before-send");
    expect(inline).not.toBeNull();
    const [tracker] = vi.mocked(Script).mock.calls.map(([props]) => props);
    expect(tracker.strategy).toBe("afterInteractive");
    expect(tracker).toHaveProperty("data-before-send", "__umamiBeforeSend");

    const browser = {
      location: { href: "https://genbu.hanshino.dev/tools/salon" },
      __umamiBeforeSend: undefined as unknown as (
        type: string,
        payload: Record<string, unknown>,
      ) => Record<string, unknown> | false,
    };
    runInNewContext(inline!.textContent!, { window: browser, URL });
    const send = browser.__umamiBeforeSend;
    const first = { url: "https://genbu.hanshino.dev/tools/salon?q=first" };
    expect(send("event", first)).toBe(first);
    expect(send("event", { url: "/tools/salon?q=next#result" })).toBe(false);
    expect(send("event", { url: "/tools/salon#other" })).toBe(false);

    for (const name of ["search_submit", "search_no_result", ""]) {
      const event = { url: "/items", name, data: { query: "極" } };
      expect(send("event", event)).toBe(event);
    }
    const performance = { url: "/items" };
    expect(send("performance", performance)).toBe(performance);
    expect(send("identify", performance)).toBe(performance);
    expect(send("event", { url: "/tools/salon?q=last" })).toBe(false);
    const next = { url: "/items?q=極" };
    expect(send("event", next)).toBe(next);
    expect(send("event", first)).toBe(first);
  });
});

describe("SearchBeacon", () => {
  beforeEach(() => vi.useFakeTimers());

  const props = { scope: "items", query: "四", hasFilter: false, resultCount: 8 };
  const advance = (ms: number) => act(() => vi.advanceTimersByTime(ms));

  it("waits for unchanged inputs and sends only the settled query/result", () => {
    const { rerender } = render(<SearchBeacon {...props} />);
    advance(1000);
    rerender(<SearchBeacon {...props} query="四極" />);
    advance(1000);
    rerender(<SearchBeacon {...props} query="四極" resultCount={2} />);
    advance(1499);
    expect(track).not.toHaveBeenCalled();
    advance(1);
    expect(track).toHaveBeenCalledExactlyOnceWith("search_submit", {
      scope: "items", query: "四極", has_filter: false, result_count: 2,
    });
  });

  it("sends no-result alongside submit, preserving dedupe under StrictMode", () => {
    const beacon = (query: string) => (
      <StrictMode><SearchBeacon {...props} query={query} resultCount={0} /></StrictMode>
    );
    const { rerender } = render(beacon(" 極 "));
    advance(1500);
    expect(vi.mocked(track).mock.calls).toEqual([
      ["search_submit", { scope: "items", query: "極", has_filter: false, result_count: 0 }],
      ["search_no_result", { scope: "items", query: "極" }],
    ]);
    rerender(beacon("極"));
    advance(1500);
    expect(track).toHaveBeenCalledTimes(2);
  });

  it("ignores empty searches, but tracks filter-only searches without no-result", () => {
    const { rerender } = render(<SearchBeacon {...props} query=" " resultCount={0} />);
    advance(1500);
    expect(track).not.toHaveBeenCalled();
    rerender(<SearchBeacon {...props} query=" " hasFilter resultCount={0} />);
    advance(1500);
    expect(track).toHaveBeenCalledExactlyOnceWith("search_submit", {
      scope: "items", query: "", has_filter: true, result_count: 0,
    });
  });

  it("cancels pending events on unmount", () => {
    const { unmount } = render(<SearchBeacon {...props} />);
    advance(1000);
    unmount();
    advance(1500);
    expect(track).not.toHaveBeenCalled();
  });
});
