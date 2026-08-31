import { BrowserWindow, screen, globalShortcut, app } from 'electron'
import { join } from 'path'
import { writeFileSync } from 'fs'
import { logActivity } from './store.js'
import { forceGoHome, closeEmbeddedBrowser } from './ipc.js'

// Kept for the global admin shortcut — shortcut handlers outlive the
// createWindows() call and need the current admin window
let adminRef = null

export function createWindows() {
  const displays = screen.getAllDisplays()
  // Prefer the largest display for launcher (external monitor), smallest for admin (laptop)
  const sorted = [...displays].sort((a, b) => {
    const aSize = a.size.width * a.size.height
    const bSize = b.size.width * b.size.height
    return bSize - aSize
  })

  const launcherDisplay = sorted[0]
  const adminDisplay = sorted.length > 1 ? sorted[sorted.length - 1] : sorted[0]

  const launcher = createLauncherWindow(launcherDisplay)
  const admin = createAdminWindow(adminDisplay)
  adminRef = admin

  return { launcher, admin }
}

function createLauncherWindow(display) {
  const { x, y, width, height } = display.bounds

  const isDev = process.env.NODE_ENV === 'development'

  const win = new BrowserWindow({
    x,
    y,
    width: isDev ? Math.min(width, 1280) : width,
    height: isDev ? Math.min(height, 800) : height,
    fullscreen: !isDev,
    frame: isDev,
    icon: join(__dirname, '../../resources/icon.png'),
    alwaysOnTop: !isDev,
    resizable: isDev,
    movable: isDev,
    skipTaskbar: !isDev,
    backgroundColor: '#3c3c54',
    webPreferences: {
      preload: join(__dirname, '../preload/launcher.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      webviewTag: true
    }
  })

  if (process.env.NODE_ENV === 'development') {
    const url = process.env.ELECTRON_RENDERER_URL + '/launcher/index.html'
    console.log('[launcher] loading:', url)
    win.webContents.on('did-fail-load', (e, code, desc) => console.error('[launcher] load failed:', code, desc, url))
    win.loadURL(url)
    win.webContents.openDevTools({ mode: 'detach' })
  } else {
    win.loadFile(join(__dirname, '../renderer/launcher/index.html'))
  }

  // Intercept keyboard escapes within this window
  win.on('focus', () => registerLauncherShortcuts(win))
  win.on('blur', () => {
    globalShortcut.unregisterAll()
    registerAlwaysOnShortcuts(win)
  })

  // Start with always-on shortcuts registered
  registerAlwaysOnShortcuts(win)

  return win
}

function createAdminWindow(display) {
  const { x, y, width, height } = display.bounds

  const win = new BrowserWindow({
    x: x + 20,
    y: y + 20,
    width: Math.min(1100, width - 40),
    height: Math.min(820, height - 40),
    title: "Grandma's Launcher — Admin",
    icon: join(__dirname, '../../resources/icon.png'),
    webPreferences: {
      preload: join(__dirname, '../preload/admin.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  if (process.env.NODE_ENV === 'development') {
    const url = process.env.ELECTRON_RENDERER_URL + '/admin/index.html'
    console.log('[admin] loading:', url)
    win.webContents.on('did-fail-load', (e, code, desc) => console.error('[admin] load failed:', code, desc, url))
    win.loadURL(url)
  } else {
    win.loadFile(join(__dirname, '../renderer/admin/index.html'))
  }

  // forceShowAdmin() raises this window above the kiosk launcher; drop back to
  // a normal window as soon as the caregiver clicks away so it doesn't cover
  // Jean's screen forever
  win.on('blur', () => {
    if (!win.isDestroyed() && win.isAlwaysOnTop()) win.setAlwaysOnTop(false)
  })

  return win
}

// Bring the admin panel to the front even over the fullscreen always-on-top
// launcher (screen-saver z-level beats the launcher's own)
export function forceShowAdmin() {
  const win = adminRef
  if (!win || win.isDestroyed()) return
  if (win.isMinimized()) win.restore()
  win.show()
  win.setAlwaysOnTop(true, 'screen-saver')
  win.focus()
  logActivity('admin-shortcut-opened')
}

function registerLauncherShortcuts(win) {
  // Prevent common escape keys from exiting the launcher
  const blocked = ['Alt+F4', 'Alt+Tab', 'Super', 'Meta']
  blocked.forEach(key => {
    try {
      globalShortcut.register(key, () => {
        // Silently consume — keep focus on launcher
        win.focus()
      })
    } catch {
      // Some keys can't be registered; ignore
    }
  })

  // Caregiver escape: Ctrl+Shift+Escape restores normal Windows access
  globalShortcut.register('Ctrl+Shift+Escape', () => {
    win.setAlwaysOnTop(false)
    globalShortcut.unregisterAll()
    registerAlwaysOnShortcuts(win)
  })

  // Secret shrink: Ctrl+Shift+W collapses the launcher to a small floating window
  // so the caregiver can reach the desktop. Tray → "Show Launcher" restores it.
  globalShortcut.register('Ctrl+Shift+W', () => {
    shrinkLauncher(win)
  })

  // Caregiver panel: Ctrl+Shift+A forces the admin window above the launcher
  globalShortcut.register('Ctrl+Shift+A', forceShowAdmin)

  // Full exit: Ctrl+Shift+Q quits the launcher entirely
  globalShortcut.register('Ctrl+Shift+Q', quitLauncher)

  // Recover a wedged screen: Ctrl+Shift+R reloads the launcher UI without a
  // reboot. The process stays up so the watchdog never trips.
  globalShortcut.register('Ctrl+Shift+R', () => reloadLauncher(win))
}

// Reload the launcher renderer in place. Tears down any embedded BrowserView
// first (it's owned by the main process, so a plain renderer reload would
// leave it floating over the fresh page).
function reloadLauncher(win) {
  if (!win || win.isDestroyed()) return
  logActivity('launcher-reload-shortcut')
  closeEmbeddedBrowser()
  win.webContents.reloadIgnoringCache()
}

// Quit for real. The external watchdog (watchdog.ps1) relaunches the kiosk
// whenever the heartbeat goes stale — even when no process is running — so a
// plain app.quit() would be undone within a minute. Dropping quit-flag.txt
// next to the heartbeat makes the watchdog stand down; the flag is cleared on
// the next launcher start (auto-start task, manual launch, or reboot).
export function quitLauncher() {
  logActivity('launcher-quit-shortcut')
  try {
    writeFileSync(join(app.getPath('userData'), 'quit-flag.txt'), String(Date.now()))
  } catch {
    // If the flag can't be written, still quit — the watchdog may relaunch,
    // which is the safe failure mode for a kiosk.
  }
  app.quit()
}

export function shrinkLauncher(win) {
  if (!win || win.isDestroyed()) return

  // Tell the renderer to close any embedded browser and return to the home screen
  // before we resize, otherwise the BrowserView dimensions would be wrong
  win.webContents.send('launcher:go-home')

  win.setFullScreen(false)
  win.setAlwaysOnTop(false)
  win.setSkipTaskbar(false)   // Show on taskbar so caregiver can find it
  win.setResizable(true)
  win.setMovable(true)
  // Size to a compact corner window
  win.setSize(480, 320)
  win.setPosition(40, 40)
  globalShortcut.unregisterAll()
  registerAlwaysOnShortcuts(win)
}

export function expandLauncher(win) {
  if (!win || win.isDestroyed()) return
  if (app.isPackaged) {
    win.setSkipTaskbar(true)   // Hide from taskbar again in kiosk mode
    win.setFullScreen(true)
    win.setAlwaysOnTop(true, 'screen-saver')
    win.setResizable(false)
    win.setMovable(false)
  }
  win.show()
  win.focus()
}

function registerAlwaysOnShortcuts(win) {
  const f24Registered = globalShortcut.register('F24', () => {
    if (win && !win.isAlwaysOnTop()) return
    forceGoHome()
    logActivity('f24-home-pressed')
  })
  if (!f24Registered) {
    logActivity('f24-registration-failed')
    console.warn('[F24] Could not register F24 shortcut — key may not exist on this keyboard')
  }

  // Admin panel must be reachable regardless of which window has focus —
  // this set replaces the launcher set on blur, so register it here too
  globalShortcut.register('Ctrl+Shift+A', forceShowAdmin)

  // Full exit must work regardless of focus too
  globalShortcut.register('Ctrl+Shift+Q', quitLauncher)

  // Reload recovery — keep it available in the shrunk/always-on state too
  globalShortcut.register('Ctrl+Shift+R', () => reloadLauncher(win))
}

