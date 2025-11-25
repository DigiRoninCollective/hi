const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('pumpLauncher', {
  version: 'desktop-bridge-2',
  openExternal: (url) => ipcRenderer.invoke('open-external', url),
  goBack: () => ipcRenderer.invoke('go-back'),
  goForward: () => ipcRenderer.invoke('go-forward'),
  canGoBack: () => ipcRenderer.invoke('can-go-back'),
  canGoForward: () => ipcRenderer.invoke('can-go-forward'),
});

contextBridge.exposeInMainWorld('electron', {
  // Wallet/Keypair management
  wallet: {
    save: (privateKey) => ipcRenderer.invoke('wallet:save', privateKey),
    load: () => ipcRenderer.invoke('wallet:load'),
    exists: () => ipcRenderer.invoke('wallet:exists'),
    clear: () => ipcRenderer.invoke('wallet:clear'),
  },

  // File operations
  file: {
    openKeypair: () => ipcRenderer.invoke('file:open-keypair'),
    saveKeypair: (keypair) => ipcRenderer.invoke('file:save-keypair', keypair),
    getKeysDirectory: () => ipcRenderer.invoke('file:get-keys-directory'),
  },

  // System info
  system: {
    getInfo: () => ipcRenderer.invoke('system:get-info'),
  },

  // Logging
  log: {
    info: (message) => ipcRenderer.invoke('log:info', message),
    error: (message) => ipcRenderer.invoke('log:error', message),
  },
});
