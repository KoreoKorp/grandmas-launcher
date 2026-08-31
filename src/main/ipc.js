import { ipcMain, shell, BrowserView, dialog, app, nativeImage } from 'electron'
import { join, dirname, extname } from 'path'
import { readdir, readFile, writeFile, mkdir, stat } from 'fs/promises'
import { createHash } from 'crypto'
import os from 'os'
import { exec } from 'child_process'
import { store, logActivity, saveBackup, restoreBackup } from './store.js'
import { fetchWeather, clearWeatherCache } from './weather.js'
import { expandLauncher } from './windows.js'
import { getMessengerPort, getMessengerUrl, updateMessengerConfig, syncMessengerContacts } from './serverManager.js'
import { enableAdBlockingFor } from './adBlocker.js'
import { synthesize as synthesizeTTS, dropClient as dropTTSClient, cloudTTSEnabled, ttsVoice } from './tts.js'

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

// ── Photo thumbnails ────────────────────────────────────────────────────────
// createThumbnailFromPath (Windows Shell) is the slow part of loading the
// Photos grid, and it re-runs from scratch every visit. Cache the encoded
// result to disk keyed by path + size + mtime + file size, so the first
// visit pays the cost once and every later visit reads a small JPEG straight
// off disk. JPEG (not PNG) because these are photos — no alpha, and the
// encode + the base64 string sent over IPC are both several times smaller.
const THUMB_CACHE_DIR = join(app.getPath('userData'), 'photo-thumb-cache')
let _thumbCacheReady = null
function ensureThumbCacheDir() {
  if (!_thumbCacheReady) _thumbCacheReady = mkdir(THUMB_CACHE_DIR, { recursive: true }).catch(() => {})
  return _thumbCacheReady
}

async function thumbnailFor(path, size) {
  let key
  try {
    const st = await stat(path)
    key = createHash('sha1').update(`${path}|${size}|${st.mtimeMs}|${st.size}`).digest('hex')
  } catch {
    return null // file vanished between listing and request
  }
  const cacheFile = join(THUMB_CACHE_DIR, `${key}.jpg`)
  try {
    const buf = await readFile(cacheFile)
    return `data:image/jpeg;base64,${buf.toString('base64')}`
  } catch { /* cache miss — generate below */ }

  try {
    const img = await nativeImage.createThumbnailFromPath(path, { width: size, height: size })
    const buf = img.toJPEG(72)
    ensureThumbCacheDir().then(() => writeFile(cacheFile, buf).catch(() => {}))
    return `data:image/jpeg;base64,${buf.toString('base64')}`
  } catch (err) {
    console.error('[photos] thumbnail failed:', path, err.message)
    return null
  }
}

// Warm the thumbnail cache in the background so the Photos grid is already
// populated the first time she opens it after a boot. Runs gently (narrow
// concurrency, deferred start) and is cheap on later boots — every already
// cached photo is just one small readFile. Safe to call more than once.
let _prewarmRunning = false
export function prewarmPhotoThumbnails({ delayMs = 8000 } = {}) {
  if (_prewarmRunning) return
  _prewarmRunning = true
  setTimeout(async () => {
    try {
      const photos = await listLocalPhotos()
      if (!photos.length) return
      const CONCURRENCY = 3
      let i = 0
      async function worker() {
        while (i < photos.length) {
          const p = photos[i++]
          await thumbnailFor(p.path, 400)  // launcher grid size
          await thumbnailFor(p.path, 200)  // admin caption-editor size
        }
      }
      await Promise.all(Array.from({ length: CONCURRENCY }, worker))
      console.log(`[photos] thumbnail cache warmed for ${photos.length} photo(s)`)
    } catch (err) {
      console.warn('[photos] thumbnail prewarm failed:', err.message)
    } finally {
      _prewarmRunning = false
    }
  }, delayMs)
}

