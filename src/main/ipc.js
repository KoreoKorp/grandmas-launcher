import { ipcMain, shell, BrowserView, dialog } from 'electron'
import { store, logActivity } from './store.js'
import { fetchWeather, clearWeatherCache } from './weather.js'
import { expandLauncher } from './windows.js'

let launcherWin = null
let adminWin = null
let embeddedView = null // BrowserView for embedded websites

export function setWindows(launcher, admin) {
  launcherWin = launcher
  adminWin = admin
}

export function setEmbeddedView(view) {
  embeddedView = view
}

export function registerIPC() {
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
    messenger: store.get('messenger'),
    userName: store.get('userName')
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

    try {
      const { spawn } = await import('child_process')
      const child = spawn(path, [], { detached: true, stdio: 'ignore' })
      child.unref()
      child.on('error', (err) => {
        console.error('[launch-app] spawn error:', err.message)
      })
      logActivity('app-launched', path)
      return { ok: true }
    } catch (err) {
      console.error('[launch-app] failed:', err.message)
      return { ok: false, error: err.message }
    }
  })

  ipcMain.on('launcher:log-activity', (event, { type, detail }) => {
    logActivity(type, detail)
  })

  // ── Admin ─────────────────────────────────────────────────────────────────

  ipcMain.handle('admin:get-config', () => store.store)

  ipcMain.handle('admin:set', (event, { key, value }) => {
    store.set(key, value)
    // Bust weather cache when location/unit changes so next fetch is fresh
    if (key === 'weather') clearWeatherCache()
    // Push config update to launcher
    if (launcherWin && !launcherWin.isDestroyed()) {
      launcherWin.webContents.send('launcher:config-updated', { key, value })
    }
    return { ok: true }
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

  ipcMain.on('admin:show-launcher', () => {
    expandLauncher(launcherWin)
  })
}

function openEmbeddedBrowser(url, partition = null) {
  if (!launcherWin) return
  closeEmbeddedBrowser()

  const webPreferences = { contextIsolation: true, nodeIntegration: false }
  if (partition) webPreferences.partition = partition

  const view = new BrowserView({ webPreferences })
  launcherWin.addBrowserView(view)
  embeddedView = view
  setEmbeddedView(view)

  const bounds = launcherWin.getContentBounds()
  const NAV_WIDTH = 300
  view.setBounds({ x: NAV_WIDTH, y: 0, width: bounds.width - NAV_WIDTH, height: bounds.height })
  view.webContents.loadURL(url)

  // Block any new windows from opening in the system browser — keep all navigation inside the BrowserView
  view.webContents.setWindowOpenHandler(({ url: newUrl }) => {
    view.webContents.loadURL(newUrl)
    return { action: 'deny' }
  })

  // Tell launcher renderer we entered browser mode
  launcherWin.webContents.send('launcher:browser-opened', { url })
}

function closeEmbeddedBrowser() {
  if (!embeddedView || !launcherWin) return
  launcherWin.removeBrowserView(embeddedView)
  embeddedView.webContents.destroy()
  embeddedView = null
  setEmbeddedView(null)

  if (launcherWin && !launcherWin.isDestroyed()) {
    launcherWin.webContents.send('launcher:browser-closed')
  }
}
