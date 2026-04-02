import { BrowserWindow, screen, globalShortcut, app } from 'electron'
import { join } from 'path'

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
    alwaysOnTop: !isDev,
    resizable: isDev,
    movable: isDev,
    skipTaskbar: !isDev,
    backgroundColor: '#3c3c54',
    webPreferences: {
      preload: join(__dirname, '../preload/launcher.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
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
  win.on('blur', () => globalShortcut.unregisterAll())

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

  return win
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
  })
}
