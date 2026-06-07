const windowGrid = document.getElementById("windowGrid");
const subtitle = document.getElementById("subtitle");
const statusBanner = document.getElementById("statusBanner");
const sourceText = document.getElementById("sourceText");
const scanText = document.getElementById("scanText");
const refreshButton = document.getElementById("refreshButton");
const openSourceButton = document.getElementById("openSourceButton");

let lastSourceFile = null;

function pct(value) {
  if (value === null || value === undefined) return "Unknown";
  return `${Math.round(value)}%`;
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

async function refresh() {
  refreshButton.disabled = true;
  refreshButton.textContent = "Refreshing";
  try {
    const snapshot = await window.codexUsage.get();
    if (snapshot.status !== "ok") {
      subtitle.textContent = "No usage event found";
      statusBanner.textContent = snapshot.message;
      statusBanner.className = "status-banner warning";
      windowGrid.innerHTML = "";
      sourceText.textContent = "No source file yet";
      scanText.textContent = `${snapshot.scannedFiles} files scanned, ${snapshot.scannedEvents} usage events`;
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
    lastSourceFile = snapshot.sourceFile;
    sourceText.textContent = snapshot.sourceFile;
    scanText.textContent = `${snapshot.scannedFiles} files scanned, ${snapshot.scannedEvents} usage events`;
    openSourceButton.disabled = false;
  } finally {
    refreshButton.disabled = false;
    refreshButton.textContent = "Refresh";
  }
}

refreshButton.addEventListener("click", refresh);
openSourceButton.addEventListener("click", () => window.codexUsage.openSource(lastSourceFile));
refresh();
setInterval(refresh, 60000);
