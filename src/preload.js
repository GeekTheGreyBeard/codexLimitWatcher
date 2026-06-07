const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("codexUsage", {
  auth: () => ipcRenderer.invoke("auth:get"),
  get: () => ipcRenderer.invoke("usage:get"),
  openLink: (url) => ipcRenderer.invoke("link:open", url),
  signIn: () => ipcRenderer.invoke("auth:signIn"),
  signOut: () => ipcRenderer.invoke("auth:signOut"),
  setMiniMode: (enabled) => ipcRenderer.invoke("window:setMiniMode", enabled)
});
