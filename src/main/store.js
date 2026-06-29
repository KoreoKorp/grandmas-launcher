import Store from 'electron-store'

const defaults = {
  tiles: [
    { id: 'news',      type: 'web',      icon: '📰',  label: 'News',     target: 'https://apnews.com',            kiosk: false },
    { id: 'pinterest', type: 'web',      icon: '📌',  label: 'Pinterest', target: 'https://pinterest.com',        kiosk: false },
    { id: 'youtube',   type: 'web',      icon: '▶️',  label: 'YouTube',  target: 'https://www.youtube.com',       kiosk: false },
    { id: 'photos',    type: 'built-in', icon: '🖼️',  label: 'Photos',   target: 'photos' },
    { id: 'games',     type: 'built-in', icon: '🎮',  label: 'Games',    target: 'games' },
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
    port:             3456,
    jeanPin:          '',
    adminPassword:    '',
    discordWebhookUrl: '',
    twilioAccountSid: '',
    twilioAuthToken:  '',
    twilioFrom:       '',
    caregiverPhone:   '',
    webrtc: {
      iceServers: [
        { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] }
      ],
      turnUrl:        '',
      turnUsername:   '',
      turnCredential: ''
    }
  },
  games: {
    localGames: [],
    onlineUrl: 'https://www.pogo.com'
  },
  photos: {
    albumUrl: '',
    localPath: ''
  },
  userName: 'Grandma',
  activityLog: [],
  remoteConfig: {
    url: 'https://chat.jeankellmansmith.com/config.json',
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

// Remove ghost tiles — web tiles saved with an empty target URL that survived
// earlier builds. electron-store persists across installs so these never
// self-heal without an explicit migration.
const tiles = store.get('tiles')
const cleanedTiles = tiles.filter(t => !(t.type === 'web' && !t.target))
if (cleanedTiles.length !== tiles.length) {
  store.set('tiles', cleanedTiles)
}

// Migrate photos and games tiles from web → built-in type on existing installs
{
  const migratedTiles = (store.get('tiles') ?? []).map(t => {
    if (t.id === 'photos' && t.type === 'web' && typeof t.target === 'string' && t.target.includes('photos.google.com')) {
      return { ...t, type: 'built-in', target: 'photos', kiosk: undefined }
    }
    if (t.id === 'games' && t.type === 'web') {
      const onlineUrl = t.target
      if (onlineUrl && !store.get('games.onlineUrl')) store.set('games.onlineUrl', onlineUrl)
      return { ...t, type: 'built-in', target: 'games', kiosk: undefined }
    }
    return t
  })
  store.set('tiles', migratedTiles)
}

// Migrate single-location weather config to multi-location array format.
// Keep the old `location` string so any callers that haven't been updated yet
// still work; the new `locations` array is the source of truth going forward.
const weather = store.get('weather')
if (!weather.locations) {
  const locations = weather.location
    ? [{ id: crypto.randomUUID(), name: weather.location }]
    : []
  store.set('weather.locations', locations)
}

export function logActivity(type, detail = '') {
  const log = store.get('activityLog')
  log.push({ type, detail, ts: Date.now() })
  // Keep last 1000 entries
  if (log.length > 1000) log.splice(0, log.length - 1000)
  store.set('activityLog', log)
}
