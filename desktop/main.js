const { app, BrowserWindow, nativeTheme, shell, ipcMain } = require('electron');
const path = require('path');
const isDev = process.argv.includes('dev');

// Import IPC handlers (if compiled from TypeScript)
try {
  require('./ipc-handlers.js');
} catch (err) {
  console.warn('IPC handlers not loaded (may be compiled separately)');
}

let mainWindow = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1320,
    height: 900,
    backgroundColor: '#0d0d0d',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    // In production, files are in the asar.
    // __dirname in production points to app.asar/desktop
    // web/dist is at app.asar/web/dist
    const indexPath = path.join(__dirname, '..', 'web', 'dist', 'index.html');
    mainWindow.loadFile(indexPath);
  }

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http')) {
      shell.openExternal(url);
      return { action: 'deny' };
    }
    return { action: 'allow' };
  });

  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (url.startsWith('http')) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });
}

app.whenReady().then(() => {
  nativeTheme.themeSource = 'dark';
  createWindow();

  ipcMain.handle('open-external', (_event, url) => shell.openExternal(url));

  // Navigation handlers
  ipcMain.handle('go-back', () => {
    if (mainWindow && mainWindow.webContents.canGoBack()) {
      mainWindow.webContents.goBack();
    }
  });

  ipcMain.handle('go-forward', () => {
    if (mainWindow && mainWindow.webContents.canGoForward()) {
      mainWindow.webContents.goForward();
    }
  });

  ipcMain.handle('can-go-back', () => {
    return mainWindow ? mainWindow.webContents.canGoBack() : false;
  });

  ipcMain.handle('can-go-forward', () => {
    return mainWindow ? mainWindow.webContents.canGoForward() : false;
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
