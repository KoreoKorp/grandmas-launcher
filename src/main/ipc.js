import { ipcMain, shell, BrowserView, dialog, app, nativeImage } from 'electron'
import { join, dirname, extname } from 'path'
import { readdir } from 'fs/promises'
import { existsSync } from 'fs'
import os from 'os'
import { store, logActivity, saveBackup, restoreBackup, getSecret, decryptSecret, encryptSecretsForKey, getDecryptedStore, isSettableKey } from './store.js'
import { fetchWeather, clearWeatherCache } from './weather.js'
import { expandLauncher } from './windows.js'
import { getMessengerPort, getMessengerUrl, updateMessengerConfig, syncMessengerContacts, sendHelpAlert } from './serverManager.js'
import { enableAdBlockingFor } from './adBlocker.js'
import * as tvService from './tvService.js'

const PINTEREST_AD_CSS = `
  [data-test-id="ad-label"], [data-test-id*="promoted"], [data-test-id*="ad-pin"],
  [aria-label*="Promoted"], [aria-label*="Ads by"],
  div[data-test-id="ads-label"], .GrowthUnauthenticatedLandingView,
  .fullPageSignupModal, [data-test-id="header-signup"] { display: none !important; }
`

// The Ghostery engine (adBlocker.js) already blocks the ad *requests* on every
// embedded site, but the page still reserves the layout space — Mental Floss is
// ad-dense enough that the leftovers read as big blank gaps mid-article, and the
// sticky bottom rail covers the Back button. Collapse the empty slots and hide
// the consent banner so an article is just the article.
//
// Selectors are the site's own slot ids, read off the served markup: Mental
// Floss declares them in a `var placeholders = {...}` block and hands them to
// Minute Media's `injectAdPlaceholders`, so one set covers the whole site. It
// uses no ad-related class names at all, hence ids only.
const MENTALFLOSS_AD_CSS = `
  /* Server-rendered containers. These carry explicit heights (min-h-[280px],
     h-[50px]) so a blocked ad leaves the reserved gap behind, not nothing. */
  [id^="static-ad-placeholder"], [id^="static-top-ad-placeholder"],

  /* Slots injected at runtime from the placeholders config. */
  [id^="div-gpt-ad"], [id^="div-sideBar"],
  #below-top-section, #below-second-section,

  /* Anchored bottom rail — overlays the page rather than reserving space, so
     the request-level block never removes it, and it sits over the Back
     button at the bottom of the view. */
  #div-sticky-bottom { display: none !important; }

  /* OneTrust consent banner (injected at runtime) and its footer link. */
  #onetrust-consent-sdk, [id^="onetrust-banner"],
  .ot-sdk-show-settings { display: none !important; }

  /* OneTrust locks page scrolling on <body> while its dialog is open. Hiding
     the dialog above leaves the lock set by JS, which would strand her on a
     page that will not scroll. */
  body.ot-overflow-hidden { overflow: auto !important; }
`

let launcherWin = null
let adminWin = null
let embeddedView = null // BrowserView for embedded websites

let browserViewInactivityTimer = null
let lastBrowserActivity = Date.now()

let _emitSignal = null
export function setSignalEmitter(fn) { _emitSignal = fn }
function emitSignal(event, data) { if (_emitSignal) _emitSignal(event, data) }

