const { app, BrowserWindow, nativeTheme, shell, ipcMain } = require('electron');
const path = require('path');
const isDev = process.argv.includes('dev');

function createWindow() {
  const win = new BrowserWindow({
    width: 1320,
    height: 900,
    backgroundColor: '#0d0d0d',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  if (isDev) {
    win.loadURL('http://localhost:5173');
    win.webContents.openDevTools({ mode: 'detach' });
  } else {
    const indexPath = path.join(__dirname, '..', 'web', 'dist', 'index.html');
    win.loadFile(indexPath);
  }
}

app.whenReady().then(() => {
  nativeTheme.themeSource = 'dark';
  createWindow();

  ipcMain.handle('open-external', (_event, url) => shell.openExternal(url));

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
