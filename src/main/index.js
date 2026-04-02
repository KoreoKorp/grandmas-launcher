import { app, Tray, Menu, nativeImage } from 'electron'
import { join } from 'path'
import { exec } from 'child_process'
import { createWindows, expandLauncher } from './windows.js'
import { registerIPC, setWindows } from './ipc.js'
import { fetchWeather } from './weather.js'
import { store } from './store.js'

// Prevent multiple instances
if (!app.requestSingleInstanceLock()) {
  app.quit()
  process.exit(0)
}

let tray = null
let launcher = null
let admin = null

app.on('second-instance', () => {
  // If someone tries to run a second instance, focus the admin window
  if (admin && !admin.isDestroyed()) {
    if (admin.isMinimized()) admin.restore()
    admin.focus()
  }
})

app.whenReady().then(() => {
  registerIPC()

  const windows = createWindows()
  launcher = windows.launcher
  admin = windows.admin
  setWindows(launcher, admin)

  setupTray()
  setupWeatherPolling()
  setupAutoStart()

  app.on('activate', () => {
    if (!launcher || launcher.isDestroyed()) {
      const w = createWindows()
      launcher = w.launcher
      admin = w.admin
      setWindows(launcher, admin)
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

function setupTray() {
  const iconPath = join(__dirname, '../../resources/tray.png')
  const icon = nativeImage.createFromPath(iconPath)
  tray = new Tray(icon.isEmpty() ? nativeImage.createEmpty() : icon)
  tray.setToolTip("Grandma's Launcher")

  const menu = Menu.buildFromTemplate([
    {
      label: 'Open Admin Panel',
      click: () => {
        if (admin && !admin.isDestroyed()) {
          admin.show()
          admin.focus()
        }
      }
    },
    {
      label: 'Show Launcher (full screen)',
      click: () => expandLauncher(launcher)
    },
    { type: 'separator' },
    { label: 'Quit', click: () => app.quit() }
  ])

  tray.setContextMenu(menu)
  tray.on('double-click', () => {
    if (admin && !admin.isDestroyed()) {
      admin.show()
      admin.focus()
    }
  })
}

function setupWeatherPolling() {
  fetchWeather().catch(() => {})
  // Re-fetch every 30 minutes
  setInterval(() => fetchWeather().catch(() => {}), 30 * 60 * 1000)
}

function setupAutoStart() {
  if (!app.isPackaged) return

  // Use Windows Task Scheduler for auto-start so the app always runs elevated
  // (no UAC popup on each login). Only register once after first install.
  if (!store.get('scheduledTaskCreated')) {
    registerElevatedScheduledTask()
  }
}

function registerElevatedScheduledTask() {
  const exePath = process.execPath.replace(/\\/g, '\\\\')
  const taskName = "Grandmas Launcher"

  // Create a scheduled task that runs at login with highest privileges (no UAC)
  const ps = `$action = New-ScheduledTaskAction -Execute '${process.execPath}'
$trigger = New-ScheduledTaskTrigger -AtLogOn
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries
$principal = New-ScheduledTaskPrincipal -UserId "$env:USERNAME" -RunLevel Highest -LogonType Interactive
Register-ScheduledTask -TaskName "${taskName}" -Action $action -Trigger $trigger -Settings $settings -Principal $principal -Force`

  exec(`powershell -NonInteractive -Command "${ps.replace(/"/g, '\\"')}"`, (err) => {
    if (!err) {
      // Remove the old login item (replaced by scheduled task)
      app.setLoginItemSettings({ openAtLogin: false })
      store.set('scheduledTaskCreated', true)
    }
  })
}
