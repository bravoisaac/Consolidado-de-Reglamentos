const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('folioDesktop', Object.freeze({
  captureSources: () => ipcRenderer.invoke('folio:capture-sources'),
  capture: id => ipcRenderer.invoke('folio:capture', id)
}));
