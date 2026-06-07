const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");

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
  return {
    limitId: raw.limit_id ?? raw.limitId ?? "codex",
    limitName: raw.limit_name ?? raw.limitName ?? null,
    primary: normalizeWindow(primary, "5-hour"),
    secondary: normalizeWindow(secondary, "weekly"),
    planType: raw.plan_type ?? raw.planType ?? null,
    rateLimitReachedType: raw.rate_limit_reached_type ?? raw.rateLimitReachedType ?? null
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
    windows: [event.rateLimits.primary, event.rateLimits.secondary]
      .filter(Boolean)
      .map((window) => summarizeWindow(window, nowMs)),
    tokenUsage: event.tokenUsage
  };
}

function summarizeWindow(window, nowMs) {
  const resetsAtMs = window.resetsAt * 1000;
  const remainingMs = Math.max(0, resetsAtMs - nowMs);
  return {
    name: window.name,
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
  console.log(JSON.stringify(readLatestUsageSnapshot(), null, 2));
}

module.exports = {
  extractTokenCountEvent,
  findSessionFiles,
  formatDuration,
  readLatestUsageSnapshot,
  summarizeSnapshot
};
