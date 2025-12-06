import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('pumpLauncher', {
  version: 'desktop-bridge-2',
  openExternal: (url: string) => ipcRenderer.invoke('open-external', url),
  goBack: () => ipcRenderer.invoke('go-back'),
  goForward: () => ipcRenderer.invoke('go-forward'),
  canGoBack: () => ipcRenderer.invoke('can-go-back'),
  canGoForward: () => ipcRenderer.invoke('can-go-forward'),
})

contextBridge.exposeInMainWorld('electron', {
  wallet: {
    save: (privateKey: string) => ipcRenderer.invoke('wallet:save', privateKey),
    load: () => ipcRenderer.invoke('wallet:load'),
    exists: () => ipcRenderer.invoke('wallet:exists'),
    clear: () => ipcRenderer.invoke('wallet:clear'),
  },
  file: {
    openKeypair: () => ipcRenderer.invoke('file:open-keypair'),
    saveKeypair: (keypair: unknown) => ipcRenderer.invoke('file:save-keypair', keypair),
    getKeysDirectory: () => ipcRenderer.invoke('file:get-keys-directory'),
  },
  system: {
    getInfo: () => ipcRenderer.invoke('system:get-info'),
  },
  log: {
    info: (message: string) => ipcRenderer.invoke('log:info', message),
    error: (message: string) => ipcRenderer.invoke('log:error', message),
  },
})
