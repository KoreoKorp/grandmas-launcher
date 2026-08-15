import Store from 'electron-store'
import { existsSync } from 'fs'
import { safeStorage } from 'electron'

const defaults = {
  tiles: [
    { id: 'news',      type: 'web',      icon: '📰',  label: 'News',     target: 'https://apnews.com',            kiosk: false },
    { id: 'pinterest', type: 'web',      icon: '📌',  label: 'Pinterest', target: 'https://pinterest.com',        kiosk: false },
    { id: 'youtube',   type: 'web',      icon: '▶️',  label: 'YouTube',  target: 'https://www.youtube.com',       kiosk: false },
    { id: 'bermuda-news', type: 'web',   icon: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxMDAgMTAwIj4KICA8Y2lyY2xlIGN4PSI1MCIgY3k9IjUwIiByPSI0OCIgZmlsbD0iIzJFODZBQiIvPgogIDxwYXRoIGQ9IgogICAgTSAzMCAyOAogICAgQyA0MCAyNCwgNTUgMjYsIDYyIDMyCiAgICBDIDY4IDM3LCA3MCA0NCwgNjYgNDkKICAgIEMgNzQgNTIsIDgwIDU4LCA3OCA2NAogICAgQyA3NiA3MCwgNjggNzIsIDYwIDcwCiAgICBDIDUyIDY4LCA0OCA2MiwgNTAgNTYKICAgIEMgNDQgNjAsIDM2IDYyLCAzMCA1OAogICAgQyAyNCA1NCwgMjQgNDYsIDMwIDQyCiAgICBDIDI0IDQwLCAyMCAzNCwgMjQgMzAKICAgIEMgMjYgMjcsIDI4IDI3LCAzMCAyOAogICAgWiIKICAgIGZpbGw9IiM0Q0FGNTAiIHN0cm9rZT0iIzJFN0QzMiIgc3Ryb2tlLXdpZHRoPSIxLjUiLz4KPC9zdmc+Cg==', label: 'Bermuda News', target: 'https://www.royalgazette.com/', kiosk: false },
    { id: 'sixty-and-me', type: 'web',   icon: '🌸',  label: 'Sixty and Me', target: 'https://sixtyandme.com/', kiosk: false },
    { id: 'mental-floss', type: 'web',   icon: '🧠',  label: 'Mental Floss', target: 'https://www.mentalfloss.com/', kiosk: false },
    { id: 'photos',    type: 'built-in', icon: '🖼️',  label: 'Photos',   target: 'photos' },
    { id: 'games',     type: 'built-in', icon: '🎮',  label: 'Games',    target: 'games' },
    { id: 'weather',   type: 'built-in', icon: '🌤️', label: 'Weather',  target: 'weather' },
    { id: 'ai-helper', type: 'built-in', icon: '🤖',  label: 'Ask AI',   target: 'ai-helper' },
     { id: 'messages',  type: 'built-in', icon: '💬',  label: 'Messages', target: 'messages' },
     { id: 'music',     type: 'built-in', icon: '🎵',  label: 'Music',    target: 'music' },
     { id: 'tv',        type: 'built-in', icon: '📺',  label: 'TV Remote', target: 'tv' }
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
    openrouterKey: '',
    model: 'google/gemini-2.0-flash-001',
    buddyHistory: []
  },
  photos: {
    albumUrl: '',
    localPath: '',
    captions: {}   // filename → caption, e.g. "Sarah — your daughter — Bermuda, 2019"
  },
  familyRadio: {
    enabled: true
  },
  tv: {
    ip: '',
    token: '',
    name: '',
    model: '',
    enabled: true,
    lastConnected: null,
    lastError: null
  },
  userName: 'Grandma',
  activityLog: [],
  remoteConfig: {
    url: 'https://chat.jeankellmansmith.com/config.json',
    lastSyncedAt: null
  },
  configHistory: [],
  migrations: {}    // one-time migration flags keyed by migration name
}

export const store = new Store({ defaults })

// admin:set (ipc.js) accepts a free-form { key, value } pair — reachable not
// just from the admin UI's own hardcoded save() calls but also from
// CaregiverHandoff's import flow, which writes every top-level key found in
// an imported JSON file. That file can come from another machine or another
// person, so nothing about its shape is trusted; without this, a crafted or
// corrupted handoff file could inject arbitrary keys into the store (e.g. a
// bogus remoteConfig.url, or clobbering the internal activityLog/
// configHistory/deviceId/authToken that no legitimate save ever targets).
// This restricts writes to the actual configurable top-level settings.
const SETTABLE_TOP_LEVEL_KEYS = new Set(
  Object.keys(defaults).filter(k => k !== 'activityLog' && k !== 'configHistory')
)

export function isSettableKey(key) {
  return SETTABLE_TOP_LEVEL_KEYS.has(String(key).split('.')[0])
}

// ── Secrets at rest ──────────────────────────────────────────────────────
// electron-store persists to a plain JSON file — by default every credential
// (admin password, Jean's PIN, Twilio token, TURN credential, OpenRouter key,
// per-contact PINs) sat there in clear text, readable by anything with disk
// access to this machine. safeStorage encrypts with the OS keychain (DPAPI
// on Windows), so the ciphertext is only decryptable under the same Windows
// user account it was encrypted under — fine for this app's one-kiosk-PC
// model, but means a copied store.json (or a config backup restored onto a
// different Windows profile) won't decrypt there.
//
// Encrypted values are stored as `enc1:<base64>` so already-encrypted values
// are recognizable (and left alone — encryptSecret no-ops on that prefix,
// making the startup migration below idempotent) and distinguishable from
// legacy plaintext left over from before this existed.
const SECRET_PREFIX = 'enc1:'

function encryptSecret(plain) {
  if (!plain || typeof plain !== 'string') return plain
  if (plain.startsWith(SECRET_PREFIX)) return plain
  if (!safeStorage.isEncryptionAvailable()) return plain // no OS keychain — fall back to plaintext rather than crash
  return SECRET_PREFIX + safeStorage.encryptString(plain).toString('base64')
}

function decryptSecret(value) {
  if (!value || typeof value !== 'string') return value
  if (!value.startsWith(SECRET_PREFIX)) return value // legacy plaintext, or encryption was unavailable when saved
  try {
    return safeStorage.decryptString(Buffer.from(value.slice(SECRET_PREFIX.length), 'base64'))
  } catch (err) {
    // Most likely: this blob was encrypted under a different Windows user
    // account (profile recreated, store.json copied to another machine).
    // Fail closed — an empty credential just fails auth, which is safe;
    // throwing would crash whatever screen tried to read it.
    console.error('[store] failed to decrypt a secret:', err.message)
    return ''
  }
}

// Dot-paths holding sensitive values. Deliberately excludes things that
// aren't really secret even though they live next to secrets (phone
// numbers, the Discord webhook URL, the Twilio account SID/from-number,
// TURN username) — those stay in plain JSON.
const SECRET_PATHS = [
  'adminPin',
  'authToken',
  'messenger.adminPassword',
  'messenger.jeanPin',
  'messenger.twilioAuthToken',
  'messenger.webrtc.turnCredential',
  'ai.openrouterKey'
]

export function getSecret(path) {
  return decryptSecret(store.get(path))
}

// For call sites that already have an object containing a secret field from
// a bulk store.get() (e.g. `store.get('messenger').webrtc.turnCredential`)
// and would otherwise need a redundant second store.get() through getSecret.
export { decryptSecret }

export function setSecret(path, value) {
  store.set(path, encryptSecret(value))
}

// Given a whole value about to be written under `key` via the generic
// admin:set handler, encrypt whichever of its fields are secret paths
// relative to that key. Values arrive here as fresh plaintext straight from
// an admin-panel input, so this is the only place that needs to apply
// encryptSecret when writing — reads are decrypted individually via
// getSecret/decryptSecret at their call sites instead.
export function encryptSecretsForKey(key, value) {
  if (key === 'messenger' && value && typeof value === 'object') {
    return {
      ...value,
      adminPassword: encryptSecret(value.adminPassword),
      jeanPin: encryptSecret(value.jeanPin),
      twilioAuthToken: encryptSecret(value.twilioAuthToken),
      webrtc: value.webrtc ? { ...value.webrtc, turnCredential: encryptSecret(value.webrtc.turnCredential) } : value.webrtc
    }
  }
  if (key === 'adminPin' || key === 'ai.openrouterKey') {
    return encryptSecret(value)
  }
  if (key === 'contacts' && Array.isArray(value)) {
    return value.map(c => ({ ...c, pin: encryptSecret(c.pin), messengerPin: encryptSecret(c.messengerPin) }))
  }
  return value
}

// Decrypted copy of the full store, for admin:get-config — the admin panel
// pre-fills editable inputs (Twilio/TURN fields, etc.) directly from this,
// so it needs real values back, not ciphertext. Only the on-disk JSON stays
// encrypted; the trusted admin renderer sees plaintext same as before.
export function getDecryptedStore() {
  const raw = store.store
  return {
    ...raw,
    adminPin: decryptSecret(raw.adminPin),
    authToken: decryptSecret(raw.authToken),
    messenger: raw.messenger ? {
      ...raw.messenger,
      adminPassword: decryptSecret(raw.messenger.adminPassword),
      jeanPin: decryptSecret(raw.messenger.jeanPin),
      twilioAuthToken: decryptSecret(raw.messenger.twilioAuthToken),
      webrtc: raw.messenger.webrtc ? { ...raw.messenger.webrtc, turnCredential: decryptSecret(raw.messenger.webrtc.turnCredential) } : raw.messenger.webrtc
    } : raw.messenger,
    ai: raw.ai ? { ...raw.ai, openrouterKey: decryptSecret(raw.ai.openrouterKey) } : raw.ai,
    contacts: (raw.contacts || []).map(c => ({ ...c, pin: decryptSecret(c.pin), messengerPin: decryptSecret(c.messengerPin) }))
  }
}

// One-time-per-launch migration: re-encrypt any secret still sitting in
// plaintext from before this existed. Idempotent — encryptSecret no-ops on
// values already carrying the enc1: prefix — so this is safe to run on
// every startup rather than needing its own migration flag.
//
// This must NOT run at module-load time: safeStorage.encryptString/
// decryptString are only safe to call after Electron's `app` has emitted
// `ready` (calling earlier can throw or silently misbehave depending on
// platform). Everything else in this file that runs at module load only
// touches plain electron-store values, so it's unaffected — only this
// function is deferred, and only this function may call encryptSecret/
// decryptSecret before this runs. index.js calls this as the first thing
// inside app.whenReady(), before initMessengerServer() (which needs
// getSecret() to already return real decrypted/migrated values).
export function migrateSecretsAtRest() {
  for (const path of SECRET_PATHS) {
    const raw = store.get(path)
    if (raw && typeof raw === 'string' && !raw.startsWith(SECRET_PREFIX)) {
      store.set(path, encryptSecret(raw))
    }
  }
  const contacts = store.get('contacts') || []
  let changed = false
  const migrated = contacts.map(c => {
    const pinNeedsEnc = c.pin && !String(c.pin).startsWith(SECRET_PREFIX)
    const msgPinNeedsEnc = c.messengerPin && !String(c.messengerPin).startsWith(SECRET_PREFIX)
    if (!pinNeedsEnc && !msgPinNeedsEnc) return c
    changed = true
    return {
      ...c,
      pin: pinNeedsEnc ? encryptSecret(c.pin) : c.pin,
      messengerPin: msgPinNeedsEnc ? encryptSecret(c.messengerPin) : c.messengerPin
    }
  })
  if (changed) store.set('contacts', migrated)
  // authToken is created here (not at module load) for the same reason —
  // it's the one other safeStorage-touching write outside this function.
  if (!store.get('authToken')) {
    setSecret('authToken', crypto.randomUUID())
  }
}

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
      // Backups only ever come from this app's own saveBackup() snapshots,
      // so this isn't reachable with untrusted data today — but skip
      // anything outside the known settings anyway rather than assume that
      // stays true forever.
      if (!isSettableKey(key)) continue
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
// authToken (shared secret for call authentication) is created inside
// migrateSecretsAtRest() instead of here — see that function's comment for why.

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

// Ensure photos.captions exists on installs that predate the captions
// feature — electron-store only fills in top-level default keys that are
// entirely missing, not new sub-keys added to an existing nested object.
if (!store.get('photos.captions')) {
  store.set('photos.captions', {})
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

// Insert a tile just before the first built-in tile (Photos) so tiles migrated
// onto existing installs land in the same spot as on fresh installs, instead of
// being appended after everything. Falls back to appending if Photos is gone.
function insertTileBeforePhotos(tiles, tile) {
  const idx = tiles.findIndex(t => t.id === 'photos')
  return idx === -1
    ? [...tiles, tile]
    : [...tiles.slice(0, idx), tile, ...tiles.slice(idx)]
}

// One-time migrations: add web tiles that shipped after the initial defaults to
// existing installs (defaults only cover fresh installs). Each is skipped on
// subsequent launches so a caregiver can remove the tile without it reappearing.
// Tile definitions are sourced from `defaults.tiles` to avoid duplication.
// Bermuda News runs before Sixty and Me so their relative order matches defaults.
for (const [tileId, migrationFlag] of [
  ['ai-helper',     'aiTileAdded'],
  ['bermuda-news',  'bermudaNewsTileAdded'],
  ['sixty-and-me',  'sixtyAndMeTileAdded'],
  ['mental-floss',  'mentalFlossTileAdded'],
  ['tv',            'tvTileAdded']
]) {
  if (store.get(`migrations.${migrationFlag}`)) continue
  const currentTiles = store.get('tiles')
  if (!currentTiles.find(t => t.id === tileId)) {
    const tile = defaults.tiles.find(t => t.id === tileId)
    if (tile) store.set('tiles', insertTileBeforePhotos(currentTiles, { ...tile }))
  }
  store.set(`migrations.${migrationFlag}`, true)
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
