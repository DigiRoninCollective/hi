const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('pumpLauncher', {
  version: 'desktop-bridge-2',
  openExternal: (url) => ipcRenderer.invoke('open-external', url),
  goBack: () => ipcRenderer.invoke('go-back'),
  goForward: () => ipcRenderer.invoke('go-forward'),
  canGoBack: () => ipcRenderer.invoke('can-go-back'),
  canGoForward: () => ipcRenderer.invoke('can-go-forward'),
});
