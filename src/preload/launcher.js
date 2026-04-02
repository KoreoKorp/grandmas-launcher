import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('launcher', {
  getConfig: () => ipcRenderer.invoke('launcher:get-config'),
  getWeather: () => ipcRenderer.invoke('launcher:get-weather'),
  openUrl: (url, kiosk = false, partition = null) => ipcRenderer.send('launcher:open-url', { url, kiosk, partition }),
  closeBrowser: () => ipcRenderer.send('launcher:close-browser'),
  browserBack: () => ipcRenderer.send('launcher:browser-back'),
  setBrowserNavWidth: (px) => ipcRenderer.send('launcher:set-browser-nav-width', px),
  helpPressed: () => ipcRenderer.send('launcher:help-pressed'),
  sendHelpNotification: () => ipcRenderer.send('launcher:send-help-notification'),
  launchApp: (path) => ipcRenderer.invoke('launcher:launch-app', { path }),
  logActivity: (type, detail = '') => ipcRenderer.send('launcher:log-activity', { type, detail }),

  onWeatherUpdated: (cb) => {
    const h = (_, data) => cb(data)
    ipcRenderer.on('launcher:weather-updated', h)
    return () => ipcRenderer.removeListener('launcher:weather-updated', h)
  },
  onBrowserOpened: (cb) => {
    const h = (_, data) => cb(data)
    ipcRenderer.on('launcher:browser-opened', h)
    return () => ipcRenderer.removeListener('launcher:browser-opened', h)
  },
  onBrowserClosed: (cb) => {
    const h = () => cb()
    ipcRenderer.on('launcher:browser-closed', h)
    return () => ipcRenderer.removeListener('launcher:browser-closed', h)
  },
  onConfigUpdated: (cb) => {
    const h = (_, data) => cb(data)
    ipcRenderer.on('launcher:config-updated', h)
    return () => ipcRenderer.removeListener('launcher:config-updated', h)
  },
  onGoHome: (cb) => {
    const h = () => cb()
    ipcRenderer.on('launcher:go-home', h)
    return () => ipcRenderer.removeListener('launcher:go-home', h)
  }
})