// Shared by the launcher's Photos view and the admin caption editor so both
// see the same file list from the same folder in the same shape.
async function listLocalPhotos(pathOverride) {
  const localPath = typeof pathOverride === 'string'
    ? pathOverride.trim()
    : (store.get('photos.localPath') ?? '')
  if (!localPath) return []
  try {
    const files  = await readdir(localPath)
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
}

// ── Claude (Anthropic Messages API) — shared by Buddy chat + caregiver digest ──
function claudeKey() {
  return store.get('ai.anthropicKey') || process.env.ANTHROPIC_API_KEY
}

function claudeModel() {
  // claude-haiku-4-5 is Anthropic's fast/cheap tier; override with ai.model
  // only if a caregiver set a real model id deliberately.
  return store.get('ai.model') || 'claude-haiku-4-5'
}

async function callClaude(system, messages, maxTokens = 300, timeoutMs = 30_000) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': claudeKey(),
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json'
    },
    body: JSON.stringify({ model: claudeModel(), max_tokens: maxTokens, system, messages }),
    signal: AbortSignal.timeout(timeoutMs)
  })
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}))
    const msg = errData?.error?.message || `API error ${res.status}`
    console.error('[claude] error:', res.status, msg)
    throw new Error(msg)
  }
  const data = await res.json()
  const text = (data.content || []).filter(b => b.type === 'text').map(b => b.text).join('')
  if (!text) throw new Error('empty-response')
  return text
}

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
    whosHome: store.get('whosHome'),
    ai: { available: !!(store.get('ai.anthropicKey') || process.env.ANTHROPIC_API_KEY) }
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

  ipcMain.on('launcher:browser-back', () => browserGoBack())

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
    const apiKey = claudeKey()
    if (!apiKey) return { error: 'no-key' }
    const userName = store.get('userName') || 'Grandma'
    const tiles = store.get('tiles') || []

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
    try {
      // Anthropic requires the conversation to start with a user turn — drop
      // the assistant greeting that leads stored history.
      const chat = history.filter((m, i) => !(i === 0 && m.role === 'assistant'))
      const reply = await callClaude(systemPrompt, [...chat, { role: 'user', content: message }])
      const updated = [...history, { role: 'user', content: message }, { role: 'assistant', content: reply }]
      setAIHistory(updated)

      // Suggestions are optional decoration. Generate them after returning the
      // primary answer so a slow second request can never leave Buddy stuck on
      // the typing indicator.
      const sender = event.sender
      const suggestionRequestId = crypto.randomUUID()
      void (async () => {
        try {
          const suggSystem = `You suggest short, simple, tap-friendly follow-up prompts for an elderly woman using a friendly computer companion called Buddy. Given the assistant's most recent reply, propose 3 very short (2-5 words) things she could say next by tapping a button. Keep them kind, useful, and easy to understand. Respond with ONLY a JSON array of strings, for example: ["Tell me a joke","How is the weather?","Play a game"]. No other text.`
          const raw = await callClaude(
            suggSystem,
            [{ role: 'user', content: `Assistant's last reply: ${reply}` }],
            80,
            5_000
          )
          const parsed = JSON.parse(raw)
          if (!Array.isArray(parsed)) return
          const suggestions = parsed
            .filter(s => typeof s === 'string' && s.trim())
            .slice(0, 4)
            .map(s => s.trim().slice(0, 60))
          if (suggestions.length && !sender.isDestroyed()) {
            sender.send('launcher:ai-suggestions', { requestId: suggestionRequestId, suggestions })
          }
        } catch {
          // Keep the existing fallback chips; the answer has already arrived.
        }
      })()

      return { reply, suggestionRequestId }
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

  // ── Who's Home? (LAN presence via AT&T gateway + ARP fallback) ──────────────
  ipcMain.handle('launcher:scan-lan', () => scanWhosHome())
  ipcMain.handle('admin:scan-lan', () => scanWhosHome())

  // ── Cloud TTS (Edge natural voices) ───────────────────────────────────────
  ipcMain.handle('launcher:tts-speak', async (event, { text }) => {
    if (!cloudTTSEnabled()) return { error: 'disabled' }
    const clean = String(text || '').slice(0, 800)
    if (!clean.trim()) return { error: 'empty' }
    try {
      const audio = await Promise.race([
        synthesizeTTS(clean),
        new Promise((_, rej) => setTimeout(() => rej(new Error('tts timeout')), 10_000))
      ])
      return { audio, voice: ttsVoice() }
    } catch (err) {
      console.error('[tts] error:', err.message)
      dropTTSClient()
      return { error: err.message }
    }
  })

  ipcMain.handle('launcher:tts-voices', () => ({ enabled: cloudTTSEnabled(), voice: ttsVoice() }))

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
    const captions = store.get('photos.captions') || {}
    const photos   = await listLocalPhotos()
    return photos.map(p => ({ ...p, caption: captions[p.name] || '' }))
  })

  // Admin panel needs the same listing to build the caption editor —
  // captions themselves are saved through the normal admin:set('photos', …).
  ipcMain.handle('admin:get-local-photos', async (_, { path } = {}) => listLocalPhotos(path))

  // Small, disk-cached thumbnail for a photo. Rendering full-resolution images
  // into a grid decodes huge bitmaps into memory (slow, can stall the UI);
  // these are downscaled once and reused from disk on every later visit.
  ipcMain.handle('launcher:get-photo-thumbnail', (_, { path }) => thumbnailFor(path, 400))

  // Same generator, exposed to the admin caption editor (smaller size).
  ipcMain.handle('admin:get-photo-thumbnail', (_, { path }) => thumbnailFor(path, 200))

  // Ctrl+= / Ctrl+- in the launcher nudges the whole-UI font scale one step and
  // persists it, so a caregiver can size the text from the couch without
  // opening the admin panel. Only this one key is writable from the launcher.
  ipcMain.handle('launcher:nudge-font-scale', (_, { dir }) => {
    const STEPS = ['small', 'medium', 'large', 'xlarge', 'xxlarge']
    const cur = store.get('display.fontScale') || 'medium'
    const next = STEPS[Math.min(STEPS.length - 1, Math.max(0, STEPS.indexOf(cur) + (dir > 0 ? 1 : -1)))]
    if (next !== cur) {
      saveBackup()
      store.set('display.fontScale', next)
      if (launcherWin && !launcherWin.isDestroyed()) {
        launcherWin.webContents.send('launcher:config-updated', { key: 'display', value: store.get('display') })
      }
    }
    return { fontScale: next }
  })

  // ── Admin ─────────────────────────────────────────────────────────────────

  ipcMain.handle('admin:generate-digest', async () => {
    const apiKey = claudeKey()
    if (!apiKey) return { error: 'no-key' }
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
      const digest = await callClaude(
        `You are a helpful assistant summarizing activity data for a caregiver. Write a warm, concise 3–5 sentence paragraph about how ${userName} has been using her tablet over the past week. Note patterns, highlights, or anything a caregiver should know. Write in third person. Be factual, gentle, and easy to read at a glance.`,
        [{ role: 'user', content: `${userName}'s recent activity log:\n\n${logText}` }],
        350
      )
      return { digest, generatedAt: Date.now(), entryCount: recent.length }
    } catch (err) {
      console.error('[digest] error:', err)
      return { error: err.message }
    }
  })

  // Draft a caption for one local photo with Claude's vision model. Returns a
  // plain description the caregiver edits (to add real names) before saving —
  // the model can't know who anyone is, but "An older woman and two children
  // on a beach" is most of the work done.
  ipcMain.handle('admin:generate-caption', async (_, { path }) => {
    if (!claudeKey()) return { error: 'no-key' }
    let dataB64
    try {
      const img = await nativeImage.createThumbnailFromPath(path, { width: 1024, height: 1024 })
      dataB64 = img.toJPEG(80).toString('base64')
    } catch (err) {
      console.error('[caption] could not read photo:', path, err.message)
      return { error: 'unreadable-image' }
    }
    try {
      const caption = await callClaude(
        `You write short, warm captions for family photos shown to an elderly woman with memory loss. ` +
        `Reply with ONE caption of at most 14 words — no quotes, no preamble. Describe who and where: ` +
        `approximate ages and relationships you can infer ("an older man", "a young girl"), the setting, ` +
        `and the occasion if it's obvious. Do not invent names.`,
        [{ role: 'user', content: [
          { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: dataB64 } },
          { type: 'text', text: 'Write the caption for this photo.' }
        ]}],
        80
      )
      return { caption: caption.trim().replace(/^["']|["']$/g, '') }
    } catch (err) {
      console.error('[caption] error:', err)
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

  // Keyboard shortcuts for the Back and Home buttons. While she's on a website
  // the BrowserView holds keyboard focus, so the launcher renderer never sees
  // these keys — they must be intercepted here in the main process.
  //   Alt+Left  → Back  (same as the on-screen Back button; also overrides
  //               Chromium's built-in Alt+Left so "no history left" still
  //               closes the browser and goes home)
  //   Alt+Down  → Home  (same as the on-screen Home button)
  //   Alt+Up    → Home, then open the "choose a screen" picker
  // Bare Escape is deliberately left alone here — websites use it (exit
  // fullscreen video, close their own dialogs) and hijacking it would be a
  // surprise. Alt+Left already gets her out.
  view.webContents.on('before-input-event', (event, input) => {
    if (input.type !== 'keyDown' || !input.alt) return
    if (input.key === 'ArrowLeft') {
      event.preventDefault()
      browserGoBack()
    } else if (input.key === 'ArrowDown') {
      event.preventDefault()
      forceGoHome()
    } else if (input.key === 'ArrowUp') {
      event.preventDefault()
      forceGoHome()
      if (launcherWin && !launcherWin.isDestroyed()) {
        launcherWin.webContents.send('launcher:open-tile-picker')
      }
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

// Back button / Alt+Left: step back through the page's history, or if there is
// nowhere left to go (SPA or the first page) close the browser and return to the
// home screen. Shared by the on-screen Back button (via IPC) and the keyboard
// shortcut intercepted on the BrowserView in openEmbeddedBrowser().
function browserGoBack() {
  if (!embeddedView) return
  if (embeddedView.webContents.canGoBack()) {
    embeddedView.webContents.goBack()
  } else {
    closeEmbeddedBrowser()
    if (launcherWin && !launcherWin.isDestroyed()) {
      launcherWin.webContents.send('launcher:go-home')
    }
  }
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

// ── Who's Home? network helpers ──────────────────────────────────────────────

function stripTags(s) {
  return (s || '')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function normMac(s) {
  return (s || '').toLowerCase().replace(/[^a-f0-9]/g, '')
}

function isWifi(type) {
  return /wi-?fi|wireless|802\.11/i.test(type || '')
}

// Parse the AT&T gateway /cgi-bin/devices.ha page into device records.
function parseDevicesHtml(html) {
  const blocks = html.split(/<hr[^>]*class="reshr"[^>]*>/i)
  const devices = []
  for (const block of blocks) {
    const pairs = {}
    const re = /<td[^>]*>([\s\S]*?)<\/td>\s*<td[^>]*>([\s\S]*?)<\/td>/gi
    let m
    while ((m = re.exec(block))) {
      const label = stripTags(m[1])
      const value = stripTags(m[2])
      if (label) pairs[label] = value
    }
    if (!pairs['MAC Address']) continue
    let name = pairs['Name'] || ''
    let ip = pairs['IPv4 Address'] || ''
    const combo = pairs['IPv4 Address / Name']
    if (combo) {
      const [cIp, cName] = combo.split('/')
      if (!ip && cIp) ip = cIp.trim()
      if (!name && cName) name = cName.trim()
    }
    const speedNum = parseInt(String(pairs['Connection Speed'] || '').replace(/[^\d]/g, ''), 10)
    let signal = null
    if (isWifi(pairs['Connection Type']) && speedNum) {
      signal = speedNum >= 200 ? 'Strong' : speedNum >= 80 ? 'Good' : 'Weak'
    }
    devices.push({
      mac: pairs['MAC Address'],
      name,
      ip,
      connectionType: pairs['Connection Type'] || '',
      signalLabel: signal,
      signalValue: speedNum || null,
      online: /on|online|connected|active|yes/i.test(pairs['Status'] || '')
    })
  }
  return devices
}

// Run an async fn over items with bounded concurrency.
async function mapLimit(items, limit, fn) {
  const out = new Array(items.length)
  let i = 0
  async function worker() {
    while (i < items.length) {
      const idx = i++
      out[idx] = await fn(items[idx])
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker))
  return out
}

function execPromise(cmd, opts = {}) {
  return new Promise(resolve => {
    exec(cmd, opts, (err, stdout) => resolve({ err, stdout: stdout || '' }))
  })
}

async function detectGateway() {
  const { stdout } = await execPromise('ipconfig')
  for (const line of stdout.split('\n')) {
    const m = line.match(/Default Gateway[ .:]*\s*([\d.]+)/i)
    if (m && m[1] && m[1] !== '0.0.0.0') return m[1]
  }
  return '192.168.1.254'
}

async function localIp() {
  const { stdout } = await execPromise('ipconfig')
  const m = stdout.match(/IPv4 Address[ .:]*\s*([\d.]+)/i)
  return m ? m[1] : '192.168.1.23'
}

// Read-only fetch of the AT&T gateway device list (no auth required).
async function fetchAttDevices(gateway) {
  const res = await fetch(`http://${gateway}/cgi-bin/devices.ha`, { signal: AbortSignal.timeout(5000) })
  if (!res.ok) throw new Error(`devices.ha ${res.status}`)
  const html = await res.text()
  if (!/MAC Address/i.test(html)) throw new Error('not-att-gateway')
  return parseDevicesHtml(html)
}

function pingName(ip) {
  return new Promise(resolve => {
    exec(`ping -a -n 1 -w 250 ${ip}`, { timeout: 4000 }, (err, stdout) => {
      const m = stdout.match(/Pinging\s+(.+?)\s+\[([\d.]+)\]/i)
      if (!m) return resolve(null)
      const name = m[1].trim()
      const resolvedIp = m[2]
      if (name === resolvedIp) return resolve(null) // no hostname resolved
      resolve({
        ip: resolvedIp,
        name,
        mac: '',
        connectionType: '',
        signalLabel: null,
        signalValue: null,
        online: true
      })
    })
  })
}

async function arpMacs() {
  const { stdout } = await execPromise('arp -a')
  const map = {}
  const re = /([\d.]+)\s+([\da-f-]{17})\s+/gi
  let m
  while ((m = re.exec(stdout))) map[m[1]] = m[2]
  return map
}

// Best-effort name-based presence scan (no signal data) for non-AT&T routers.
async function arpScan() {
  const local = await localIp()
  const base = local.split('.').slice(0, 3).join('.')
  const ips = []
  for (let i = 1; i <= 254; i++) ips.push(`${base}.${i}`)
  await mapLimit(ips, 40, ip => new Promise(res => {
    exec(`ping -n 1 -w 150 ${ip}`, { timeout: 2500 }, () => res())
  }))
  const macMap = await arpMacs()
  const foundIps = Object.keys(macMap).filter(ip => ip !== local)
  const named = await mapLimit(foundIps, 20, ip => pingName(ip))
  // Reverse-DNS names are optional on home networks. Preserve every ARP
  // device so caregivers can reliably match the MAC address even when a phone
  // does not publish a hostname.
  return foundIps.map((ip, index) => {
    const resolved = named[index]
    return {
      ip,
      name: resolved?.name || '',
      mac: macMap[ip] || '',
      connectionType: '',
      signalLabel: null,
      signalValue: null,
      online: true
    }
  })
}

function matchPeople(devices, people) {
  return (people || []).map(p => {
    const want = (p.device || '').trim().toLowerCase()
    if (!want) {
      return { name: p.name, device: p.device, configured: false, home: false }
    }
    const macWant = want.replace(/[^a-f0-9]/g, '')
    const match = devices.find(d => {
      const nm = (d.name || '').toLowerCase()
      const mac = normMac(d.mac)
      return nm.includes(want) || (macWant && mac && mac.includes(macWant))
    })
    return {
      name: p.name,
      device: p.device,
      configured: true,
      home: !!match && match.online !== false,
      connectionType: match?.connectionType || null,
      signalLabel: match?.signalLabel || null,
      signalValue: match?.signalValue || null,
      ip: match?.ip || null,
      mac: match?.mac || null,
      matchedName: match?.name || null
    }
  })
}

async function scanWhosHome() {
  const cfg = store.get('whosHome') || {}
  const people = cfg.people || []
  const gateway = cfg.gateway || await detectGateway()
  let devices = []
  let method = 'none'
  let error = null
  try {
    devices = await fetchAttDevices(gateway)
    method = 'att'
  } catch (e) {
    try {
      devices = await arpScan()
      method = 'arp'
    } catch (e2) {
      error = 'Could not reach the network'
    }
  }
  return {
    method,
    gateway,
    people: matchPeople(devices, people),
    discovered: devices.map(d => ({
      name: d.name,
      mac: d.mac,
      ip: d.ip,
      connectionType: d.connectionType,
      signalLabel: d.signalLabel,
      signalValue: d.signalValue,
      online: d.online
    })),
    error
  }
}
