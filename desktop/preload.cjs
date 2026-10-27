const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('folioDesktop', Object.freeze({
  minimize: () => ipcRenderer.invoke('folio:minimize'),
  show: () => ipcRenderer.invoke('folio:show'),
  setBusy: value => ipcRenderer.invoke('folio:busy', value),
  onAction: callback => ipcRenderer.on('folio:action', (_event, action) => { if (['capture', 'question', 'library'].includes(action)) callback(action); }),
  captureRegion: () => ipcRenderer.invoke('folio:capture-region'),
  captureSources: () => ipcRenderer.invoke('folio:capture-sources'),
  capture: id => ipcRenderer.invoke('folio:capture', id)
}));
