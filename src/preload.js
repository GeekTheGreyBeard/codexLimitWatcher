const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("codexUsage", {
  get: () => ipcRenderer.invoke("usage:get"),
  openSource: (sourceFile) => ipcRenderer.invoke("usage:openSource", sourceFile)
});