// Shared by the launcher's Photos view and the admin caption editor so both
// see the same file list from the same folder in the same shape.
async function listLocalPhotos() {
  const localPath = store.get('photos.localPath') ?? ''
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

  ipcMain.handle('launcher:get-config', () => {
    const messenger = store.get('messenger') || {}
    return {
      tiles: store.get('tiles'),
      reminders: store.get('reminders'),
      contacts: store.get('contacts'),
      dailyNote: store.get('dailyNote'),
      weather: store.get('weather'),
      display: store.get('display'),
      confusion: store.get('confusion'),
      help: store.get('help'),
      // The launcher embeds untrusted web content (Pinterest, news, YouTube),
      // so it only gets what it actually uses from `messenger`: the live
      // embedded server URL (dynamic port — not the stored config URL, which
      // would point at a stale port) and the WebRTC TURN config needed to
      // answer incoming calls. jeanPin/adminPassword/discordWebhookUrl/Twilio
      // creds/caregiverPhone never leave the main process toward this window.
      messenger: {
        url: getMessengerUrl(),
        webrtc: messenger.webrtc
          ? { ...messenger.webrtc, turnCredential: decryptSecret(messenger.webrtc.turnCredential) }
          : {}
      },
      games: store.get('games'),
      photos: store.get('photos'),
      familyRadio: store.get('familyRadio'),
      userName: store.get('userName'),
      ai: { available: !!(store.get('ai.openrouterKey') || process.env.OPENROUTER_API_KEY) }
    }
  })

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
    browserGoBack()
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

    // Reach family remotely too — the admin-window flash above only helps if
    // someone is physically at her PC. Discord/SMS go out regardless, over
    // whichever channel(s) the caregiver has configured (both are optional
    // and independently no-op if unconfigured).
    sendHelpAlert()
      .then(result => {
        if (result) logActivity('help-alert-sent', JSON.stringify(result))
      })
      .catch(err => console.error('[help-notification] remote alert failed:', err))
  })

  ipcMain.handle('launcher:launch-app', async (event, { path }) => {
    // Guard: if the target looks like a URL, open it as a website instead of
    // spawning. Anchored to the whole string (^...$) and excludes path
    // separators/drive letters so a Windows path like
    // "C:\Games\update.com\Game.exe" can't false-positive into this branch —
    // the old unanchored version matched anywhere in the string.
    if (/^https?:\/\//i.test(path) || /^[a-z0-9-]+\.(com|org|net|io|co)(\/.*)?$/i.test(path)) {
      const url = path.startsWith('http') ? path : `https://${path}`
      openEmbeddedBrowser(url)
      logActivity('app-redirected-to-web', url)
      return { ok: true }
    }

    // Sanity gate before spawning anything: the target must actually exist
    // on disk. Local app/game tiles are caregiver-configured (already a
    // trusted surface — remote config sync can't push type:'app' tiles, see
    // isSafeRemoteTile in index.js), so this isn't a security boundary so
    // much as a guard against a stale or mistyped path silently no-oping.
    if (!existsSync(path)) {
      logActivity('app-launch-failed', `${path}: not found`)
      return { ok: false, error: 'That app could not be found. Ask a family member to check it in the admin panel.' }
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

  // Persist that a reminder was dismissed so it doesn't re-pop — Sidebar's
  // "Got it" only cleared local component state before, so the same
  // reminder kept reappearing every 60s while its time window was current,
  // and again on any future launch since nothing was ever saved.
  ipcMain.on('launcher:dismiss-reminder', (event, { id }) => {
    const reminders = store.get('reminders') || []
    const idx = reminders.findIndex(r => r.id === id)
    if (idx === -1) return
    reminders[idx] = { ...reminders[idx], dismissed: true }
    store.set('reminders', reminders)
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
    const apiKey = getSecret('ai.openrouterKey') || process.env.OPENROUTER_API_KEY
    if (!apiKey) return { error: 'no-key' }
    const model = store.get('ai.model') || 'google/gemini-2.0-flash-001'
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
    const messages = [
      { role: 'system', content: systemPrompt },
      ...history,
      { role: 'user', content: message }
    ]

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
        headers: { 'x-launcher-token': getSecret('authToken') || '' }
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
        headers: { 'x-launcher-token': getSecret('authToken') || '' }
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
  // captions themselves are saved through the normal admin:set('photos', …)
  // path, same as albumUrl/localPath.
  ipcMain.handle('admin:get-local-photos', async () => listLocalPhotos())

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

  // Same thumbnail generator, exposed to the admin caption editor.
  ipcMain.handle('admin:get-photo-thumbnail', async (_, { path }) => {
    try {
      const img = await nativeImage.createThumbnailFromPath(path, { width: 200, height: 200 })
      return img.toDataURL()
    } catch (err) {
      console.error('[photos] thumbnail failed:', path, err.message)
      return null
    }
  })

  // ── Admin ─────────────────────────────────────────────────────────────────

  ipcMain.handle('admin:generate-digest', async () => {
    const apiKey = getSecret('ai.openrouterKey') || process.env.OPENROUTER_API_KEY
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

  ipcMain.handle('admin:get-config', () => getDecryptedStore())

  // Minimal, secret-free info the PinGate/first-run check needs before the
  // caregiver has authenticated. The full admin:get-config (which includes
  // the real adminPin, Twilio/Discord secrets, etc.) used to be fetched
  // unconditionally on mount regardless of lock state, so those secrets sat
  // in renderer memory — readable via DevTools — even while the PIN screen
  // was still showing. This is called instead, pre-auth; the full config
  // is only fetched after verify-pin succeeds.
  ipcMain.handle('admin:get-boot-info', () => ({
    hasAdminPin: !!getSecret('adminPin'),
    hasUserName: !!store.get('userName')
  }))

  // PIN comparison happens here, not in the renderer — the old PinGate
  // fetched the whole decrypted config (including the real adminPin) into
  // the renderer just to compare it locally, which meant the real PIN sat
  // in renderer memory on every attempt, correct or not, readable by
  // anyone with DevTools access. This returns only a boolean. Rate-limited
  // the same way the messenger server's PIN entry already is, since this
  // is a 4-8 digit PIN a local script could otherwise brute-force quickly.
  const adminPinAttempts = new Map()
  ipcMain.handle('admin:verify-pin', (event, { pin }) => {
    const senderId = event.sender.id
    const record = adminPinAttempts.get(senderId)
    const now = Date.now()
    if (record && now - record.since < 15 * 60 * 1000 && record.count >= 10) {
      return { ok: false, rateLimited: true }
    }
    const realPin = getSecret('adminPin')
    if (realPin && pin === realPin) {
      adminPinAttempts.delete(senderId)
      return { ok: true }
    }
    const next = (!record || now - record.since > 15 * 60 * 1000)
      ? { count: 1, since: now }
      : { count: record.count + 1, since: record.since }
    adminPinAttempts.set(senderId, next)
    return { ok: false }
  })

  ipcMain.handle('admin:test-help-alert', async () => {
    try {
      return (await sendHelpAlert()) || { discordSent: false, sms: { ok: false, reason: 'Server not running' } }
    } catch (err) {
      console.error('[test-help-alert] error:', err)
      return { discordSent: false, sms: { ok: false, reason: err.message } }
    }
  })

  ipcMain.handle('admin:get-messenger-info', () => {
    const port = getMessengerPort()
    const lanIps = Object.values(os.networkInterfaces())
      .flat()
      .filter(i => i && i.family === 'IPv4' && !i.internal)
      .map(i => i.address)
    return { port, lanIps }
  })

  ipcMain.handle('admin:set', (event, { key, value }) => {
    // CaregiverHandoff's import flow calls this once per top-level key found
    // in an imported JSON file — a file that can come from another machine
    // or person, so its shape isn't trusted. Reject anything that isn't a
    // real configurable setting rather than writing it straight to the store.
    if (!isSettableKey(key)) {
      console.warn(`[admin:set] rejected unknown key: ${key}`)
      return { ok: false, error: `Unknown setting: ${key}` }
    }
    saveBackup() // Save full config state before applying mutation
    // Encrypt secret fields before they touch disk — `value` itself stays
    // plaintext for the side-effect calls below (updateMessengerConfig etc.
    // need the real password/PIN/token the caregiver just typed, not ciphertext).
    store.set(key, encryptSecretsForKey(key, value))
    // Bust weather cache when location/unit changes so next fetch is fresh
    if (key === 'weather') clearWeatherCache()
    // Apply changed messenger credentials (e.g. a new PIN) to the running
    // server immediately so they take effect without an app restart
    if (key === 'messenger') updateMessengerConfig(value)
    // Mirror contact slugs/PINs into the messenger server so family links work
    if (key === 'contacts') syncMessengerContacts(value)
    // Push config update to launcher. Only `key` crosses the IPC boundary —
    // the launcher renderer embeds untrusted web content, and its one
    // onConfigUpdated listener already ignores any payload value and re-fetches
    // through the redacted launcher:get-config handler instead. Sending the
    // raw value here used to mean any secret write (messenger PIN/Twilio/
    // Discord, or a bare `ai.openrouterKey` value) got shipped straight into
    // that renderer's IPC payload even though nothing there ever read it.
    if (launcherWin && !launcherWin.isDestroyed()) {
      launcherWin.webContents.send('launcher:config-updated', { key })
    }
    return { ok: true }
  })

  ipcMain.handle('admin:rollback-config', (event, { index }) => {
    const success = restoreBackup(index)
    if (success) {
      applyRestoredConfigSideEffects()
      if (launcherWin && !launcherWin.isDestroyed()) {
        // Re-fetch, don't push store.store — see the note on admin:set above.
        launcherWin.webContents.send('launcher:config-updated', { key: 'ALL' })
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
        launcherWin.webContents.send('launcher:config-updated', { key: 'ALL' })
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

  // ── TV Remote ────────────────────────────────────────────────────────────

  // Load saved TV credentials (and the name/model discovered when it was
  // paired) on startup.
  const tvConfig = store.get('tv')
  if (tvConfig?.ip && tvConfig?.token) {
    tvService.loadCredentials(tvConfig.ip, tvConfig.token, tvConfig.name, tvConfig.model)
  }

  // Pairing changes the TV's connected/disconnected state out from under
  // whichever window (launcher or admin) didn't trigger it — e.g. the
  // caregiver clears pairing from admin while Jean has TVView open. Without
  // this, her copy of tvStatus goes stale and paired-only controls keep
  // showing as available. Mirrors the notification admin:set already sends
  // for every other config change.
  function notifyLauncherTvChanged() {
    if (launcherWin && !launcherWin.isDestroyed()) {
      launcherWin.webContents.send('launcher:config-updated', { key: 'tv' })
    }
  }

  async function tvCompletePairing(pin) {
    const result = await tvService.completePairing(pin)
    if (result.success) {
      const status = tvService.getTvStatus()
      store.set('tv.ip', status.ip)
      store.set('tv.token', result.authToken)
      store.set('tv.name', status.name)
      store.set('tv.model', status.model)
      store.set('tv.lastConnected', Date.now())
      notifyLauncherTvChanged()
    }
    return result
  }

  function tvClearPairing() {
    tvService.clearCredentials()
    store.set('tv.ip', '')
    store.set('tv.token', '')
    store.set('tv.name', '')
    store.set('tv.model', '')
    store.set('tv.lastConnected', null)
    notifyLauncherTvChanged()
    return { ok: true }
  }

  // Handlers identical between the launcher and admin panel — both need
  // basic status/pairing/volume/power control. Registered once under both
  // IPC prefixes so a future change (like persisting discovered name/model)
  // can't drift between the two copies the way duplicated handler bodies
  // previously could.
  const sharedTvHandlers = {
    'tv-get-status':       () => tvService.getTvStatus(),
    'tv-discover':         () => tvService.discoverTVs(),
    'tv-start-pairing':    (_, { ip, name, model }) => tvService.startPairing(ip, { name, model }),
    'tv-complete-pairing': (_, { pin }) => tvCompletePairing(pin),
    'tv-clear-pairing':    () => tvClearPairing(),
    'tv-power-on':         () => tvService.powerOn(),
    'tv-power-off':        () => tvService.powerOff(),
    'tv-volume-up':        () => tvService.volumeUp(),
    'tv-volume-down':      () => tvService.volumeDown(),
    'tv-mute':             () => tvService.mute()
  }
  for (const [name, handler] of Object.entries(sharedTvHandlers)) {
    ipcMain.handle(`launcher:${name}`, handler)
    ipcMain.handle(`admin:${name}`, handler)
  }

  // Launcher-only: channel/input/app control isn't exposed in the admin panel.
  ipcMain.handle('launcher:tv-channel-up', () => tvService.channelUp())
  ipcMain.handle('launcher:tv-channel-down', () => tvService.channelDown())
  ipcMain.handle('launcher:tv-set-input', (_, { input }) => tvService.setInput(input))
  ipcMain.handle('launcher:tv-launch-app', (_, { app }) => tvService.launchApp(app))
  ipcMain.handle('launcher:tv-get-input', () => tvService.getCurrentInput())
  ipcMain.handle('launcher:tv-get-power', () => tvService.getPowerState())

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
// validating against the pre-rollback credentials. Backups snapshot the store
// as-is, so secret fields come back encrypted — updateMessengerConfig and
// syncMessengerContacts both need the real values (the latter uses
// messengerPin as the literal PIN family members type to authenticate).
function applyRestoredConfigSideEffects() {
  const messenger = store.get('messenger') || {}
  updateMessengerConfig({
    ...messenger,
    adminPassword: decryptSecret(messenger.adminPassword),
    jeanPin: decryptSecret(messenger.jeanPin),
    twilioAuthToken: decryptSecret(messenger.twilioAuthToken),
    webrtc: messenger.webrtc ? { ...messenger.webrtc, turnCredential: decryptSecret(messenger.webrtc.turnCredential) } : messenger.webrtc
  })
  const contacts = (store.get('contacts') || []).map(c => ({
    ...c,
    pin: decryptSecret(c.pin),
    messengerPin: decryptSecret(c.messengerPin)
  }))
  syncMessengerContacts(contacts)
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
    sandbox: true,
    preload: join(__dirname, '../preload/browserView.js')
  }
  if (partition) webPreferences.partition = partition

  const view = new BrowserView({ webPreferences })
  // A BrowserView paints transparent by default, so any page that does not set
  // its own opaque background lets the launcher's forest-green shell show
  // through behind the text — which is unreadable, and is what a real browser
  // would never do. Mental Floss is one such site (<body> carries no background
  // at all), but the problem is general, so fix it for every embedded site
  // rather than per-site. White is what a browser uses for the same case.
  view.setBackgroundColor('#ffffff')
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

  // Keyboard shortcuts for the Back and Home buttons. While Jean is on a
  // website the BrowserView holds keyboard focus, so the launcher renderer never
  // sees these keys — they must be intercepted here in the main process.
  //   Alt+Left  → Back  (same as the on-screen Back button; overrides Chromium's
  //               built-in Alt+Left so "no history" still closes + goes home)
  //   Alt+Down  → Home  (same as the on-screen Home button)
  view.webContents.on('before-input-event', (event, input) => {
    if (input.type !== 'keyDown' || !input.alt) return
    if (input.key === 'ArrowLeft') {
      event.preventDefault()
      browserGoBack()
    } else if (input.key === 'ArrowDown') {
      event.preventDefault()
      forceGoHome()
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
    if (currentUrl.includes('mentalfloss.com')) {
      view.webContents.insertCSS(MENTALFLOSS_AD_CSS).catch(() => {})
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
