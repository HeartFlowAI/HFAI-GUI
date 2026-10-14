const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('walletWindow', {
  load: () => ipcRenderer.invoke('walletwin-load'),
  refresh: () => ipcRenderer.invoke('walletwin-refresh'),
  search: query => ipcRenderer.invoke('walletwin-search', query),
  series: mint => ipcRenderer.invoke('walletwin-series', mint),
  onEvent: callback => {
    const handler = (_, event) => callback(event);
    ipcRenderer.on('event', handler);
    return () => ipcRenderer.removeListener('event', handler);
  }
});
