const windowGrid = document.getElementById("windowGrid");
const subtitle = document.getElementById("subtitle");
const statusBanner = document.getElementById("statusBanner");
const sourceText = document.getElementById("sourceText");
const scanText = document.getElementById("scanText");
const refreshButton = document.getElementById("refreshButton");
const signInButton = document.getElementById("signInButton");
const signOutButton = document.getElementById("signOutButton");
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
openSourceButton.addEventListener("click", () => window.codexUsage.openSource(lastSourceFile));
refresh();
setInterval(refresh, 60000);
