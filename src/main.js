const { app, BrowserWindow, ipcMain, shell } = require("electron");
const path = require("node:path");
const { getAuthSummary, signIn, signOut } = require("./oauthClient");
const { readUsageSnapshot } = require("./usageReader");

if (process.platform === "linux") {
  app.commandLine.appendSwitch("enable-features", "WaylandWindowDecorations");
  app.commandLine.appendSwitch("disable-features", "Vulkan");
  app.commandLine.appendSwitch("disable-gpu");
  app.commandLine.appendSwitch("ozone-platform-hint", "auto");
}

function createWindow() {
  const win = new BrowserWindow({
    width: 760,
    height: 600,
    minWidth: 680,
    minHeight: 580,
    title: "Codex Limit Watcher",
    backgroundColor: "#f6f7f8",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("https://")) {
      shell.openExternal(url);
    }
    return { action: "deny" };
  });
  win.loadFile(path.join(__dirname, "renderer.html"));
}

ipcMain.handle("auth:get", () => getAuthSummary(app.getPath("userData")));
ipcMain.handle("auth:signIn", () => signIn(app.getPath("userData")));
ipcMain.handle("auth:signOut", () => signOut(app.getPath("userData")));
ipcMain.handle("usage:get", () => readUsageSnapshot({ userDataPath: app.getPath("userData") }));
ipcMain.handle("window:setMiniMode", (event, enabled) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (!win) return;
  if (enabled) {
    win.setMinimumSize(420, 320);
    win.setSize(420, 320);
    return;
  }
  win.setMinimumSize(680, 580);
  win.setSize(760, 600);
});
ipcMain.handle("link:open", (_event, url) => {
  if (typeof url === "string" && url.startsWith("https://")) {
    return shell.openExternal(url);
  }
});

app.whenReady().then(createWindow);
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
