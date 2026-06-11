const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const { fetchCodexUsage } = require("./oauthClient");

const DEFAULT_ROOTS = [
  path.join(os.homedir(), ".openclaw", "agents"),
  path.join(os.homedir(), ".codex")
];

function isJsonObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function walkFiles(root, matches, acc = []) {
  if (!fs.existsSync(root)) return acc;
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    const fullPath = path.join(root, entry.name);
    if (entry.isDirectory()) {
      walkFiles(fullPath, matches, acc);
    } else if (matches(fullPath)) {
      acc.push(fullPath);
    }
  }
  return acc;
}

function findSessionFiles(roots = DEFAULT_ROOTS) {
  const files = [];
  for (const root of roots) {
    walkFiles(root, (filePath) => filePath.endsWith(".jsonl"), files);
  }
  return files.sort();
}

function normalizeRateLimits(raw) {
  if (!isJsonObject(raw)) return null;
  const primary = isJsonObject(raw.primary) ? raw.primary : null;
  const secondary = isJsonObject(raw.secondary) ? raw.secondary : null;
  if (!primary && !secondary) return null;
  const limitName = raw.limit_name ?? raw.limitName ?? "Codex";
  return {
    limitId: raw.limit_id ?? raw.limitId ?? "codex",
    limitName,
    primary: normalizeWindow(primary, "5-hour"),
    secondary: normalizeWindow(secondary, "weekly"),
    planType: raw.plan_type ?? raw.planType ?? null,
    rateLimitReachedType: raw.rate_limit_reached_type ?? raw.rateLimitReachedType ?? null,
    additional: normalizeAdditionalRateLimits(raw.additional_rate_limits ?? raw.additionalRateLimits)
  };
}

function normalizeWhamUsage(raw) {
  if (!isJsonObject(raw)) return null;
  const rateLimit = raw.rate_limit ?? raw.rateLimit ?? raw.rate_limits ?? raw.rateLimits;
  if (!isJsonObject(rateLimit)) return null;
  const primary = rateLimit.primary_window ?? rateLimit.primaryWindow ?? rateLimit.primary;
  const secondary = rateLimit.secondary_window ?? rateLimit.secondaryWindow ?? rateLimit.secondary;
  const limitName = raw.limit_name ?? raw.limitName ?? "Codex";
  return {
    limitId: raw.limit_id ?? raw.limitId ?? "codex",
    limitName,
    primary: normalizeUsageWindow(primary, "5-hour"),
    secondary: normalizeUsageWindow(secondary, "weekly"),
    planType: raw.plan_type ?? raw.planType ?? null,
    rateLimitReachedType: raw.rate_limit_reached_type ?? raw.rateLimitReachedType ?? null,
    additional: normalizeAdditionalRateLimits(raw.additional_rate_limits ?? raw.additionalRateLimits)
  };
}

function normalizeAdditionalRateLimits(raw) {
  if (!Array.isArray(raw)) return [];
  return raw.map(normalizeAdditionalRateLimit).filter(Boolean);
}

function normalizeAdditionalRateLimit(raw) {
  if (!isJsonObject(raw)) return null;
  const nested = raw.rate_limit ?? raw.rateLimit ?? raw.rate_limits ?? raw.rateLimits;
  const windows = normalizeWhamUsage({
    ...raw,
    rate_limit: isJsonObject(nested) ? nested : raw
  });
  if (!windows) return null;
  return {
    ...windows,
    limitId: raw.limit_id ?? raw.limitId ?? raw.metered_feature ?? raw.meteredFeature ?? windows.limitId,
    limitName: raw.limit_name ?? raw.limitName ?? raw.model ?? windows.limitName
  };
}

function normalizeWindow(raw, fallbackName) {
  if (!isJsonObject(raw)) return null;
  const windowMinutes = Number(raw.window_minutes ?? raw.windowMinutes ?? 0);
  const resetsAtSeconds = Number(raw.resets_at ?? raw.resetsAt ?? 0);
  const usedPercent = Number(raw.used_percent ?? raw.usedPercent ?? NaN);
  return {
    name: windowMinutes === 300 ? "5-hour" : windowMinutes === 10080 ? "weekly" : fallbackName,
    windowMinutes,
    resetsAt: Number.isFinite(resetsAtSeconds) ? resetsAtSeconds : 0,
    usedPercent: Number.isFinite(usedPercent) ? usedPercent : null
  };
}

function normalizeUsageWindow(raw, fallbackName) {
  if (!isJsonObject(raw)) return null;
  const windowSeconds = Number(
    raw.limit_window_seconds ?? raw.limitWindowSeconds ?? raw.window_seconds ?? raw.windowSeconds ?? 0
  );
  const windowMinutes = Number(raw.window_minutes ?? raw.windowMinutes ?? windowSeconds / 60);
  const resetsAtSeconds = Number(raw.reset_at ?? raw.resetAt ?? raw.resets_at ?? raw.resetsAt ?? 0);
  const usedPercent = Number(raw.used_percent ?? raw.usedPercent ?? NaN);
  return {
    name: windowMinutes === 300 ? "5-hour" : windowMinutes === 10080 ? "weekly" : fallbackName,
    windowMinutes,
    resetsAt: Number.isFinite(resetsAtSeconds) ? resetsAtSeconds : 0,
    usedPercent: Number.isFinite(usedPercent) ? usedPercent : null
  };
}

