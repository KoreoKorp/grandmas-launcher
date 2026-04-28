import Store from 'electron-store'

const defaults = {
  tiles: [
    { id: 'news',      type: 'web',      icon: '📰',  label: 'News',     target: 'https://apnews.com',            kiosk: false },
    { id: 'pinterest', type: 'web',      icon: '📌',  label: 'Pinterest', target: 'https://pinterest.com',        kiosk: false },
    { id: 'youtube',   type: 'web',      icon: '▶️',  label: 'YouTube',  target: 'https://www.youtube.com',       kiosk: false },
    { id: 'photos',    type: 'web',      icon: '🖼️',  label: 'Photos',   target: 'https://photos.google.com',    kiosk: false },
    { id: 'games',     type: 'web',      icon: '🎮',  label: 'Games',    target: 'https://www.pogo.com',          kiosk: false },
    { id: 'weather',   type: 'built-in', icon: '🌤️', label: 'Weather',  target: 'weather' },
    { id: 'messages',  type: 'built-in', icon: '💬',  label: 'Messages', target: 'messages' },
    { id: 'music',     type: 'built-in', icon: '🎵',  label: 'Music',    target: 'music' }
  ],
  reminders: [],
  contacts: [],
  dailyNote: '',
  adminPin: '',
  weather: {
    location: '',
    unit: 'F',
    cached: null,
    cachedAt: null
  },
  display: {
    launcherDisplay: 0,
    adminDisplay: 1,
    fontScale: 'medium',
    volumeLevel: 40        // 0–100; enforced by PowerShell every 30s
  },
  confusion: {
    inactivityMinutes: 10,
    rapidTapCount: 15,
    rapidTapWindowMs: 3000,
    inactivityEnabled: true,
    rapidTapEnabled: true
  },
  help: {
    caregiverName: 'Family',
    contactMethod: 'notification'
  },
  messenger: {
    url: 'https://jeankellmansmith.com',
    adminPassword: '',
    webrtc: {
      iceServers: [
        { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] }
      ],
      turnUrl: '',
      turnUsername: '',
      turnCredential: ''
    }
  },
  userName: 'Grandma',
  activityLog: [],
  remoteConfig: {
    url: 'https://jeankellmansmith.com/config.json',
    lastSyncedAt: null
  },
  configHistory: []
}

export const store = new Store({ defaults })

export function saveBackup() {
  const history = store.get('configHistory') || []
  const currentState = store.store
  
  // Clone state, stripping out large dynamic logs/history arrays so we only back up true config
  const stateToSave = { ...currentState }
  delete stateToSave.configHistory
  delete stateToSave.activityLog

  history.unshift({ ts: Date.now(), state: stateToSave })
  if (history.length > 5) history.length = 5 // Keep rolling last 5
  store.set('configHistory', history)
}

export function restoreBackup(index) {
  const history = store.get('configHistory') || []
  if (history[index]) {
    const state = history[index].state
    for (const key in state) {
      store.set(key, state[key])
    }
    logActivity('config-restored', `Restored backup index ${index}`)
    return true
  }
  return false
}

// Stable device identity for socket.io registration
if (!store.get('deviceId')) {
  store.set('deviceId', crypto.randomUUID())
}
// Shared secret for call authentication (server must validate both)
if (!store.get('authToken')) {
  store.set('authToken', crypto.randomUUID())
}

// Migrate old hardcoded messenger IP to new domain for existing installs
const OLD_MESSENGER_URL = 'http://34.132.145.35:3000/jean.html'
if (store.get('messenger.url') === OLD_MESSENGER_URL) {
  store.set('messenger.url', 'https://jeankellmansmith.com')
}

export function logActivity(type, detail = '') {
  const log = store.get('activityLog')
  log.push({ type, detail, ts: Date.now() })
  // Keep last 1000 entries
  if (log.length > 1000) log.splice(0, log.length - 1000)
  store.set('activityLog', log)
}
