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
  getMusic: () => ipcRenderer.invoke('launcher:get-music'),
  getLocalGames: () => ipcRenderer.invoke('launcher:get-local-games'),
  getLocalPhotos: () => ipcRenderer.invoke('launcher:get-local-photos'),
  getPhotoThumbnail: (path) => ipcRenderer.invoke('launcher:get-photo-thumbnail', { path }),
  askAI: (message) => ipcRenderer.invoke('launcher:ask-ai', { message }),
  clearAIHistory: () => ipcRenderer.invoke('launcher:clear-ai-history'),
  getAIHistory: () => ipcRenderer.invoke('launcher:get-ai-history'),
  getGameIcon: (path) => ipcRenderer.invoke('launcher:get-game-icon', { path }),
  getFamilyRadioQueue: () => ipcRenderer.invoke('launcher:get-family-radio-queue'),
  markFamilyRadioPlayed: (id) => ipcRenderer.invoke('launcher:mark-family-radio-played', { id }),

  // TV Remote
  tvGetStatus: () => ipcRenderer.invoke('launcher:tv-get-status'),
  tvDiscover: () => ipcRenderer.invoke('launcher:tv-discover'),
  tvStartPairing: (ip) => ipcRenderer.invoke('launcher:tv-start-pairing', { ip }),
  tvCompletePairing: (pin) => ipcRenderer.invoke('launcher:tv-complete-pairing', { pin }),
  tvPowerOn: () => ipcRenderer.invoke('launcher:tv-power-on'),
  tvPowerOff: () => ipcRenderer.invoke('launcher:tv-power-off'),
  tvVolumeUp: () => ipcRenderer.invoke('launcher:tv-volume-up'),
  tvVolumeDown: () => ipcRenderer.invoke('launcher:tv-volume-down'),
  tvMute: () => ipcRenderer.invoke('launcher:tv-mute'),
  tvChannelUp: () => ipcRenderer.invoke('launcher:tv-channel-up'),
  tvChannelDown: () => ipcRenderer.invoke('launcher:tv-channel-down'),
  tvSetInput: (input) => ipcRenderer.invoke('launcher:tv-set-input', { input }),
  tvLaunchApp: (app) => ipcRenderer.invoke('launcher:tv-launch-app', { app }),
  tvGetInput: () => ipcRenderer.invoke('launcher:tv-get-input'),
  tvGetPower: () => ipcRenderer.invoke('launcher:tv-get-power'),
  tvClearPairing: () => ipcRenderer.invoke('launcher:tv-clear-pairing'),

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
  },
  onInactivityTimeout: (cb) => {
    const h = () => cb()
    ipcRenderer.on('launcher:inactivity-timeout', h)
    return () => ipcRenderer.removeListener('launcher:inactivity-timeout', h)
  },
  onNetworkStatus: (cb) => {
    const h = (_, data) => cb(data)
    ipcRenderer.on('launcher:network-status', h)
    return () => ipcRenderer.removeListener('launcher:network-status', h)
  },
  onBrowserLoaded: (cb) => {
    const h = () => cb()
    ipcRenderer.on('launcher:browser-loaded', h)
    return () => ipcRenderer.removeListener('launcher:browser-loaded', h)
  },
  onFamilyRadioNew: (cb) => {
    const h = (_, data) => cb(data)
    ipcRenderer.on('launcher:family-radio-new', h)
    return () => ipcRenderer.removeListener('launcher:family-radio-new', h)
  },

  // WebRTC signaling relay
  sendAnswer: (to, answer) => ipcRenderer.send('launcher:call-answer', { to, answer }),
  sendIceCandidate: (to, candidate) => ipcRenderer.send('launcher:ice-candidate', { to, candidate }),
  endCall: (to) => ipcRenderer.send('launcher:end-call', { to }),
  declineCall: (to) => ipcRenderer.send('launcher:decline-call', { to }),

  onIncomingCall: (cb) => {
    const h = (_, data) => cb(data)
    ipcRenderer.on('launcher:incoming-call', h)
    return () => ipcRenderer.removeListener('launcher:incoming-call', h)
  },
  onIceCandidate: (cb) => {
    const h = (_, data) => cb(data)
    ipcRenderer.on('launcher:ice-candidate', h)
    return () => ipcRenderer.removeListener('launcher:ice-candidate', h)
  },
  onCallEnded: (cb) => {
    const h = (_, data) => cb(data)
    ipcRenderer.on('launcher:call-ended', h)
    return () => ipcRenderer.removeListener('launcher:call-ended', h)
  }
})