async function readUsageSnapshot(options = {}) {
  const now = options.now ?? Date.now();
  if (options.userDataPath) {
    try {
      const usage = await fetchCodexUsage(options.userDataPath);
      if (usage) return summarizeAuthenticatedUsage(usage, { now });
    } catch (error) {
      return {
        status: "auth-error",
        now: new Date(now).toISOString(),
        message: error.message,
        source: "oauth"
      };
    }
  }
  if (process.env.CODEX_LIMIT_WATCHER_LOCAL_FALLBACK === "1" || options.allowLocalFallback) {
    return readLatestUsageSnapshot({ ...options, now });
  }
  return {
    status: "signed-out",
    now: new Date(now).toISOString(),
    message: "Sign in with ChatGPT to read Codex usage limits.",
    source: "oauth"
  };
}

function summarizeAuthenticatedUsage(usage, meta) {
  const rateLimits = normalizeWhamUsage(usage.body);
  if (!rateLimits) {
    return {
      status: "no-data",
      now: new Date(meta.now).toISOString(),
      account: usage.account,
      sourceUrl: usage.sourceUrl,
      source: "oauth",
      message: "The authenticated Codex usage response did not include recognizable rate-limit windows."
    };
  }
  return {
    status: "ok",
    now: new Date(meta.now).toISOString(),
    sourceUrl: usage.sourceUrl,
    source: "oauth",
    account: usage.account,
    observedAt: new Date(meta.now).toISOString(),
    planType: rateLimits.planType ?? usage.account?.planType ?? null,
    rateLimitReachedType: rateLimits.rateLimitReachedType,
    windows: summarizeRateLimitWindows(rateLimits, meta.now),
    tokenUsage: usage.body.token_usage ?? usage.body.tokenUsage ?? null
  };
}

function extractTokenCountEvent(line, filePath) {
  let event;
  try {
    event = JSON.parse(line);
  } catch {
    return null;
  }
  if (!isJsonObject(event) || event.type !== "event_msg") return null;
  const payload = event.payload;
  if (!isJsonObject(payload) || payload.type !== "token_count") return null;
  const rateLimits = normalizeRateLimits(payload.rate_limits ?? payload.rateLimits);
  if (!rateLimits) return null;
  return {
    timestamp: event.timestamp ?? null,
    filePath,
    rateLimits,
    tokenUsage: payload.info?.total_token_usage ?? payload.info?.totalTokenUsage ?? null
  };
}

function readLatestUsageSnapshot(options = {}) {
  const roots = options.roots ?? DEFAULT_ROOTS;
  const files = options.files ?? findSessionFiles(roots);
  let latest = null;
  let scannedFiles = 0;
  let scannedEvents = 0;

  for (const filePath of files) {
    scannedFiles += 1;
    let contents;
    try {
      contents = fs.readFileSync(filePath, "utf8");
    } catch {
      continue;
    }
    for (const line of contents.split(/\r?\n/)) {
      if (!line.trim()) continue;
      const event = extractTokenCountEvent(line, filePath);
      if (!event) continue;
      scannedEvents += 1;
      if (!latest || Date.parse(event.timestamp ?? 0) >= Date.parse(latest.timestamp ?? 0)) {
        latest = event;
      }
    }
  }

  return summarizeSnapshot(latest, { scannedFiles, scannedEvents, now: options.now ?? Date.now() });
}

function summarizeSnapshot(event, meta) {
  const nowMs = meta.now;
  if (!event) {
    return {
      status: "no-data",
      now: new Date(nowMs).toISOString(),
      scannedFiles: meta.scannedFiles,
      scannedEvents: meta.scannedEvents,
      message: "No Codex token_count rate-limit event was found."
    };
  }
  return {
    status: "ok",
    now: new Date(nowMs).toISOString(),
    sourceFile: event.filePath,
    observedAt: event.timestamp,
    scannedFiles: meta.scannedFiles,
    scannedEvents: meta.scannedEvents,
    planType: event.rateLimits.planType,
    rateLimitReachedType: event.rateLimits.rateLimitReachedType,
    windows: summarizeRateLimitWindows(event.rateLimits, nowMs),
    tokenUsage: event.tokenUsage
  };
}

function summarizeRateLimitWindows(rateLimits, nowMs) {
  return [rateLimits, ...(rateLimits.additional ?? [])]
    .flatMap((limit) => [limit.primary, limit.secondary]
      .filter(Boolean)
      .map((window) => summarizeWindow(window, nowMs, limit)));
}

function summarizeWindow(window, nowMs, limit = {}) {
  const resetsAtMs = window.resetsAt * 1000;
  const remainingMs = Math.max(0, resetsAtMs - nowMs);
  return {
    name: window.name,
    limitId: limit.limitId ?? null,
    limitName: limit.limitName ?? "Codex",
    windowMinutes: window.windowMinutes,
    usedPercent: window.usedPercent,
    remainingPercent: window.usedPercent === null ? null : Math.max(0, 100 - window.usedPercent),
    resetsAt: resetsAtMs > 0 ? new Date(resetsAtMs).toISOString() : null,
    remainingMs,
    remainingText: formatDuration(remainingMs)
  };
}

function formatDuration(ms) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  if (days > 0) return `${days}d ${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

if (require.main === module) {
  readUsageSnapshot({ allowLocalFallback: process.env.CODEX_LIMIT_WATCHER_LOCAL_FALLBACK === "1" })
    .then((snapshot) => {
      console.log(JSON.stringify(snapshot, null, 2));
    })
    .catch((error) => {
      console.error(error.message);
      process.exitCode = 1;
    });
}

module.exports = {
  extractTokenCountEvent,
  findSessionFiles,
  formatDuration,
  normalizeWhamUsage,
  readUsageSnapshot,
  readLatestUsageSnapshot,
  summarizeAuthenticatedUsage,
  summarizeSnapshot
};
