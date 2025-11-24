const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('pumpLauncher', {
  version: 'desktop-bridge-1',
  openExternal: (url) => ipcRenderer.invoke('open-external', url),
});
