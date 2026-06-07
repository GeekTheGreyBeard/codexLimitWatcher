const windowGrid = document.getElementById("windowGrid");
const subtitle = document.getElementById("subtitle");
const statusBanner = document.getElementById("statusBanner");
const scanText = document.getElementById("scanText");
const showAccountButton = document.getElementById("showAccountButton");
const refreshButton = document.getElementById("refreshButton");
const miniModeButton = document.getElementById("miniModeButton");
const aboutButton = document.getElementById("aboutButton");
const aboutDialog = document.getElementById("aboutDialog");
const signInButton = document.getElementById("signInButton");
const signOutButton = document.getElementById("signOutButton");
const autoRefreshToggle = document.getElementById("autoRefreshToggle");
const darkModeToggle = document.getElementById("darkModeToggle");
const refreshIntervalSelect = document.getElementById("refreshIntervalSelect");

let refreshTimer = null;
const accountState = {
  signedIn: false,
  planType: null,
  accountId: null,
  showAccountNumber: false
};

const settings = {
  autoRefresh: localStorage.getItem("autoRefresh") === "true",
  darkMode: localStorage.getItem("darkMode") === "true",
  miniMode: localStorage.getItem("miniMode") === "true",
  refreshInterval: ["1", "5", "10", "15", "30"].includes(localStorage.getItem("refreshInterval"))
    ? localStorage.getItem("refreshInterval")
    : "5"
};

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

function maskedAccountId(accountId) {
  if (!accountId) return "account unavailable";
  return `account ending ${accountId.slice(-4).padStart(4, "*")}`;
}

function renderAccount() {
  if (!accountState.signedIn) {
    scanText.textContent = "Signed out";
    showAccountButton.disabled = true;
    showAccountButton.textContent = "Show Account Number";
    return;
  }
  const planText = accountState.planType ? ` on ${accountState.planType}` : "";
  const accountText = accountState.showAccountNumber
    ? `account ${accountState.accountId ?? "unavailable"}`
    : maskedAccountId(accountState.accountId);
  scanText.textContent = `Signed in${planText}; ${accountText}`;
  showAccountButton.disabled = !accountState.accountId;
  showAccountButton.textContent = accountState.showAccountNumber ? "Hide Account Number" : "Show Account Number";
}

function updateAccount(auth) {
  if (auth.accountId !== accountState.accountId) {
    accountState.showAccountNumber = false;
  }
  accountState.signedIn = auth.signedIn;
  accountState.planType = auth.planType ?? null;
  accountState.accountId = auth.accountId ?? null;
  renderAccount();
}

function applyTheme() {
  document.body.classList.toggle("dark", settings.darkMode);
  darkModeToggle.checked = settings.darkMode;
}

function applyMiniMode() {
  document.body.classList.toggle("mini", settings.miniMode);
  miniModeButton.textContent = settings.miniMode ? "Normal" : "Mini";
  miniModeButton.setAttribute("aria-label", settings.miniMode ? "Switch to normal mode" : "Switch to mini mode");
  window.codexUsage.setMiniMode(settings.miniMode);
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
  localStorage.setItem("miniMode", String(settings.miniMode));
  localStorage.setItem("refreshInterval", settings.refreshInterval);
}

async function refresh() {
  refreshButton.disabled = true;
  refreshButton.textContent = "Refreshing";
  try {
    const auth = await window.codexUsage.auth();
    signInButton.disabled = auth.signedIn;
    signOutButton.disabled = !auth.signedIn;
    updateAccount(auth);
    const snapshot = await window.codexUsage.get();
    if (snapshot.status !== "ok") {
      subtitle.textContent = snapshot.status === "signed-out" ? "Sign in required" : "Usage data unavailable";
      statusBanner.textContent = snapshot.message;
      statusBanner.className = snapshot.status === "auth-error" ? "status-banner critical" : "status-banner warning";
      windowGrid.innerHTML = "";
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
showAccountButton.addEventListener("click", () => {
  accountState.showAccountNumber = !accountState.showAccountNumber;
  renderAccount();
});
miniModeButton.addEventListener("click", () => {
  settings.miniMode = !settings.miniMode;
  saveSettings();
  applyMiniMode();
});
aboutButton.addEventListener("click", () => {
  aboutDialog.showModal();
});
aboutDialog.addEventListener("click", (event) => {
  if (event.target === aboutDialog) {
    aboutDialog.close();
  }
});
aboutDialog.querySelectorAll("[data-url]").forEach((button) => {
  button.addEventListener("click", () => {
    window.codexUsage.openLink(button.dataset.url);
  });
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
applyTheme();
applyMiniMode();
configureAutoRefresh();
refresh();
