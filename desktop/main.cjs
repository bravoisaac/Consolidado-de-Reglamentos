const { app, BrowserWindow, session, ipcMain, desktopCapturer, Menu, dialog, shell } = require('electron');
const { fork, execFile } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');
const { createRegionCapture } = require('./region-capture.cjs');
const { createPet } = require('./pet.cjs');

const appRoot = path.resolve(__dirname, '..');
const smoke = process.argv.includes('--smoke-test');
const localRoot = smoke ? (process.env.FOLIO_SMOKE_DIR || fs.mkdtempSync(path.join(app.getPath('temp'), 'folio-smoke-'))) : path.join(process.env.LOCALAPPDATA || path.join(app.getPath('home'), 'AppData', 'Local'), 'Folio');
fs.mkdirSync(localRoot, { recursive: true });
app.setPath('userData', localRoot);
app.setAppUserModelId('local.folio.reglamentos');
app.commandLine.appendSwitch('disable-background-networking');
app.commandLine.appendSwitch('disable-component-update');
app.commandLine.appendSwitch('disable-domain-reliability');
app.commandLine.appendSwitch('disable-sync');
let backend, mainWindow, origin, regionCapture, pet, closing = false;
let allowedSources = new Map();
const webPreferences = { contextIsolation: true, nodeIntegration: false, sandbox: true, webSecurity: true, spellcheck: false };

function trusted(event) {
  if (!mainWindow || event.sender !== mainWindow.webContents || event.senderFrame !== mainWindow.webContents.mainFrame || event.senderFrame?.url !== `${origin}/`) throw new Error('Solicitud no autorizada.');
}
function guardWindow(window) {
  window.webContents.on('will-navigate', (event, url) => { if (!isLocal(url)) event.preventDefault(); });
  window.webContents.on('will-redirect', (event, url) => { if (!isLocal(url)) event.preventDefault(); });
  window.webContents.setWindowOpenHandler(({ url }) => {
    if (!isLocal(url) || !/^\/documents\/[a-f0-9-]+$/.test(new URL(url).pathname)) return { action: 'deny' };
    return { action: 'allow', overrideBrowserWindowOptions: { width: 1000, height: 800, autoHideMenuBar: true, webPreferences } };
  });
  window.webContents.on('did-create-window', child => guardWindow(child));
}
function isLocal(url) { try { return new URL(url).origin === origin; } catch { return false; } }

function startBackend() {
  return new Promise((resolve, reject) => {
    const node = process.execPath;
    backend = fork(path.join(appRoot, 'server.mjs'), ['--desktop'], {
      execPath: node, execArgv: [], windowsHide: true, stdio: ['ignore', 'ignore', 'ignore', 'ipc'],
      env: { ...process.env, ELECTRON_RUN_AS_NODE: '1', FOLIO_DATA_DIR: path.join(localRoot, 'data') }
    });
    const timeout = setTimeout(() => reject(new Error('El servidor local no respondió a tiempo.')), 30000);
    backend.once('error', () => { clearTimeout(timeout); reject(new Error('No se pudo iniciar el motor local incluido.')); });
    backend.on('message', message => {
      if (message?.type !== 'ready' || !/^http:\/\/127\.0\.0\.1:\d+$/.test(message.url)) return;
      clearTimeout(timeout); origin = message.url; resolve();
    });
    backend.once('exit', () => {
      clearTimeout(timeout); backend = undefined;
      if (!closing) { reject(new Error('El servidor local se detuvo.')); if (mainWindow) { dialog.showErrorBox('Folio', 'El motor local se detuvo. Cierra y vuelve a abrir Folio.'); app.quit(); } }
    });
  });
}

