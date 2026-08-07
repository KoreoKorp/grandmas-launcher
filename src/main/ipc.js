import { ipcMain, shell, BrowserView, dialog, app, nativeImage } from 'electron'
import { join, dirname, extname } from 'path'
import { readdir } from 'fs/promises'
import os from 'os'
import { store, logActivity, saveBackup, restoreBackup } from './store.js'
import { fetchWeather, clearWeatherCache } from './weather.js'
import { expandLauncher } from './windows.js'
import { getMessengerPort, getMessengerUrl, updateMessengerConfig, syncMessengerContacts } from './serverManager.js'
import { enableAdBlockingFor } from './adBlocker.js'

const PINTEREST_AD_CSS = `
  [data-test-id="ad-label"], [data-test-id*="promoted"], [data-test-id*="ad-pin"],
  [aria-label*="Promoted"], [aria-label*="Ads by"],
  div[data-test-id="ads-label"], .GrowthUnauthenticatedLandingView,
  .fullPageSignupModal, [data-test-id="header-signup"] { display: none !important; }
`

let launcherWin = null
let adminWin = null
let embeddedView = null // BrowserView for embedded websites

let browserViewInactivityTimer = null
let lastBrowserActivity = Date.now()

let _emitSignal = null
export function setSignalEmitter(fn) { _emitSignal = fn }
function emitSignal(event, data) { if (_emitSignal) _emitSignal(event, data) }

export function setWindows(launcher, admin) {
  launcherWin = launcher
  adminWin = admin
}

export function setEmbeddedView(view) {
  embeddedView = view
}

