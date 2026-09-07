import { describe, expect, it } from "vitest";
import { normalizeCodexWindows } from "./codex-windows.js";

describe("Codex subscription windows", () => {
  it("labels a weekly primary window by duration, with no invented session limit", () => {
    const result = normalizeCodexWindows({
      primary_window: { used_percent: 16, limit_window_seconds: 604800 },
      secondary_window: null,
    });
    expect(result.quotaWindowsComplete).toBe(true);
    expect(result.windows).toEqual([
      expect.objectContaining({
        id: "weekly",
        label: "Weekly",
        durationSeconds: 604800,
        remainingPct: 84,
      }),
    ]);
  });
  it("handles swapped windows and keeps the tightest limit", () => {
    const result = normalizeCodexWindows({
      primary_window: { used_percent: 80, limit_window_seconds: 604800 },
      secondary_window: { used_percent: 10, limit_window_seconds: 18000 },
    });
    expect(result.quotaWindowsComplete).toBe(true);
    expect(result.windows.map((w) => [w.id, w.remainingPct])).toEqual([
      ["weekly", 20],
      ["session", 90],
    ]);
  });
  it.each([
    undefined,
    {},
    { primary_window: null, secondary_window: null },
    { primary_window: { used_percent: 16, limit_window_seconds: 604800 } },
    { primary_window: { used_percent: 16 }, secondary_window: null },
    { primary_window: { limit_window_seconds: 604800 }, secondary_window: null },
    {
      primary_window: { used_percent: 16, limit_window_seconds: 604800 },
      secondary_window: { used_percent: 16, limit_window_seconds: 604800 },
    },
  ])("does not certify incomplete or ambiguous windows: %j", (input) => {
    expect(normalizeCodexWindows(input).quotaWindowsComplete).toBe(false);
  });
  it.each([null, -1, 101, "16", NaN, Infinity])(
    "rejects invalid utilization %j",
    (used_percent) => {
      expect(() =>
        normalizeCodexWindows({
          primary_window: { used_percent, limit_window_seconds: 604800 },
          secondary_window: null,
        }),
      ).toThrow();
    },
  );
  it("retains unfamiliar durations instead of silently dropping a limit", () => {
    const result = normalizeCodexWindows({
      primary_window: { used_percent: 70, limit_window_seconds: 86400 },
      secondary_window: null,
    });
    expect(result.quotaWindowsComplete).toBe(true);
    expect(result.windows[0]).toMatchObject({
      id: "window_86400s",
      durationSeconds: 86400,
      remainingPct: 30,
    });
  });
});
