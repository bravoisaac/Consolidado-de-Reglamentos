const { BrowserWindow, ipcMain, session, screen, desktopCapturer } = require('electron');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { cropRectangle } = require('./region-geometry.cjs');
const pageUrl = pathToFileURL(path.join(__dirname, 'region.html')).href;

function createRegionCapture({ getDisplays = () => screen.getAllDisplays(), getSources = options => desktopCapturer.getSources(options), settleMs = 180 } = {}) {
  let active, disposed = false;
  const overlaySession = session.fromPartition('folio-region-selector');
  const files = new Set(['region.html','region.css','region.js'].map(name => pathToFileURL(path.join(__dirname,name)).href));
  overlaySession.webRequest.onBeforeRequest((details, callback) => callback({ cancel: !files.has(details.url) }));
  overlaySession.setPermissionRequestHandler((_contents,_permission,callback) => callback(false));
  overlaySession.setPermissionCheckHandler(() => false);

  function sender(event) {
    if (!active || active.phase !== 'selecting' || event.senderFrame?.url !== pageUrl || event.senderFrame !== event.sender.mainFrame) return null;
    return active.windows.find(item => !item.window.isDestroyed() && item.window.webContents === event.sender);
  }
  function closeOverlays(state) {
    for (const item of state.windows) if (!item.window.isDestroyed()) item.window.destroy();
  }
  function finish(state, value, error) {
    if (state.done) return;
    state.done = true; clearTimeout(state.timer); closeOverlays(state);
    if (active === state) active = undefined;
    if (!state.parent.isDestroyed() && !disposed) { if (state.parent.isMinimized()) state.parent.restore(); state.parent.show(); state.parent.focus(); }
    if (error) state.reject(error); else state.resolve(value);
  }
  function cancel() { if (active) finish(active, null); }
  const onCancel = event => { if (sender(event)) cancel(); };
  const onFinish = async (event, rect) => {
    const item = sender(event); if (!item) return;
    const state = active;
    try {
      // Validate before taking any screenshot. Rectangle is local to the sender's monitor.
      cropRectangle(rect, item.display.bounds, item.display.bounds);
      state.phase = 'capturing'; closeOverlays(state);
      await new Promise(resolve => setTimeout(resolve, settleMs));
      if (state.done) return;
      const current = getDisplays().find(display => display.id === item.display.id);
      if (!current || ['x','y','width','height'].some(key => current.bounds[key] !== item.display.bounds[key]) || current.scaleFactor !== item.display.scaleFactor) throw new Error('La configuración de pantalla cambió. Vuelve a seleccionar.');
      const sources = await getSources({ types: ['screen'], thumbnailSize: { width: Math.ceil(current.bounds.width * current.scaleFactor), height: Math.ceil(current.bounds.height * current.scaleFactor) }, fetchWindowIcons: false });
      if (state.done) return;
      const source = sources.find(source => source.display_id === String(current.id));
      if (!source || source.thumbnail.isEmpty()) throw new Error('No se pudo identificar la pantalla seleccionada.');
      let cropped = source.thumbnail.crop(cropRectangle(rect, current.bounds, source.thumbnail.getSize()));
      const size = cropped.getSize();
      if (Math.max(size.width,size.height) > 5000) { const factor = 5000 / Math.max(size.width,size.height); cropped = cropped.resize({ width: Math.floor(size.width*factor), height: Math.floor(size.height*factor), quality: 'best' }); }
      const png = cropped.toPNG();
      if (png.length > 15 * 1024 * 1024) throw new Error('La zona supera 15 MB. Selecciona una zona más pequeña.');
      finish(state, png.toString('base64'));
    } catch (error) { finish(state, null, error); }
  };
  ipcMain.on('folio-region:cancel', onCancel);
  ipcMain.on('folio-region:finish', onFinish);

  return {
    capture(parent) {
      if (disposed || active || !parent || parent.isDestroyed()) return Promise.reject(new Error('Ya hay una selección en curso.'));
      return new Promise((resolve,reject) => {
        const state = { parent, resolve, reject, windows: [], phase: 'selecting', done: false };
        active = state;
        state.timer = setTimeout(() => finish(state,null), 120000);
        try {
          const displays = getDisplays();
          if (!displays.length) throw new Error('No se encontraron pantallas.');
          parent.hide();
          const preferred = screen.getDisplayNearestPoint(screen.getCursorScreenPoint()).id;
          for (const display of displays) {
            const window = new BrowserWindow({ ...display.bounds, show: false, transparent: true, frame: false, resizable: false, movable: false, minimizable: false, maximizable: false, fullscreenable: false, hasShadow: false, alwaysOnTop: true, skipTaskbar: true, focusable: true, enableLargerThanScreen: true, webPreferences: { session: overlaySession, preload: path.join(__dirname,'region-preload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true, webSecurity: true, spellcheck: false, zoomFactor: 1 } });
            state.windows.push({ window, display: { ...display, bounds: { ...display.bounds } } });
            window.setMenu(null);
            window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
            window.webContents.on('will-navigate', event => event.preventDefault());
            window.once('ready-to-show', () => { if (state.done || window.isDestroyed()) return; window.showInactive(); if (display.id === preferred || displays.length === 1) window.focus(); });
            window.on('closed', () => { if (!state.done && state.phase === 'selecting') finish(state,null); });
            window.webContents.on('render-process-gone', () => { if (!state.done) finish(state,null,new Error('No se pudo abrir el selector.')); });
            window.loadURL(pageUrl).catch(error => finish(state,null,error));
          }
        } catch (error) { finish(state,null,error); }
      });
    },
    cancel,
    dispose() { disposed = true; cancel(); ipcMain.removeListener('folio-region:cancel',onCancel); ipcMain.removeListener('folio-region:finish',onFinish); }
  };
}
module.exports = { createRegionCapture };
