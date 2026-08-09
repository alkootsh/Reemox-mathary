const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  isElectron: true,
  platform: process.platform,
  getHardwareUUID: () => ipcRenderer.invoke('get-hardware-uuid'),
  printThermalReceipt: (html) => ipcRenderer.invoke('print-thermal-receipt', html)
});
