import Store from 'electron-store'
import { existsSync } from 'fs'

const defaults = {
  tiles: [
    { id: 'news',      type: 'web',      icon: '📰',  label: 'News',     target: 'https://apnews.com',            kiosk: false },
    { id: 'pinterest', type: 'web',      icon: '📌',  label: 'Pinterest', target: 'https://pinterest.com',        kiosk: false },
    { id: 'youtube',   type: 'web',      icon: '▶️',  label: 'YouTube',  target: 'https://www.youtube.com',       kiosk: false },
    { id: 'bermuda-news', type: 'web',   icon: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxMDAgMTAwIj4KICA8Y2lyY2xlIGN4PSI1MCIgY3k9IjUwIiByPSI0OCIgZmlsbD0iIzJFODZBQiIvPgogIDxwYXRoIGQ9IgogICAgTSAzMCAyOAogICAgQyA0MCAyNCwgNTUgMjYsIDYyIDMyCiAgICBDIDY4IDM3LCA3MCA0NCwgNjYgNDkKICAgIEMgNzQgNTIsIDgwIDU4LCA3OCA2NAogICAgQyA3NiA3MCwgNjggNzIsIDYwIDcwCiAgICBDIDUyIDY4LCA0OCA2MiwgNTAgNTYKICAgIEMgNDQgNjAsIDM2IDYyLCAzMCA1OAogICAgQyAyNCA1NCwgMjQgNDYsIDMwIDQyCiAgICBDIDI0IDQwLCAyMCAzNCwgMjQgMzAKICAgIEMgMjYgMjcsIDI4IDI3LCAzMCAyOAogICAgWiIKICAgIGZpbGw9IiM0Q0FGNTAiIHN0cm9rZT0iIzJFN0QzMiIgc3Ryb2tlLXdpZHRoPSIxLjUiLz4KPC9zdmc+Cg==', label: 'Bermuda News', target: 'https://www.royalgazette.com/', kiosk: false },
    { id: 'photos',    type: 'built-in', icon: '🖼️',  label: 'Photos',   target: 'photos' },
    { id: 'games',     type: 'built-in', icon: '🎮',  label: 'Games',    target: 'games' },
    { id: 'weather',   type: 'built-in', icon: '🌤️', label: 'Weather',  target: 'weather' },
    { id: 'messages',  type: 'built-in', icon: '💬',  label: 'Messages', target: 'messages' },
    { id: 'music',     type: 'built-in', icon: '🎵',  label: 'Music',    target: 'music' },
    { id: 'whos-home', type: 'built-in', icon: '🏡',  label: "Who's Home?", target: 'whoshome' }
  ],
  reminders: [],
  contacts: [],
  dailyNote: '',
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
    volumeLevel: 40,       // 0–100; enforced by PowerShell every 30s
    ambientBackground: true // calm dot-matrix field on the home screen
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
  ai: {
    anthropicKey: '',
    model: 'claude-haiku-4-5',
    buddyHistory: []
  },
  photos: {
    albumUrl: '',
    localPath: '',
    captions: {}
  },
  familyRadio: {
    enabled: true
  },
  whosHome: {
    enabled: true,
    gateway: '',
    people: []
  },
  userName: 'Grandma',
  setupCompleted: false,
  activityLog: [],
  remoteConfig: {
    url: 'https://chat.jeankellmansmith.com/config.json',
    lastSyncedAt: null
  },
  configHistory: [],
  migrations: {}    // one-time migration flags keyed by migration name
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

// Auto-populate local games from known installed game executables if list is empty
{
  const existingGames = store.get('games.localGames')
  if (!existingGames || existingGames.length === 0) {
    const candidates = [
      { name: 'Bejeweled 2',              icon: '💎', path: 'C:\\Program Files (x86)\\Popcap Game Collection\\Bejeweled 2 Deluxe\\Bejeweled2.exe' },
      { name: 'Bejeweled',                icon: '💎', path: 'C:\\Program Files (x86)\\Popcap Game Collection\\Bejeweled Deluxe\\Bejeweled.exe' },
      { name: 'Bejeweled Twist',          icon: '🌀', path: 'C:\\Program Files (x86)\\Popcap Game Collection\\Bejeweled Twist\\BejeweledTwist.exe' },
      { name: 'Bookworm',                 icon: '📚', path: 'C:\\Program Files (x86)\\Popcap Game Collection\\Bookworm Deluxe\\Bookworm.exe' },
      { name: 'Chuzzle',                  icon: '🐾', path: 'C:\\Program Files (x86)\\Popcap Game Collection\\Chuzzle Deluxe\\Chuzzle.exe' },
      { name: 'Mahjong — Ancient China',  icon: '🀄', path: 'C:\\Program Files (x86)\\Popcap Game Collection\\Mahjong Escape Ancient China\\MahjongEscapeAC.exe' },
      { name: 'Mahjong — Ancient Japan',  icon: '🏯', path: 'C:\\Program Files (x86)\\Popcap Game Collection\\Mahjong Escape Ancient Japan\\MahjongEscapeAJ.exe' },
      { name: 'NingPo MahJong',           icon: '🀄', path: 'C:\\Program Files (x86)\\Popcap Game Collection\\NingPo MahJong Deluxe\\Ningpo.exe' },
      { name: 'Peggle',                   icon: '🎯', path: 'C:\\Program Files (x86)\\Popcap Game Collection\\Peggle Deluxe\\Peggle.exe' },
      { name: 'Peggle Nights',            icon: '🌙', path: 'C:\\Program Files (x86)\\Popcap Game Collection\\Peggle Nights Deluxe\\PeggleNights.exe' },
      { name: 'Zuma',                     icon: '🐸', path: 'C:\\Program Files (x86)\\Popcap Game Collection\\Zuma Deluxe\\Zuma.exe' },
      { name: "Zuma's Revenge",           icon: '🐸', path: "C:\\Program Files (x86)\\PopCap Games\\Zuma's Revenge\\ZumasRevenge.exe" },
      { name: 'Insaniquarium',            icon: '🐠', path: 'C:\\Program Files (x86)\\Popcap Game Collection\\Insaniquarium Deluxe\\Insaniquarium.exe' },
      { name: 'Mystery PI',               icon: '🔍', path: 'C:\\Program Files (x86)\\Popcap Game Collection\\Mystery PI - The Lottery Ticket\\MysteryPI.exe' },
      { name: 'Mystery PI — New York',    icon: '🗽', path: 'C:\\Program Files (x86)\\Popcap Game Collection\\Mystery PI - The New York Fortune\\MysteryPINewYork.exe' },
      { name: 'Luxor',                    icon: '🏛️', path: 'C:\\Program Files (x86)\\MumboJumbo\\LUXOR\\Luxor.exe' },
      { name: 'Luxor 2',                  icon: '🏺', path: 'C:\\Program Files (x86)\\MumboJumbo\\LUXOR 2\\luxor2.exe' },
      { name: 'Luxor Mahjong',            icon: '🀄', path: 'C:\\Program Files (x86)\\MumboJumbo\\LUXOR - Mah Jong\\Luxor Mahjong.exe' },
      { name: 'Treasures of Montezuma',   icon: '🪙', path: 'C:\\Program Files (x86)\\GameFools\\The Treasures of Montezuma\\GAMEFOOLS-TheTreasuresofMontezuma.exe' },
    ]
    const available = candidates.filter(g => existsSync(g.path))
    if (available.length > 0) {
      store.set('games.localGames', available)
    }
  }
}

// One-time migration: add AI helper tile (skipped on subsequent launches so caregivers can remove it)
if (!store.get('migrations.aiTileAdded')) {
  const currentTiles = store.get('tiles')
  if (!currentTiles.find(t => t.id === 'ai-helper')) {
    store.set('tiles', [...currentTiles, { id: 'ai-helper', type: 'built-in', icon: '🤖', label: 'Ask AI', target: 'ai-helper' }])
  }
  store.set('migrations.aiTileAdded', true)
}

// One-time migration: Buddy now lives in the sidebar as the cat — remove the
// legacy 🤖 "Ask AI" tile so the old robot chat can't come back.
if (!store.get('migrations.aiTileRemoved')) {
  const currentTiles = store.get('tiles')
  const filtered = currentTiles.filter(t => t.id !== 'ai-helper' && t.target !== 'ai-helper')
  if (filtered.length !== currentTiles.length) {
    store.set('tiles', filtered)
  }
  store.set('migrations.aiTileRemoved', true)
}

// One-time migration: add the "Who's Home?" tile (skipped once caregivers
// have had a chance to remove it).
if (!store.get('migrations.whosHomeTileAdded')) {
  const currentTiles = store.get('tiles') || []
  if (!currentTiles.some(t => t.target === 'whoshome')) {
    store.set('tiles', [...currentTiles, { id: 'whos-home', type: 'built-in', icon: '🏡', label: "Who's Home?", target: 'whoshome' }])
  }
  store.set('migrations.whosHomeTileAdded', true)
}

// Give every saved presence entry a stable identity. Older builds stored only
// { name, device }, which made every row look identical to the settings UI
// after a restart (editing or deleting one row could affect all of them).
{
  const whosHome = store.get('whosHome') || {}
  const people = Array.isArray(whosHome.people) ? whosHome.people : []
  const seen = new Set()
  let changed = false
  const identified = people.map(person => {
    let id = typeof person.id === 'string' && person.id.trim() ? person.id : ''
    if (!id || seen.has(id)) {
      id = crypto.randomUUID()
      changed = true
    }
    seen.add(id)
    return { ...person, id }
  })
  if (changed) store.set('whosHome.people', identified)
}

// Migrate the OpenRouter-era key field into the Claude key field the backend
// actually reads (ipc.js -> claudeKey() reads ai.anthropicKey). Older builds
// saved the entered key to ai.openrouterKey, which was silently ignored.
if (store.get('ai.openrouterKey') && !store.get('ai.anthropicKey')) {
  store.set('ai.anthropicKey', store.get('ai.openrouterKey'))
}
store.delete('ai.openrouterKey')

// Purge stale OpenRouter model slugs that were never valid ids on OpenRouter
// (e.g. google/gemini-2.0-flash-001 is a Google AI Studio name, not an
// OpenRouter slug). A stored bogus value overrides the verified free default
// in ipc.js and every chat call fails with "No endpoints found". If the
// stored model is not on the known-bad list, it's left alone — caregivers
// may have set a real one deliberately.
const KNOWN_BAD_MODELS = [
  'google/gemini-2.0-flash-001',
  'anthropic/claude-haiku-4-5-20251001',
  'openrouter/owl-alpha',
  'poolside/laguna-m.1:free',
]
if (KNOWN_BAD_MODELS.includes(store.get('ai.model'))) {
  store.delete('ai.model')
}

// Family Radio ambient stream can be turned off by the caregiver. Default on
// (setting !== false) so a missing/legacy config still surfaces clips — matches
// the renderer's `config.familyRadio?.enabled !== false` check. Read live so the
// embedded server honours a toggle without a restart.
export function isFamilyRadioEnabled() {
  return store.get('familyRadio.enabled') !== false
}

export function logActivity(type, detail = '') {
  const log = store.get('activityLog')
  log.push({ type, detail, ts: Date.now() })
  // Keep last 1000 entries
  if (log.length > 1000) log.splice(0, log.length - 1000)
  store.set('activityLog', log)
}
