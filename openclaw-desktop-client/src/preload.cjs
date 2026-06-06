const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('openclawDesktop', {
  scanLocalAgents: (options) => ipcRenderer.invoke('local-agent:scan', options),
  readLocalAgentFolder: (rootPath, options) => ipcRenderer.invoke('local-agent:read-folder', rootPath, options),
});
