const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("codexUsage", {
  auth: () => ipcRenderer.invoke("auth:get"),
  get: () => ipcRenderer.invoke("usage:get"),
  signIn: () => ipcRenderer.invoke("auth:signIn"),
  signOut: () => ipcRenderer.invoke("auth:signOut")
});