export function registerIPC() {
  // ── BrowserView activity heartbeat ────────────────────────────────────────
  ipcMain.on('browserView:activity', () => {
    lastBrowserActivity = Date.now()
  })

  // ── Launcher ──────────────────────────────────────────────────────────────

  ipcMain.handle('launcher:get-config', () => ({
    tiles: store.get('tiles'),
    reminders: store.get('reminders'),
    contacts: store.get('contacts'),
    dailyNote: store.get('dailyNote'),
    weather: store.get('weather'),
    display: store.get('display'),
    confusion: store.get('confusion'),
    help: store.get('help'),
    // Always hand the launcher the live embedded server URL (dynamic port),
    // not the stored config URL — otherwise the renderer points at the live
    // domain or a stale port and the in-house messenger never loads.
    messenger: { ...store.get('messenger'), url: getMessengerUrl() },
    games: store.get('games'),
    photos: store.get('photos'),
    familyRadio: store.get('familyRadio'),
    userName: store.get('userName'),
    ai: { available: !!(store.get('ai.openrouterKey') || process.env.OPENROUTER_API_KEY) }
  }))

  ipcMain.handle('launcher:get-weather', async () => {
    return await fetchWeather()
  })

  ipcMain.on('launcher:open-url', (event, { url, kiosk, partition }) => {
    if (kiosk) {
      if (launcherWin && !launcherWin.isDestroyed()) launcherWin.hide()
      shell.openExternal(url)
    } else {
      openEmbeddedBrowser(url, partition)
    }
    // Activity logged by the renderer so we don't double-log
  })

  ipcMain.on('launcher:close-browser', () => {
    closeEmbeddedBrowser()
  })

  ipcMain.on('launcher:browser-back', () => {
    if (embeddedView) {
      if (embeddedView.webContents.canGoBack()) {
        embeddedView.webContents.goBack()
      } else {
        // Nothing to go back to (SPA or first page) — close browser and go home
        closeEmbeddedBrowser()
        if (launcherWin && !launcherWin.isDestroyed()) {
          launcherWin.webContents.send('launcher:go-home')
        }
      }
    }
  })

  ipcMain.on('launcher:set-browser-nav-width', (event, navWidthPx) => {
    // Reposition BrowserView to account for nav bar width
    if (embeddedView && launcherWin) {
      const bounds = launcherWin.getContentBounds()
      embeddedView.setBounds({
        x: navWidthPx,
        y: 0,
        width: bounds.width - navWidthPx,
        height: bounds.height
      })
    }
  })

  ipcMain.on('launcher:help-pressed', () => {
    logActivity('help-pressed')
    // Notify admin if open
    if (adminWin && !adminWin.isDestroyed()) {
      adminWin.webContents.send('admin:alert', { type: 'help-pressed', ts: Date.now() })
    }
  })

  ipcMain.on('launcher:send-help-notification', () => {
    try {
      if (adminWin && !adminWin.isDestroyed()) {
        // Restore first (only if minimized), then show and focus
        if (adminWin.isMinimized()) adminWin.restore()
        adminWin.show()
        adminWin.focus()
        try { adminWin.flashFrame(true) } catch (_) {}
        adminWin.webContents.send('admin:help-alert')
      }
    } catch (err) {
      console.error('[help-notification] error:', err)
    }
  })

  ipcMain.handle('launcher:launch-app', async (event, { path }) => {
    // Guard: if the target looks like a URL, open it as a website instead of spawning
    if (/^https?:\/\//i.test(path) || /^[a-z0-9-]+\.(com|org|net|io|co)/i.test(path)) {
      const url = path.startsWith('http') ? path : `https://${path}`
      openEmbeddedBrowser(url)
      logActivity('app-redirected-to-web', url)
      return { ok: true }
    }

    const ext = extname(path).toLowerCase()

    // Shortcuts, batch files, and documents can't be spawned directly on
    // Windows — hand them to the OS shell, which resolves .lnk targets, runs
    // .bat through cmd, and sets the proper working directory / file association.
    if (['.lnk', '.url', '.bat', '.cmd', ''].includes(ext)) {
      const errMsg = await shell.openPath(path)
      if (errMsg) {
        console.error('[launch-app] openPath failed:', errMsg)
        logActivity('app-launch-failed', `${path}: ${errMsg}`)
        return { ok: false, error: errMsg }
      }
      logActivity('app-launched', path)
      return { ok: true }
    }

    try {
      const { spawn } = await import('child_process')
      // Launch with the game's own folder as the working directory — most
      // games load their assets/DLLs relative to cwd and error out or crash
      // when spawned from the launcher's directory instead.
      const child = spawn(path, [], {
        detached: true,
        stdio: 'ignore',
        cwd: dirname(path)
      })
      child.on('error', (err) => {
        console.error('[launch-app] spawn error:', err.message)
        logActivity('app-launch-failed', `${path}: ${err.message}`)
      })
      child.unref()
      logActivity('app-launched', path)
      return { ok: true }
    } catch (err) {
      console.error('[launch-app] failed:', err.message)
      logActivity('app-launch-failed', `${path}: ${err.message}`)
      return { ok: false, error: err.message }
    }
  })

  ipcMain.on('launcher:log-activity', (event, { type, detail }) => {
    logActivity(type, detail)
  })

  ipcMain.handle('launcher:get-music', async () => {
    try {
      const musicPath = app.getPath('music')
      const files = await readdir(musicPath)
      const mp3s = files.filter(f => f.toLowerCase().endsWith('.mp3'))

      return mp3s.map(file => ({
        name: file.replace(/\.mp3$/i, ''),
        path: `file://${join(musicPath, file).replace(/\\/g, '/')}`
      }))
    } catch (err) {
      console.error('[music-player] Error reading music folder:', err)
      return []
    }
  })

  ipcMain.handle('launcher:get-local-games', () => {
    return store.get('games.localGames') ?? []
  })

  ipcMain.handle('launcher:get-game-icon', async (_, { path }) => {
    try {
      const icon = await app.getFileIcon(path, { size: 'large' })
      return icon.toDataURL()
    } catch {
      return null
    }
  })

  // ── AI Buddy ──────────────────────────────────────────────────────────────
  // Persisted conversation history (last 30 messages for context window management)
  function getAIHistory() { return store.get('ai.buddyHistory') || [] }
  function setAIHistory(msgs) {
    const trimmed = msgs.slice(-30)
    store.set('ai.buddyHistory', trimmed)
  }

  ipcMain.handle('launcher:ask-ai', async (event, { message }) => {
    const apiKey = store.get('ai.openaiKey') || process.env.OPENAI_API_KEY
    if (!apiKey) return { error: 'no-key' }
    const model = store.get('ai.model') || 'gpt-4o-mini'
    const userName = store.get('userName') || 'Grandma'
    const tiles = store.get('tiles') || []

    // Build tile context so the AI can reference available apps
    const tileNames = tiles.map(t => t.label).filter(Boolean).join(', ')

    const systemPrompt = `You are Buddy, a warm, patient, and cheerful AI companion inside a computer launcher made for ${userName}, an elderly woman. You have TWO roles:

1. COMPUTER HELPER: Help ${userName} use the computer. She can open apps by tapping tiles on the home screen. Available apps/tiles: ${tileNames}. Guide her step-by-step with simple instructions. If she wants to open something, tell her exactly which tile to tap.

2. COMPANION: Chat warmly, tell jokes, share fun facts, talk about her day, and keep her company. Be friendly like a grandchild would be.

RULES:
- Keep responses SHORT (2-3 sentences max for voice readability)
- Use simple, plain language — NO technical jargon
- Be warm, encouraging, and patient
- If ${userName} seems confused or frustrated, be extra gentle and reassuring
- You can suggest actions like opening a specific app by mentioning the tile name
- Always end with a helpful suggestion or warm question if appropriate
- Use the person's name naturally
- NEVER mention you are an AI, a model, or anything technical`

    const history = getAIHistory()
    const messages = [
      { role: 'system', content: systemPrompt },
      ...history,
      { role: 'user', content: message }
    ]

    try {
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model,
          messages,
          max_tokens: 300,
          temperature: 0.85
        })
      })
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        return { error: errData?.error?.message || `API error ${res.status}` }
      }
      const data = await res.json()
      const reply = data.choices?.[0]?.message?.content
      if (!reply) return { error: 'empty-response' }

      // Persist conversation
      const updated = [...history, { role: 'user', content: message }, { role: 'assistant', content: reply }]
      setAIHistory(updated)

      return { reply }
    } catch (err) {
      console.error('[ask-ai] error:', err)
      return { error: err.message }
    }
  })

  ipcMain.handle('launcher:clear-ai-history', () => {
    store.set('ai.buddyHistory', [])
    return { ok: true }
  })

  ipcMain.handle('launcher:get-ai-history', () => {
    return getAIHistory()
  })

  ipcMain.handle('launcher:get-family-radio-queue', async () => {
    const url = getMessengerUrl()
    if (!url) return []
    try {
      const res = await fetch(`${url}/api/family-radio/queue`, {
        headers: { 'x-launcher-token': store.get('authToken') || '' }
      })
      if (!res.ok) return []
      return await res.json()
    } catch (err) {
      console.warn('[family-radio] Failed to fetch queue:', err.message)
      return []
    }
  })

  ipcMain.handle('launcher:mark-family-radio-played', async (event, { id }) => {
    const url = getMessengerUrl()
    if (!url) return { ok: false }
    try {
      const res = await fetch(`${url}/api/family-radio/${id}/played`, {
        method: 'POST',
        headers: { 'x-launcher-token': store.get('authToken') || '' }
      })
      return { ok: res.ok }
    } catch (err) {
      console.warn('[family-radio] Failed to mark played:', err.message)
      return { ok: false }
    }
  })

  ipcMain.handle('launcher:get-local-photos', async () => {
    const localPath = store.get('photos.localPath') ?? ''
    if (!localPath) return []
    try {
      const files = await readdir(localPath)
      const images = files.filter(f => /\.(png|jpg|jpeg|gif|webp|bmp)$/i.test(f))
      return images.map(file => {
        const abs = join(localPath, file)
        return {
          name: file,
          path: abs,
          url: `file://${abs.replace(/\\/g, '/')}`
        }
      })
    } catch (err) {
      console.error('[photos] Error reading local photos folder:', err)
      return []
    }
  })

  // Generate a small thumbnail for a photo. Rendering full-resolution images
  // into a grid decodes huge bitmaps into memory (slow, can stall the UI);
  // native thumbnails are fast (Windows shell thumbnail cache) and lightweight.
  ipcMain.handle('launcher:get-photo-thumbnail', async (_, { path }) => {
    try {
      const img = await nativeImage.createThumbnailFromPath(path, { width: 400, height: 400 })
      return img.toDataURL()
    } catch (err) {
      console.error('[photos] thumbnail failed:', path, err.message)
      return null
    }
  })

  // ── Admin ─────────────────────────────────────────────────────────────────

  ipcMain.handle('admin:generate-digest', async () => {
    const apiKey = store.get('ai.openrouterKey') || process.env.OPENROUTER_API_KEY
    if (!apiKey) return { error: 'no-key' }
    const model = store.get('ai.model') || 'poolside/laguna-m.1:free'
    const userName = store.get('userName') || 'Grandma'
    const log = store.get('activityLog') || []
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000
    const recent = log.filter(e => e.ts > sevenDaysAgo)
    const logText = recent.length
      ? recent.map(e => {
          const d = new Date(e.ts)
          return `${d.toLocaleDateString()} ${d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}: ${e.type}${e.detail ? ` (${e.detail})` : ''}`
        }).join('\n')
      : 'No logged activity in the past 7 days.'
    try {
      const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'grandmas-launcher',
          'X-Title': "Grandma's Launcher"
        },
        body: JSON.stringify({
          model,
          messages: [
            {
              role: 'system',
              content: `You are a helpful assistant summarizing activity data for a caregiver. Write a warm, concise 3–5 sentence paragraph about how ${userName} has been using her tablet over the past week. Note patterns, highlights, or anything a caregiver should know. Write in third person. Be factual, gentle, and easy to read at a glance.`
            },
            { role: 'user', content: `${userName}'s recent activity log:\n\n${logText}` }
          ],
          max_tokens: 350,
          // Disable reasoning (see ask-ai handler) so the digest text lands in content.
          reasoning: { enabled: false }
        })
      })
      const data = await res.json()
      const digest = data.choices?.[0]?.message?.content
      if (!digest) return { error: 'empty-response' }
      return { digest, generatedAt: Date.now(), entryCount: recent.length }
    } catch (err) {
      console.error('[digest] error:', err)
      return { error: err.message }
    }
  })

  ipcMain.handle('admin:get-config', () => store.store)

  ipcMain.handle('admin:get-messenger-info', () => {
    const port = getMessengerPort()
    const lanIps = Object.values(os.networkInterfaces())
      .flat()
      .filter(i => i && i.family === 'IPv4' && !i.internal)
      .map(i => i.address)
    return { port, lanIps }
  })

  ipcMain.handle('admin:set', (event, { key, value }) => {
    saveBackup() // Save full config state before applying mutation
    store.set(key, value)
    // Bust weather cache when location/unit changes so next fetch is fresh
    if (key === 'weather') clearWeatherCache()
    // Apply changed messenger credentials (e.g. a new PIN) to the running
    // server immediately so they take effect without an app restart
    if (key === 'messenger') updateMessengerConfig(value)
    // Mirror contact slugs/PINs into the messenger server so family links work
    if (key === 'contacts') syncMessengerContacts(value)
    // Push config update to launcher
    if (launcherWin && !launcherWin.isDestroyed()) {
      launcherWin.webContents.send('launcher:config-updated', { key, value })
    }
    return { ok: true }
  })

  ipcMain.handle('admin:rollback-config', (event, { index }) => {
    const success = restoreBackup(index)
    if (success) {
      applyRestoredConfigSideEffects()
      if (launcherWin && !launcherWin.isDestroyed()) {
        // Re-send updated config payload to force launcher to re-render changes
        launcherWin.webContents.send('launcher:config-updated', { key: 'ALL', value: store.store })
      }
    }
    return { ok: success }
  })

  ipcMain.handle('config:getHistory', () => {
    const history = store.get('configHistory') || []
    return history.map((entry, index) => ({ ts: entry.ts, index }))
  })

  ipcMain.handle('config:restore', (_, index) => {
    const success = restoreBackup(index)
    if (success) {
      applyRestoredConfigSideEffects()
      if (launcherWin && !launcherWin.isDestroyed()) {
        launcherWin.webContents.send('launcher:config-updated', { key: 'ALL', value: store.store })
      }
      if (adminWin && !adminWin.isDestroyed()) {
        adminWin.webContents.send('config:updated')
      }
    }
    return { ok: success }
  })

  ipcMain.handle('admin:get-activity-log', () => store.get('activityLog'))

  ipcMain.handle('admin:clear-activity-log', () => {
    store.set('activityLog', [])
    return { ok: true }
  })

  ipcMain.handle('admin:refresh-weather', async () => {
    clearWeatherCache()
    const result = await fetchWeather()
    // Push fresh weather to launcher
    if (launcherWin && !launcherWin.isDestroyed()) {
      launcherWin.webContents.send('launcher:weather-updated', result)
    }
    return result
  })

  ipcMain.handle('admin:pick-image', async () => {
    const result = await dialog.showOpenDialog(adminWin, {
      title: 'Choose a tile icon image',
      filters: [
        { name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'gif', 'svg', 'ico', 'webp'] }
      ],
      properties: ['openFile']
    })
    if (result.canceled || !result.filePaths.length) return null
    return result.filePaths[0]
  })

  ipcMain.handle('admin:pick-folder', async () => {
    const result = await dialog.showOpenDialog(adminWin, {
      title: 'Choose a folder',
      properties: ['openDirectory']
    })
    if (result.canceled || !result.filePaths.length) return null
    return result.filePaths[0]
  })

  ipcMain.handle('admin:pick-app', async () => {
    const result = await dialog.showOpenDialog(adminWin, {
      title: 'Choose an application or executable',
      filters: [
        { name: 'Applications', extensions: ['exe', 'app', 'sh', 'bat', 'lnk'] },
        { name: 'All Files', extensions: ['*'] }
      ],
      properties: ['openFile']
    })
    if (result.canceled || !result.filePaths.length) return null
    return result.filePaths[0]
  })

  ipcMain.on('admin:show-launcher', () => {
    expandLauncher(launcherWin)
  })

  // ── WebRTC signaling relay ────────────────────────────────────────────────

  // Relay SDP answer from renderer → socket.io
  ipcMain.on('launcher:call-answer', (_, { to, answer }) => {
    emitSignal('call-answer', { to, answer })
  })

  // Relay ICE candidates renderer → socket.io
  ipcMain.on('launcher:ice-candidate', (_, { to, candidate }) => {
    emitSignal('ice-candidate', { to, candidate })
  })

  // Jean pressed End Call
  ipcMain.on('launcher:end-call', (_, { to }) => {
    emitSignal('call-ended', { to })
  })

  // Jean pressed "Not Now"
  ipcMain.on('launcher:decline-call', (_, { to }) => {
    emitSignal('call-declined', { to })
  })
}

