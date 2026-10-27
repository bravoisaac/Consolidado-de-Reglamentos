const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('folioRegion', Object.freeze({
  finish: rectangle => ipcRenderer.send('folio-region:finish', rectangle),
  cancel: () => ipcRenderer.send('folio-region:cancel')
}));
