const test = require("node:test");
const assert = require("node:assert/strict");
const {
  extractTokenCountEvent,
  formatDuration,
  normalizeWhamUsage,
  summarizeAuthenticatedUsage,
  summarizeSnapshot
} = require("../src/usageReader");

test("extracts Codex primary and weekly rate limits from token_count JSONL events", () => {
  const line = JSON.stringify({
    timestamp: "2026-06-07T18:00:00.000Z",
    type: "event_msg",
    payload: {
      type: "token_count",
      info: {
        total_token_usage: { total_tokens: 21133 }
      },
      rate_limits: {
        limit_id: "codex",
        primary: { used_percent: 4, window_minutes: 300, resets_at: 1780147183 },
        secondary: { used_percent: 75, window_minutes: 10080, resets_at: 1780174923 },
        plan_type: "prolite",
        rate_limit_reached_type: null
      }
    }
  });

  const event = extractTokenCountEvent(line, "/tmp/session.jsonl");

  assert.equal(event.rateLimits.primary.name, "5-hour");
  assert.equal(event.rateLimits.secondary.name, "weekly");
  assert.equal(event.rateLimits.primary.usedPercent, 4);
  assert.equal(event.rateLimits.secondary.windowMinutes, 10080);
});

test("summarizes countdowns and remaining percentages", () => {
  const event = {
    timestamp: "2026-06-07T18:00:00.000Z",
    filePath: "/tmp/session.jsonl",
    tokenUsage: null,
    rateLimits: {
      planType: "prolite",
      rateLimitReachedType: null,
      primary: { name: "5-hour", windowMinutes: 300, usedPercent: 25, resetsAt: 100 },
      secondary: { name: "weekly", windowMinutes: 10080, usedPercent: 90, resetsAt: 3600 }
    }
  };

  const summary = summarizeSnapshot(event, { scannedFiles: 1, scannedEvents: 1, now: 0 });

  assert.equal(summary.status, "ok");
  assert.equal(summary.windows[0].remainingPercent, 75);
  assert.equal(summary.windows[1].remainingText, "1h 0m");
});

test("formats durations compactly", () => {
  assert.equal(formatDuration(0), "0m");
  assert.equal(formatDuration(65 * 60 * 1000), "1h 5m");
  assert.equal(formatDuration((2 * 86400 + 3 * 3600 + 4 * 60) * 1000), "2d 3h 4m");
});

test("normalizes authenticated Codex usage response windows", () => {
  const rateLimits = normalizeWhamUsage({
    plan_type: "plus",
    rate_limit: {
      primary_window: { used_percent: 12, reset_at: 200, limit_window_seconds: 18000 },
      secondary_window: { used_percent: 51, reset_at: 604800, limit_window_seconds: 604800 }
    }
  });

  assert.equal(rateLimits.planType, "plus");
  assert.equal(rateLimits.primary.name, "5-hour");
  assert.equal(rateLimits.primary.windowMinutes, 300);
  assert.equal(rateLimits.secondary.name, "weekly");
  assert.equal(rateLimits.secondary.windowMinutes, 10080);
});

test("summarizes authenticated usage without exposing OAuth tokens", () => {
  const summary = summarizeAuthenticatedUsage(
    {
      sourceUrl: "https://chatgpt.com/backend-api/wham/usage",
      account: { signedIn: true, planType: "plus", accountId: "acct_123" },
      body: {
        plan_type: "plus",
        rate_limit: {
          primary_window: { used_percent: 50, reset_at: 3600, limit_window_seconds: 18000 }
        }
      }
    },
    { now: 0 }
  );

  assert.equal(summary.status, "ok");
  assert.equal(summary.source, "oauth");
  assert.equal(summary.windows[0].remainingPercent, 50);
  assert.equal(JSON.stringify(summary).includes("access_token"), false);
});