// A restored backup may contain a different messenger PIN or weather location —
// apply the same side effects admin:set does, or the running server keeps
// validating against the pre-rollback credentials.
function applyRestoredConfigSideEffects() {
  updateMessengerConfig(store.get('messenger') || {})
  syncMessengerContacts(store.get('contacts') || [])
  clearWeatherCache()
}

// Ad funnels on embedded sites (Pinterest/news/YouTube) can chain into a
// non-http(s) URL — a custom protocol handler, file://, chrome-extension://,
// etc. — that Chromium's navigation layer may hand off to the OS outside
// Electron's window management entirely, which is how a rabbit-hole of ad
// taps has occasionally broken out of the kiosk. Block at will-navigate/
// will-redirect (before the OS gets a chance to act on it), not after.
function isSafeNavigationProtocol(targetUrl) {
  try {
    const protocol = new URL(targetUrl).protocol
    // http/https are normal web navigation. about:/blob:/data: are harmless
    // in-page schemes that legitimately fire will-navigate (downloads, some
    // video players, share widgets) and stay inside the BrowserView — they are
    // NOT OS handoffs, so we must not treat them as escape attempts. Everything
    // else (mailto:, tel:, file:, custom app protocols, etc.) can hand off to
    // the OS and still routes to escape recovery.
    return (
      protocol === 'http:' ||
      protocol === 'https:' ||
      protocol === 'about:' ||
      protocol === 'blob:' ||
      protocol === 'data:'
    )
  } catch {
    return false
  }
}

