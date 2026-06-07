const windowGrid = document.getElementById("windowGrid");
const subtitle = document.getElementById("subtitle");
const statusBanner = document.getElementById("statusBanner");
const sourceText = document.getElementById("sourceText");
const scanText = document.getElementById("scanText");
const refreshButton = document.getElementById("refreshButton");
const signInButton = document.getElementById("signInButton");
const signOutButton = document.getElementById("signOutButton");
const openSourceButton = document.getElementById("openSourceButton");
const autoRefreshToggle = document.getElementById("autoRefreshToggle");
const darkModeToggle = document.getElementById("darkModeToggle");
const refreshIntervalSelect = document.getElementById("refreshIntervalSelect");
const tokenGrid = document.getElementById("tokenGrid");

let lastSourceFile = null;
let refreshTimer = null;

const settings = {
  autoRefresh: localStorage.getItem("autoRefresh") === "true",
  darkMode: localStorage.getItem("darkMode") === "true",
  refreshInterval: ["1", "5", "10", "15", "30"].includes(localStorage.getItem("refreshInterval"))
    ? localStorage.getItem("refreshInterval")
    : "5"
};

function pct(value) {
  if (value === null || value === undefined) return "Unknown";
  return `${Math.round(value)}%`;
}

function formatNumber(value) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "Unknown";
  return new Intl.NumberFormat().format(value);
}

function labelFor(key) {
  return key
    .replace(/_/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function renderWindow(window) {
  const used = window.usedPercent ?? 0;
  const tone = used >= 100 ? "critical" : used >= 85 ? "warning" : "normal";
  return `
    <article class="limit-card ${tone}">
      <div class="limit-card-header">
        <h2>${window.name}</h2>
        <span>${window.windowMinutes} min</span>
      </div>
      <div class="meter" aria-label="${window.name} usage">
        <div style="width: ${Math.max(0, Math.min(100, used))}%"></div>
      </div>
      <div class="stats">
        <div>
          <span>Used</span>
          <strong>${pct(window.usedPercent)}</strong>
        </div>
        <div>
          <span>Left</span>
          <strong>${pct(window.remainingPercent)}</strong>
        </div>
      </div>
      <div class="reset">
        <span>Reset</span>
        <strong>${window.remainingText}</strong>
        <small>${window.resetsAt ? new Date(window.resetsAt).toLocaleString() : "Unknown"}</small>
      </div>
    </article>
  `;
}

function renderTokenCounts(tokenUsage) {
  if (!tokenUsage || typeof tokenUsage !== "object") {
    tokenGrid.innerHTML = "<p>No token counts in the latest usage response</p>";
    return;
  }
  const entries = Object.entries(tokenUsage).filter(([, value]) => typeof value === "number" && Number.isFinite(value));
  if (entries.length === 0) {
    tokenGrid.innerHTML = "<p>No token counts in the latest usage response</p>";
    return;
  }
  tokenGrid.innerHTML = entries
    .map(([key, value]) => `
      <article class="token-card">
        <span>${labelFor(key)}</span>
        <strong>${formatNumber(value)}</strong>
      </article>
    `)
    .join("");
}

function applyTheme() {
  document.body.classList.toggle("dark", settings.darkMode);
  darkModeToggle.checked = settings.darkMode;
}

function configureAutoRefresh() {
  if (refreshTimer) {
    clearInterval(refreshTimer);
    refreshTimer = null;
  }
  autoRefreshToggle.checked = settings.autoRefresh;
  refreshIntervalSelect.value = settings.refreshInterval;
  refreshIntervalSelect.disabled = !settings.autoRefresh;
  if (settings.autoRefresh) {
    refreshTimer = setInterval(refresh, Number(settings.refreshInterval) * 60 * 1000);
  }
}

function saveSettings() {
  localStorage.setItem("autoRefresh", String(settings.autoRefresh));
  localStorage.setItem("darkMode", String(settings.darkMode));
  localStorage.setItem("refreshInterval", settings.refreshInterval);
}

async function refresh() {
  refreshButton.disabled = true;
  refreshButton.textContent = "Refreshing";
  try {
    const auth = await window.codexUsage.auth();
    signInButton.disabled = auth.signedIn;
    signOutButton.disabled = !auth.signedIn;
    scanText.textContent = auth.signedIn
      ? `Signed in${auth.planType ? ` on ${auth.planType}` : ""}${auth.accountId ? `; account ${auth.accountId}` : ""}`
      : "Signed out";
    const snapshot = await window.codexUsage.get();
    if (snapshot.status !== "ok") {
      subtitle.textContent = snapshot.status === "signed-out" ? "Sign in required" : "Usage data unavailable";
      statusBanner.textContent = snapshot.message;
      statusBanner.className = snapshot.status === "auth-error" ? "status-banner critical" : "status-banner warning";
      windowGrid.innerHTML = "";
      renderTokenCounts(null);
      sourceText.textContent = snapshot.sourceUrl ?? "OAuth";
      openSourceButton.disabled = true;
      return;
    }
    const primary = snapshot.windows.find((item) => item.windowMinutes === 300);
    const weekly = snapshot.windows.find((item) => item.windowMinutes === 10080);
    subtitle.textContent = `Plan ${snapshot.planType ?? "unknown"}; observed ${new Date(snapshot.observedAt).toLocaleString()}`;
    statusBanner.textContent = snapshot.rateLimitReachedType
      ? `Codex reports a reached limit: ${snapshot.rateLimitReachedType}`
      : `5-hour reset in ${primary?.remainingText ?? "unknown"}; weekly reset in ${weekly?.remainingText ?? "unknown"}`;
    statusBanner.className = snapshot.rateLimitReachedType ? "status-banner critical" : "status-banner";
    windowGrid.innerHTML = snapshot.windows.map(renderWindow).join("");
    renderTokenCounts(snapshot.tokenUsage);
    lastSourceFile = snapshot.sourceFile ?? null;
    sourceText.textContent = snapshot.sourceUrl ?? snapshot.sourceFile ?? "OAuth";
    openSourceButton.disabled = !lastSourceFile;
  } finally {
    refreshButton.disabled = false;
    refreshButton.textContent = "Refresh";
  }
}

refreshButton.addEventListener("click", refresh);
signInButton.addEventListener("click", async () => {
  signInButton.disabled = true;
  statusBanner.textContent = "Opening ChatGPT sign-in";
  try {
    await window.codexUsage.signIn();
  } catch (error) {
    statusBanner.textContent = error.message;
    statusBanner.className = "status-banner critical";
  }
  await refresh();
});
signOutButton.addEventListener("click", async () => {
  await window.codexUsage.signOut();
  await refresh();
});
autoRefreshToggle.addEventListener("change", () => {
  settings.autoRefresh = autoRefreshToggle.checked;
  saveSettings();
  configureAutoRefresh();
});
refreshIntervalSelect.addEventListener("change", () => {
  settings.refreshInterval = refreshIntervalSelect.value;
  saveSettings();
  configureAutoRefresh();
});
darkModeToggle.addEventListener("change", () => {
  settings.darkMode = darkModeToggle.checked;
  saveSettings();
  applyTheme();
});
openSourceButton.addEventListener("click", () => window.codexUsage.openSource(lastSourceFile));
applyTheme();
configureAutoRefresh();
refresh();
