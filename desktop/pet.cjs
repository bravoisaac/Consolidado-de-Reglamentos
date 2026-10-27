const { BrowserWindow, ipcMain, session, screen } = require('electron');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const pageUrl = pathToFileURL(path.join(__dirname, 'pet.html')).href;
const sizes = { compact: [150, 174], expanded: [280, 394] };

function createPet({ mainWindow, onAction, onQuit }) {
  let busy = false, suspended = false, disposed = false;
  const petSession = session.fromPartition('folio-pet');
  const files = new Set(['pet.html', 'pet.css', 'pet.js'].map(file => pathToFileURL(path.join(__dirname, file)).href));
  petSession.webRequest.onBeforeRequest((details, callback) => callback({ cancel: !files.has(details.url) }));
  petSession.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
  petSession.setPermissionCheckHandler(() => false);
  const area = screen.getPrimaryDisplay().workArea;
  const window = new BrowserWindow({
    width: sizes.compact[0], height: sizes.compact[1], x: area.x + area.width - 174, y: area.y + area.height - 198,
    title: 'Folio · Mascota', show: false, transparent: true, frame: false, resizable: false,
    maximizable: false, minimizable: false, fullscreenable: false, alwaysOnTop: true,
    skipTaskbar: true, hasShadow: false,
    webPreferences: { session: petSession, preload: path.join(__dirname, 'pet-preload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true, webSecurity: true, spellcheck: false, zoomFactor: 1 }
  });
  window.setMenu(null);
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('will-navigate', event => event.preventDefault());
  window.webContents.on('will-redirect', event => event.preventDefault());
  function trusted(event) {
    if (disposed || window.isDestroyed() || event.sender !== window.webContents || event.senderFrame !== window.webContents.mainFrame || event.senderFrame?.url !== pageUrl) throw new Error('Solicitud no autorizada.');
  }
  function fit(bounds = window.getBounds()) {
    const work = screen.getDisplayMatching(bounds).workArea;
    const next = { ...bounds, x: Math.max(work.x, Math.min(bounds.x, work.x + work.width - bounds.width)), y: Math.max(work.y, Math.min(bounds.y, work.y + work.height - bounds.height)) };
    const current = window.getBounds();
    if (['x', 'y', 'width', 'height'].some(key => current[key] !== next[key])) window.setBounds(next);
  }
  function recoverPosition() { if (!disposed && !window.isDestroyed()) fit(); }
  function show() { if (!disposed && !suspended && !window.isDestroyed()) { fit(); window.showInactive(); } }
  function hide() { if (!window.isDestroyed()) window.hide(); }
  function open() {
    if (mainWindow.isDestroyed()) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show(); mainWindow.focus(); hide();
  }
  const handleAction = (event, action) => {
    trusted(event);
    if (!['open', 'capture', 'question', 'library', 'quit'].includes(action)) throw new Error('Acción no disponible.');
    if (action === 'quit') { onQuit(); return; }
    if (action === 'capture') {
      if (busy || suspended) return;
      onAction(action);
    } else { open(); if (action !== 'open') onAction(action); }
  };
  const handleExpand = (event, expanded) => {
    trusted(event);
    if (typeof expanded !== 'boolean') throw new Error('Tamaño no válido.');
    const bounds = window.getBounds();
    const [width, height] = expanded ? sizes.expanded : sizes.compact;
    fit({ x: bounds.x + bounds.width - width, y: bounds.y + bounds.height - height, width, height });
  };
  ipcMain.handle('folio-pet:action', handleAction);
  ipcMain.handle('folio-pet:expand', handleExpand);
  mainWindow.on('minimize', show);
  mainWindow.on('restore', hide);
  mainWindow.on('show', hide);
  screen.on('display-removed', recoverPosition);
  screen.on('display-metrics-changed', recoverPosition);
  window.on('moved', recoverPosition);
  window.webContents.on('render-process-gone', open);
  const ready = window.loadURL(pageUrl);
  return {
    window, ready, open,
    minimize() { mainWindow.minimize(); show(); },
    suspend(value) { suspended = value; if (value) hide(); else if (mainWindow.isMinimized()) show(); },
    setBusy(value) { busy = value; if (!window.isDestroyed()) window.webContents.send('folio-pet:busy', busy); },
    dispose() {
      disposed = true;
      mainWindow.removeListener('minimize', show); mainWindow.removeListener('restore', hide); mainWindow.removeListener('show', hide);
      screen.removeListener('display-removed', recoverPosition); screen.removeListener('display-metrics-changed', recoverPosition);
      ipcMain.removeHandler('folio-pet:action'); ipcMain.removeHandler('folio-pet:expand');
      if (!window.isDestroyed()) window.destroy();
    }
  };
}
module.exports = { createPet };