// Reuses the exact same recovery path as the BrowserView inactivity timeout
// (close the view, show the existing calm ConfusionOverlay) so an escape
// attempt looks identical to a pattern she's already familiar with — never
// a new kind of "something went wrong" moment.
function triggerEscapeRecovery(blockedUrl) {
  logActivity('escape-attempt-blocked', blockedUrl)
  closeEmbeddedBrowser()
  if (launcherWin && !launcherWin.isDestroyed()) {
    launcherWin.webContents.send('launcher:inactivity-timeout')
  }
}

function openEmbeddedBrowser(url, partition = null) {
  if (!launcherWin) return
  closeEmbeddedBrowser()

  const webPreferences = {
    contextIsolation: true,
    nodeIntegration: false,
    preload: join(__dirname, '../preload/browserView.js')
  }
  if (partition) webPreferences.partition = partition

  const view = new BrowserView({ webPreferences })
  enableAdBlockingFor(view.webContents.session)
  launcherWin.addBrowserView(view)
  embeddedView = view
  setEmbeddedView(view)

  const bounds = launcherWin.getContentBounds()
  const NAV_WIDTH = 300
  view.setBounds({ x: NAV_WIDTH, y: 0, width: bounds.width - NAV_WIDTH, height: bounds.height })
  view.webContents.loadURL(url)

  // Block any new windows from opening in the system browser — keep all navigation inside the BrowserView.
  // A programmatic loadURL does not fire will-navigate, so we must apply the same protocol guard here;
  // otherwise window.open('file:///...') or a custom-protocol URL would load straight into the kiosk view.
  view.webContents.setWindowOpenHandler(({ url: newUrl }) => {
    if (!isSafeNavigationProtocol(newUrl)) {
      triggerEscapeRecovery(newUrl)
    } else {
      view.webContents.loadURL(newUrl)
    }
    return { action: 'deny' }
  })

  view.webContents.on('will-navigate', (event, navUrl) => {
    if (!isSafeNavigationProtocol(navUrl)) {
      event.preventDefault()
      triggerEscapeRecovery(navUrl)
    }
  })
  view.webContents.on('will-redirect', (event, navUrl) => {
    if (!isSafeNavigationProtocol(navUrl)) {
      event.preventDefault()
      triggerEscapeRecovery(navUrl)
    }
  })

  // Signal renderer on every page load and inject site-specific CSS
  view.webContents.on('did-finish-load', () => {
    if (launcherWin && !launcherWin.isDestroyed()) {
      launcherWin.webContents.send('launcher:browser-loaded')
    }
    const currentUrl = view.webContents.getURL()
    if (currentUrl.includes('pinterest.com')) {
      view.webContents.insertCSS(PINTEREST_AD_CSS).catch(() => {})
    }
  })

  // Tell launcher renderer we entered browser mode
  launcherWin.webContents.send('launcher:browser-opened', { url })

  // Start inactivity watch
  lastBrowserActivity = Date.now()
  startBrowserViewInactivityTimer()
}

