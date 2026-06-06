const path = require('node:path');
const { app, BrowserWindow, ipcMain } = require('electron');
const { scanLocalAgents, collectFolderForUpload } = require('./local-agent-scanner.cjs');

function createWindow() {
  const win = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 1180,
    minHeight: 760,
    title: 'OpenClaw Desktop',
    backgroundColor: '#E8E8E8',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  const webUrl = process.env.OPENCLAW_DESKTOP_WEB_URL;
  if (webUrl) {
    win.loadURL(webUrl);
  } else {
    win.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  }
}

app.whenReady().then(() => {
  ipcMain.handle('local-agent:scan', (_event, options) => scanLocalAgents(options || {}));
  ipcMain.handle('local-agent:read-folder', (_event, rootPath, options) => collectFolderForUpload(rootPath, options || {}));

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
