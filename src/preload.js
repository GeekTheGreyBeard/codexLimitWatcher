const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("codexUsage", {
  auth: () => ipcRenderer.invoke("auth:get"),
  get: () => ipcRenderer.invoke("usage:get"),
  openSource: (sourceFile) => ipcRenderer.invoke("usage:openSource", sourceFile),
  signIn: () => ipcRenderer.invoke("auth:signIn"),
  signOut: () => ipcRenderer.invoke("auth:signOut")
});