export function closeEmbeddedBrowser() {
  stopBrowserViewInactivityTimer()
  if (!embeddedView || !launcherWin) return
  launcherWin.removeBrowserView(embeddedView)
  embeddedView.webContents.destroy()
  embeddedView = null
  setEmbeddedView(null)

  if (launcherWin && !launcherWin.isDestroyed()) {
    launcherWin.webContents.send('launcher:browser-closed')
  }
}

export function forceGoHome() {
  closeEmbeddedBrowser()   // synchronous — removeBrowserView is sync in Electron
  if (launcherWin && !launcherWin.isDestroyed()) {
    launcherWin.webContents.send('launcher:go-home')
  }
}

export function setupLauncherPermissions(launcherWin) {
  // Auto-grant camera/mic ONLY to the launcher BrowserWindow renderer
  // Scoped by webContents.id to prevent BrowserViews from inheriting this grant
  launcherWin.webContents.session.setPermissionRequestHandler((webContents, permission, callback) => {
    if (webContents.id === launcherWin.webContents.id &&
        ['camera', 'microphone', 'media'].includes(permission)) {
      callback(true)
      return
    }

    // Auto-approve media permissions for the embedded messenger (served from localhost)
    if (webContents.getURL().startsWith('http://localhost') &&
        ['camera', 'microphone', 'media'].includes(permission)) {
      callback(true)
      return
    }

    callback(false)
  })
}

function startBrowserViewInactivityTimer() {
  stopBrowserViewInactivityTimer()

  browserViewInactivityTimer = setInterval(() => {
    const { inactivityMinutes = 10, inactivityEnabled = true } = store.get('confusion') ?? {}
    if (!inactivityEnabled) return

    const elapsed = Date.now() - lastBrowserActivity
    if (elapsed >= inactivityMinutes * 60 * 1000) {
      logActivity('browserView-inactivity-timeout')
      stopBrowserViewInactivityTimer()
      closeEmbeddedBrowser()
      if (launcherWin && !launcherWin.isDestroyed()) {
        launcherWin.webContents.send('launcher:inactivity-timeout')
      }
    }
  }, 30_000)
}

function stopBrowserViewInactivityTimer() {
  if (browserViewInactivityTimer) {
    clearInterval(browserViewInactivityTimer)
    browserViewInactivityTimer = null
  }
}
