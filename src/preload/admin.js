import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('admin', {
  getConfig: () => ipcRenderer.invoke('admin:get-config'),
  getBootInfo: () => ipcRenderer.invoke('admin:get-boot-info'),
  verifyPin: (pin) => ipcRenderer.invoke('admin:verify-pin', { pin }),
  set: (key, value) => ipcRenderer.invoke('admin:set', { key, value }),
  getActivityLog: () => ipcRenderer.invoke('admin:get-activity-log'),
  clearActivityLog: () => ipcRenderer.invoke('admin:clear-activity-log'),
  refreshWeather: () => ipcRenderer.invoke('admin:refresh-weather'),
  showLauncher: () => ipcRenderer.send('admin:show-launcher'),
  pickImage: () => ipcRenderer.invoke('admin:pick-image'),
  pickFolder: () => ipcRenderer.invoke('admin:pick-folder'),
  pickApp: () => ipcRenderer.invoke('admin:pick-app'),
  getLocalPhotos: () => ipcRenderer.invoke('admin:get-local-photos'),
  getPhotoThumbnail: (path) => ipcRenderer.invoke('admin:get-photo-thumbnail', { path }),

  getMessengerInfo: () => ipcRenderer.invoke('admin:get-messenger-info'),
  testHelpAlert: () => ipcRenderer.invoke('admin:test-help-alert'),
  generateDigest: () => ipcRenderer.invoke('admin:generate-digest'),
  getConfigHistory: () => ipcRenderer.invoke('config:getHistory'),
  restoreConfig: (index) => ipcRenderer.invoke('config:restore', index),

  onHelpAlert: (cb) => ipcRenderer.on('admin:help-alert', () => cb()),
  onAlert: (cb) => ipcRenderer.on('admin:alert', (_, data) => cb(data)),
  onConfigUpdated: (cb) => ipcRenderer.on('config:updated', () => cb()),

  // TV Remote
  tvGetStatus: () => ipcRenderer.invoke('admin:tv-get-status'),
  tvDiscover: () => ipcRenderer.invoke('admin:tv-discover'),
  tvStartPairing: (ip, name, model) => ipcRenderer.invoke('admin:tv-start-pairing', { ip, name, model }),
  tvCompletePairing: (pin) => ipcRenderer.invoke('admin:tv-complete-pairing', { pin }),
  tvClearPairing: () => ipcRenderer.invoke('admin:tv-clear-pairing'),
  tvPowerOn: () => ipcRenderer.invoke('admin:tv-power-on'),
  tvPowerOff: () => ipcRenderer.invoke('admin:tv-power-off'),
  tvVolumeUp: () => ipcRenderer.invoke('admin:tv-volume-up'),
  tvVolumeDown: () => ipcRenderer.invoke('admin:tv-volume-down'),
  tvMute: () => ipcRenderer.invoke('admin:tv-mute'),
})