if (!app.requestSingleInstanceLock()) { app.quit(); }
else {
  app.on('second-instance', () => { if (mainWindow) { if (mainWindow.isMinimized()) mainWindow.restore(); mainWindow.show(); mainWindow.focus(); } });
  app.whenReady().then(async () => {
    await startBackend();
    const ses = session.defaultSession;
    // Only the private Folio origin can perform requests in any app window.
    ses.webRequest.onBeforeRequest((details, callback) => callback({ cancel: !isLocal(details.url) && !/^(data:|blob:)/.test(details.url) }));
    ses.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
    ses.setPermissionCheckHandler(() => false);
    ses.on('will-download', (event, item) => {
      if (!isLocal(item.getURL())) { event.preventDefault(); return; }
      item.setSaveDialogOptions({ title: 'Guardar copia del documento', defaultPath: path.join(app.getPath('downloads'), path.basename(item.getFilename())) });
    });
    mainWindow = new BrowserWindow({ width: 1380, height: 940, minWidth: 720, minHeight: 600, title: 'Folio · Reglamentos locales', backgroundColor: '#f7f8f5', icon: path.join(__dirname, 'icon.png'), show: false, webPreferences: { ...webPreferences, preload: path.join(__dirname, 'preload.cjs') } });
    guardWindow(mainWindow);
    regionCapture = createRegionCapture(smoke ? require('./region-smoke.cjs').options() : undefined);
    ipcMain.handle('folio:capture-region', async event => {
      trusted(event); pet.suspend(true);
      try { return await regionCapture.capture(mainWindow); }
      finally { pet.suspend(false); }
    });
    ipcMain.handle('folio:minimize', event => { trusted(event); pet.minimize(); });
    ipcMain.handle('folio:show', event => { trusted(event); pet.open(); });
    ipcMain.handle('folio:busy', (event, value) => {
      trusted(event);
      if (typeof value !== 'boolean') throw new Error('Estado no válido.');
      pet.setBusy(value);
    });
    ipcMain.handle('folio:capture-sources', async event => {
      trusted(event);
      const sources = await desktopCapturer.getSources({ types: ['window', 'screen'], thumbnailSize: { width: 0, height: 0 }, fetchWindowIcons: false });
      const expires = Date.now() + 120000;
      allowedSources = new Map(sources.map(source => [source.id, expires]));
      return sources.map(source => ({ id: source.id, name: source.name }));
    });
    ipcMain.handle('folio:capture', async (event, id) => {
      trusted(event);
      if (typeof id !== 'string' || (allowedSources.get(id) || 0) < Date.now()) throw new Error('Vuelve a seleccionar una ventana.');
      allowedSources.clear();
      const sources = await desktopCapturer.getSources({ types: [id.startsWith('screen:') ? 'screen' : 'window'], thumbnailSize: { width: 3500, height: 3500 }, fetchWindowIcons: false });
      const chosen = sources.find(source => source.id === id);
      if (!chosen || chosen.thumbnail.isEmpty()) throw new Error('No se pudo capturar la ventana seleccionada.');
      const png = chosen.thumbnail.toPNG();
      if (png.length > 15 * 1024 * 1024) throw new Error('La captura supera 15 MB. Prueba con una ventana más pequeña.');
      return png.toString('base64');
    });
    const installFirewall = () => {
      const script = path.join(appRoot, 'scripts', 'ollama-firewall.ps1');
      const escaped = script.replace(/'/g, "''");
      const command = `$argsFolio = '-NoProfile -NonInteractive -ExecutionPolicy Bypass -File "${escaped}" -Mode Install'; Start-Process -FilePath powershell.exe -ArgumentList $argsFolio -Verb RunAs -WindowStyle Hidden`;
      execFile('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', command], { windowsHide: true }, error => {
        dialog.showMessageBox(mainWindow, { type: error ? 'warning' : 'info', message: error ? 'No se pudo solicitar permisos de administrador.' : 'Se solicitó configurar el bloqueo de Ollama.', detail: 'Después de autorizar Windows, activa IA local. Folio verificará las reglas antes de permitir la consulta.' });
      });
    };
    Menu.setApplicationMenu(Menu.buildFromTemplate([
      { label: 'Folio', submenu: [ { label: 'Minimizar a mascota', accelerator: 'CommandOrControl+Shift+M', click: () => pet.minimize() }, { type: 'separator' }, { label: 'Configurar bloqueo de Internet de la IA…', click: installFirewall }, { label: 'Abrir carpeta de datos', click: () => shell.openPath(path.join(localRoot, 'data')) }, { type: 'separator' }, { label: 'Salir', role: 'quit' } ] },
      { label: 'Editar', submenu: [ { role: 'undo' }, { role: 'redo' }, { type: 'separator' }, { role: 'cut' }, { role: 'copy' }, { role: 'paste' }, { role: 'selectAll' } ] },
      { label: 'Ver', submenu: [ { role: 'resetZoom' }, { role: 'zoomIn' }, { role: 'zoomOut' }, { role: 'togglefullscreen' } ] }
    ]));
    pet = createPet({ mainWindow, onAction: action => mainWindow.webContents.send('folio:action', action), onQuit: () => app.quit() });
    await pet.ready;
    mainWindow.once('ready-to-show', () => mainWindow.show());
    mainWindow.on('closed', () => { mainWindow = undefined; app.quit(); });
    await mainWindow.loadURL(origin);
    // Explicit smoke mode uses only synthetic data and exits without touching user libraries.
    if (smoke) {
      const { runSmokeTest } = require('./smoke.cjs');
      try { await runSmokeTest({ mainWindow, origin, localRoot, backend, regionCapture, pet }); }
      catch (error) { fs.writeFileSync(path.join(localRoot, 'smoke-result.json'), JSON.stringify({ ok: false, error: error.message })); }
      app.quit();
    }
  }).catch(error => { if (smoke) fs.writeFileSync(path.join(localRoot, 'smoke-result.json'), JSON.stringify({ ok: false, error: error.message })); else dialog.showErrorBox('No se pudo abrir Folio', error.message); app.quit(); });
  app.on('window-all-closed', () => app.quit());
  app.on('before-quit', event => {
    pet?.dispose();
    regionCapture?.dispose();
    if (!backend || closing) return;
    event.preventDefault(); closing = true;
    const child = backend;
    const timer = setTimeout(() => { child.kill(); app.quit(); }, 5000);
    child.once('exit', () => { clearTimeout(timer); app.quit(); });
    child.send({ type: 'shutdown' });
  });
}
