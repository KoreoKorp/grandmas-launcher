import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('admin', {
  getConfig: () => ipcRenderer.invoke('admin:get-config'),
  set: (key, value) => ipcRenderer.invoke('admin:set', { key, value }),
  getActivityLog: () => ipcRenderer.invoke('admin:get-activity-log'),
  clearActivityLog: () => ipcRenderer.invoke('admin:clear-activity-log'),
  refreshWeather: () => ipcRenderer.invoke('admin:refresh-weather'),
  showLauncher: () => ipcRenderer.send('admin:show-launcher'),

  onHelpAlert: (cb) => ipcRenderer.on('admin:help-alert', () => cb()),
  onAlert: (cb) => ipcRenderer.on('admin:alert', (_, data) => cb(data))
})
