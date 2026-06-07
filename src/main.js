const { app, BrowserWindow, ipcMain } = require("electron");
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
    width: 980,
    height: 680,
    minWidth: 760,
    minHeight: 520,
    title: "Codex Limit Watcher",
    backgroundColor: "#f6f7f8",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  win.loadFile(path.join(__dirname, "renderer.html"));
}

ipcMain.handle("auth:get", () => getAuthSummary(app.getPath("userData")));
ipcMain.handle("auth:signIn", () => signIn(app.getPath("userData")));
ipcMain.handle("auth:signOut", () => signOut(app.getPath("userData")));
ipcMain.handle("usage:get", () => readUsageSnapshot({ userDataPath: app.getPath("userData") }));

app.whenReady().then(createWindow);
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
