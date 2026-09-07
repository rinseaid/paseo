import { z } from "zod";
import type { ProviderUsageWindow } from "../../../server/messages.js";
import { toneFromUsedPct, windowFromUsedPct } from "../usage.js";

const CodexSubscriptionWindowSchema = z.object({
  used_percent: z.number().finite().min(0).max(100).optional(),
  reset_at: z.number().finite().optional(),
  limit_window_seconds: z.number().int().positive().optional(),
});

export const CodexRateLimitSchema = z.object({
  primary_window: CodexSubscriptionWindowSchema.nullish(),
  secondary_window: CodexSubscriptionWindowSchema.nullish(),
});

export function normalizeCodexWindows(input: unknown): {
  windows: ProviderUsageWindow[];
  quotaWindowsComplete: boolean;
} {
  const rateLimit = CodexRateLimitSchema.nullish().parse(input);
  const windows: ProviderUsageWindow[] = [];
  let quotaWindowsComplete = rateLimit != null;
  for (const slot of ["primary_window", "secondary_window"] as const) {
    const source = rateLimit?.[slot];
    // Null explicitly means no limit. Omission is an incomplete response.
    if (source === null) continue;
    if (source === undefined) {
      quotaWindowsComplete = false;
      continue;
    }
    const durationSeconds = source.limit_window_seconds;
    let id: string = slot;
    let label =
      slot === "primary_window" ? "Primary (duration unknown)" : "Secondary (duration unknown)";
    if (durationSeconds === 604800) {
      id = "weekly";
      label = "Weekly";
    } else if (durationSeconds === 18000) {
      id = "session";
      label = "Session";
    } else if (durationSeconds !== undefined) {
      id = `window_${durationSeconds}s`;
      label = `${durationSeconds / 3600} hour limit`;
    }
    if (durationSeconds === undefined || source.used_percent === undefined) {
      quotaWindowsComplete = false;
    }
    const resetsAt =
      source.reset_at === undefined ? null : new Date(source.reset_at * 1000).toISOString();
    windows.push({
      ...windowFromUsedPct({
        id,
        label,
        utilizationPct: source.used_percent,
        resetsAt,
        tone: toneFromUsedPct(source.used_percent),
      }),
      ...(durationSeconds === undefined ? {} : { durationSeconds }),
    });
  }
  // Duplicate durations are ambiguous, and no windows is not unlimited quota.
  const uniqueIds = new Set(windows.map((window) => window.id));
  quotaWindowsComplete =
    quotaWindowsComplete && windows.length > 0 && uniqueIds.size === windows.length;
  return { windows, quotaWindowsComplete };
}
