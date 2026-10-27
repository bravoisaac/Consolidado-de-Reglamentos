const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('folioPet', Object.freeze({
  action: action => ipcRenderer.invoke('folio-pet:action', action),
  expand: expanded => ipcRenderer.invoke('folio-pet:expand', expanded),
  onBusy: callback => ipcRenderer.on('folio-pet:busy', (_event, busy) => callback(busy === true))
}));
