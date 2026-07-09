import { app } from 'electron'
import { exec } from 'child_process'
import { writeFile } from 'fs/promises'
import { join } from 'path'
import { store } from './store.js'

const HEARTBEAT_INTERVAL_MS = 15 * 1000
const WATCHDOG_TASK_NAME = 'Grandmas Launcher Watchdog'

function getHeartbeatPath() {
  return join(app.getPath('userData'), 'heartbeat.txt')
}

// Writes a single fresh heartbeat immediately. Exported so callers outside the
// interval (e.g. the powerMonitor 'resume' handler) can prove the app is alive
// right after a wake, before the watchdog's next stale check.
export function writeHeartbeat() {
  return writeFile(getHeartbeatPath(), String(Date.now())).catch(() => {})
}

// Written every 15s while the main process is alive and its event loop is
// responsive. The external watchdog task treats a stale file as a hang.
export function startHeartbeat() {
  writeHeartbeat()
  setInterval(writeHeartbeat, HEARTBEAT_INTERVAL_MS)
}

// Registers a Scheduled Task (separate from the app's own auto-start task)
// that runs watchdog.ps1 every minute, indefinitely, outside the Electron
// process — so it can recover the kiosk even if the main process hangs.
export function registerWatchdogTask() {
  if (!app.isPackaged) return
  if (store.get('watchdogTaskCreated')) return

  // PowerShell escapes a single quote inside a single-quoted string by doubling
  // it. These paths get embedded in the single-quoted -Argument string below, so
  // a username like O'Brien would otherwise close the string early and break
  // Register-ScheduledTask parsing. -EncodedCommand handles the outer shell layer
  // but not PowerShell's own single-quote parsing, so the doubling is still required.
  const esc = (p) => p.replace(/'/g, "''")
  const scriptPath = esc(join(process.resourcesPath, 'watchdog', 'watchdog.ps1'))
  const heartbeatPath = esc(getHeartbeatPath())
  const exePath = esc(process.execPath)

  const ps = `$action = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument '-NonInteractive -WindowStyle Hidden -ExecutionPolicy Bypass -File "${scriptPath}" -HeartbeatPath "${heartbeatPath}" -ExePath "${exePath}"'
$trigger = New-ScheduledTaskTrigger -Once -At (Get-Date) -RepetitionInterval (New-TimeSpan -Minutes 1) -RepetitionDuration (New-TimeSpan -Days 3650)
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable -MultipleInstances IgnoreNew
$principal = New-ScheduledTaskPrincipal -UserId "$env:USERNAME" -RunLevel Highest -LogonType Interactive
Register-ScheduledTask -TaskName "${WATCHDOG_TASK_NAME}" -Action $action -Trigger $trigger -Settings $settings -Principal $principal -Force`

  // -EncodedCommand avoids shell-escaping issues with the quoted paths above.
  const encoded = Buffer.from(ps, 'utf16le').toString('base64')
  exec(`powershell -NonInteractive -WindowStyle Hidden -EncodedCommand ${encoded}`, (err) => {
    if (!err) {
      store.set('watchdogTaskCreated', true)
    } else {
      console.warn('[watchdog] Failed to register scheduled task:', err.message)
    }
  })
}
