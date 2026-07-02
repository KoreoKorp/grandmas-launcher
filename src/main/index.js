import { app, Tray, Menu, nativeImage, globalShortcut, powerMonitor, desktopCapturer } from 'electron'
import { join } from 'path'
import { exec } from 'child_process'
import dns from 'dns'
import { writeFile } from 'fs/promises'
import { io } from 'socket.io-client'
import { createWindows, expandLauncher } from './windows.js'
import { registerIPC, setWindows, forceGoHome, setupLauncherPermissions, setSignalEmitter, closeEmbeddedBrowserSilent } from './ipc.js'
import { fetchWeather } from './weather.js'
import { store, logActivity } from './store.js'
import { initMessengerServer, getMessengerUrl, stopMessengerServer } from './serverManager.js'

// Prevent multiple instances
if (!app.requestSingleInstanceLock()) {
  app.quit()
  process.exit(0)
}

let tray = null
let launcher = null
let admin = null
let socket = null
let isCallActive = false  // Guards disconnect from spuriously firing call-ended

app.on('second-instance', () => {
  // If someone tries to run a second instance, focus the admin window
  if (admin && !admin.isDestroyed()) {
    if (admin.isMinimized()) admin.restore()
    admin.focus()
  }
})

app.whenReady().then(async () => {
  await initMessengerServer()

  registerIPC()

  const windows = createWindows()
  launcher = windows.launcher
  admin = windows.admin
  setWindows(launcher, admin)
  setupLauncherPermissions(launcher)
  setupSignaling()

  setupTray()
  setupWeatherPolling()
  setupVolumeEnforcement()
  setupRemoteConfigSync()
  setupSelfHealingWiFi()
  setupPowerMonitor()
  setupScreenMirroring()
  setupAutoStart()
  sendBootHealthReport()

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

app.on('will-quit', () => {
  globalShortcut.unregisterAll()
  if (socket) socket.disconnect()
  stopMessengerServer()
})

function setupSignaling() {
  const url = getMessengerUrl()
  if (!url) return

  const deviceId = store.get('deviceId')
  const authToken = store.get('authToken')

  socket = io(url, {
    reconnection: true,
    reconnectionDelay: 5000,
    timeout: 10000
  })

  // Wrap emitter so we can track call state without circular imports
  setSignalEmitter((event, data) => {
    if (event === 'call-ended' || event === 'call-declined') isCallActive = false
    socket?.emit(event, data)
  })

  socket.on('connect', () => {
    socket.emit('register', { deviceId, authToken })
    logActivity('signaling-connected', url)
  })

  socket.on('disconnect', () => {
    logActivity('signaling-disconnected')
    // Only forward call-ended if a call was actually in progress —
    // transient WiFi blips should not trigger spurious hangup in the renderer
    if (isCallActive) {
      isCallActive = false
      if (launcher && !launcher.isDestroyed()) {
        launcher.webContents.send('launcher:call-ended', { from: 'disconnect' })
      }
    }
  })

  socket.on('incoming-video-call', ({ from, callerName, offer }) => {
    logActivity('incoming-call', callerName)
    isCallActive = true
    // CRITICAL: Close any active BrowserView FIRST — BrowserViews paint at OS
    // level on top of the BrowserWindow and will obscure the React overlay
    closeEmbeddedBrowserSilent()
    if (launcher && !launcher.isDestroyed()) {
      launcher.webContents.send('launcher:incoming-call', { from, callerName, offer })
    }
  })

  socket.on('ice-candidate', ({ from, candidate }) => {
    if (launcher && !launcher.isDestroyed()) {
      launcher.webContents.send('launcher:ice-candidate', { from, candidate })
    }
  })

  socket.on('call-ended', ({ from }) => {
    logActivity('call-ended-remote', from)
    isCallActive = false
    if (launcher && !launcher.isDestroyed()) {
      launcher.webContents.send('launcher:call-ended', { from })
    }
  })
}

// Fields the remote server may override. Local admin wins on everything else.
const REMOTE_SYNCED_KEYS = ['tiles', 'dailyNote', 'reminders']
let isSyncing = false

const REMOTE_VALIDATORS = {
  tiles:     (v) => Array.isArray(v) && v.every(t => t && typeof t.id === 'string' && typeof t.label === 'string'),
  dailyNote: (v) => typeof v === 'string',
  reminders: (v) => Array.isArray(v)
}

async function syncRemoteConfig() {
  if (isSyncing) return
  isSyncing = true
  const url = store.get('remoteConfig.url')
  if (!url) { isSyncing = false; return }

  try {
    logActivity('remote-config-sync-attempt', url)
    const res = await fetch(url, { signal: AbortSignal.timeout(10_000) })
    if (!res.ok) {
      logActivity('remote-config-sync-failed', `HTTP ${res.status}`)
      return
    }

    const remote = await res.json()
    let changed = 0

    for (const key of REMOTE_SYNCED_KEYS) {
      if (remote[key] === undefined) continue
      if (!REMOTE_VALIDATORS[key]?.(remote[key])) {
        console.warn(`[remote-sync] invalid shape for key "${key}" — skipping`)
        continue
      }
      const local = store.get(key)
      if (JSON.stringify(remote[key]) === JSON.stringify(local)) continue

      store.set(key, remote[key])
      logActivity('remote-config-sync-changed', key)
      changed++

      if (launcher && !launcher.isDestroyed()) {
        launcher.webContents.send('launcher:config-updated', { key, value: remote[key] })
      }
    }

    if (changed === 0) logActivity('remote-config-sync-ok', 'no changes')
    store.set('remoteConfig.lastSyncedAt', Date.now())
  } catch (err) {
    logActivity('remote-config-sync-failed', err.message)
    console.log('[remote-sync] skipped:', err.message)
  } finally {
    isSyncing = false
  }
}

function setupRemoteConfigSync() {
  syncRemoteConfig()
  setInterval(syncRemoteConfig, 5 * 60 * 1000)
}

function setupVolumeEnforcement() {
  function enforceVolume() {
    const raw = store.get('display.volumeLevel') ?? 40
    const safeLevel = Math.max(0, Math.min(100, Math.trunc(Number(raw))))
    if (!Number.isFinite(safeLevel)) return

    const csharpSrc = [
      'using System;',
      'using System.Runtime.InteropServices;',
      '[ComImport, Guid("BCDE0395-E52F-467C-8E3D-C4579291692E"), ClassInterface(ClassInterfaceType.None)]',
      'public class MMDeviceEnumerator {}',
      '[Guid("A95664D2-9614-4F35-A746-DE8DB63617E6"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]',
      'public interface IMMDeviceEnumerator {',
      '    int f1(); int GetDefaultAudioEndpoint(int df, int role, [MarshalAs(UnmanagedType.Interface)] out IMMDevice d);',
      '}',
      '[Guid("D666063F-1587-4E43-81F1-B948E807363F"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]',
      'public interface IMMDevice {',
      '    int Activate(ref Guid iid, uint ctx, IntPtr p, [MarshalAs(UnmanagedType.IUnknown)] out object o);',
      '    int f1(); int f2(); int f3();',
      '}',
      '[Guid("5CDF2C82-841E-4546-9722-0CF74078229A"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]',
      'public interface IAudioEndpointVolume {',
      '    int f1(); int f2(); int f3();',
      '    int SetMasterVolumeLevelScalar(float f, Guid g); int f4();',
      '    int GetMasterVolumeLevelScalar(out float f);',
      '}',
      'public class VolumeHelper {',
      '    public static void SetVolume(int pct) {',
      '        var e = new MMDeviceEnumerator();',
      '        IMMDevice d = null;',
      '        ((IMMDeviceEnumerator)e).GetDefaultAudioEndpoint(0, 1, out d);',
      '        var iid = new Guid("5CDF2C82-841E-4546-9722-0CF74078229A");',
      '        object o = null;',
      '        d.Activate(ref iid, 23, IntPtr.Zero, out o);',
      '        var v = (IAudioEndpointVolume)o;',
      '        float cur = 0f;',
      '        v.GetMasterVolumeLevelScalar(out cur);',
      '        float target = pct / 100.0f;',
      '        if (Math.Abs(cur - target) > 0.02f) {',
      '            v.SetMasterVolumeLevelScalar(target, Guid.Empty);',
      '        }',
      '    }',
      '}'
    ].join('\n')

    // DLL caching: compile once to %TEMP%\VolumeHelper.dll, reuse on subsequent calls
    const ps = [
      '$dll = "$env:TEMP\\VolumeHelper.dll"',
      'if (-not (Test-Path $dll)) {',
      "  Add-Type -TypeDefinition @'",
      csharpSrc,
      "'@ -OutputAssembly $dll -ErrorAction Stop",
      '}',
      'Add-Type -Path $dll -ErrorAction SilentlyContinue',
      `try { [VolumeHelper]::SetVolume(${safeLevel}) } catch {}`
    ].join('\n')

    // -EncodedCommand avoids all shell-escaping issues with multi-line scripts and here-strings
    const encoded = Buffer.from(ps, 'utf16le').toString('base64')
    exec(
      `powershell -NonInteractive -WindowStyle Hidden -EncodedCommand ${encoded}`,
      (err) => { if (err) console.warn('[volume] PowerShell error:', err.message) }
    )
  }

  enforceVolume()
  setInterval(enforceVolume, 30 * 1000)
}

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

// ── Phase 3: System Resilience & Auto-Healing ─────────────────────────────────

let isOnline = true
let offlineSince = 0

function setupSelfHealingWiFi() {
  function checkInternet() {
    dns.resolve('8.8.8.8', (err) => {
      const currentlyOnline = !err

      // State transition
      if (currentlyOnline !== isOnline) {
        isOnline = currentlyOnline
        logActivity(isOnline ? 'network-restored' : 'network-lost')

        // Push IPC state to renderers for Pre-Cached Safe Mode (hide web tiles)
        if (launcher && !launcher.isDestroyed()) {
          launcher.webContents.send('launcher:network-status', { isOnline })
        }
      }

      if (currentlyOnline) {
        offlineSince = 0
      } else {
        if (offlineSince === 0) offlineSince = Date.now()
        
        // If offline for more than 60 seconds, run PowerShell restart on Wi-Fi adapter
        if (Date.now() - offlineSince >= 60 * 1000) {
          logActivity('wifi-restart-triggered', 'Offline > 60s')
          offlineSince = 0 // Reset countdown after attempt
          
          exec(`powershell -NonInteractive -WindowStyle Hidden -Command "Restart-NetAdapter -Name 'Wi-Fi' -ErrorAction SilentlyContinue"`, (execErr) => {
            if (execErr) console.warn('[wifi-heal] PowerShell error:', execErr.message)
            else logActivity('wifi-restart-completed')
          })
        }
      }
    })
  }

  // Check every 10 seconds
  setInterval(checkInternet, 10 * 1000)
  checkInternet()
}

function setupPowerMonitor() {
  powerMonitor.on('on-battery', () => {
    logActivity('power-unplugged', 'System is now on battery')
    if (admin && !admin.isDestroyed()) {
      admin.webContents.send('admin:power-status', { status: 'battery' })
    }
    if (launcher && !launcher.isDestroyed()) {
      launcher.webContents.send('launcher:power-status', { status: 'battery' })
    }
  })

  powerMonitor.on('on-ac', () => {
    logActivity('power-plugged', 'System is now on AC power')
    if (admin && !admin.isDestroyed()) {
      admin.webContents.send('admin:power-status', { status: 'ac' })
    }
    if (launcher && !launcher.isDestroyed()) {
      launcher.webContents.send('launcher:power-status', { status: 'ac' })
    }
  })
}

// ── Phase 5: Caregiver Tools ───────────────────────────────────────────────

function setupScreenMirroring() {
  async function captureScreen() {
    try {
      const sources = await desktopCapturer.getSources({
        types: ['screen'],
        thumbnailSize: { width: 1280, height: 720 }
      })
      if (sources && sources.length > 0) {
        const primarySource = sources[0]
        const imgBuffer = primarySource.thumbnail.toJPEG(80)
        const mirrorPath = join(app.getPath('userData'), 'mirror.jpg')
        await writeFile(mirrorPath, imgBuffer)
        
        if (admin && !admin.isDestroyed()) {
          admin.webContents.send('admin:mirror-updated', { path: `file://${mirrorPath.replace(/\\/g, '/')}` + '?t=' + Date.now() })
        }
      }
    } catch (err) {
      console.error('[mirroring] Screen capture failed:', err)
    }
  }

  // Capture every 5 minutes
  setInterval(captureScreen, 5 * 60 * 1000)
  captureScreen()
}

function sendBootHealthReport() {
  setTimeout(async () => {
    try {
      const volume = store.get('display.volumeLevel') || 40
      const isOnBattery = powerMonitor.isOnBatteryPower()
      const reportMsg = `System Boot Report
WiFi: Checking...
Volume: ${volume}%
Power: ${isOnBattery ? 'Battery' : 'AC Plugged In'}`

      logActivity('boot-health-report-generated', reportMsg.replace(/\n/g, ' | '))

      const url           = getMessengerUrl()
      const adminPassword = store.get('messenger.adminPassword') || ''
      if (!url) return

      await fetch(`${url}/send-sys-report`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-key': adminPassword || ''
        },
        body: JSON.stringify({ message: reportMsg })
      })
    } catch (err) {
      console.warn('[health-report] Failed to send boot report:', err)
    }
  }, 15_000) // 15 seconds after boot to allow network to settle
}

// NOTE: TURN credentials are read from electron-store at server start and
// pushed live via updateMessengerConfig() when the admin saves them. The old
// fetchTurnCredentials() helper was removed — it fetched /api/turn from our own
// embedded server (whose values came from the same store) and always 401'd
// because it never sent the admin key. Family browsers now receive ICE servers
// over the socket ('ice-config') after they authenticate.
