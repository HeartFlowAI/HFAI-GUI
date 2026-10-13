const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('brick', {
  action: (action, value) => ipcRenderer.invoke('brick-action', { action, value }),
  onEvent: callback => ipcRenderer.on('brick-event', (_event, value) => callback(value))
});
