# Grandma's Launcher — external watchdog.
#
# Runs independently of the Electron app (via a separate Scheduled Task, invoked
# every minute) so it can recover the kiosk even if the main process itself has
# hung and stopped responding to its own global shortcuts. Single-shot: checks
# once, acts if needed, exits. No long-running loop to babysit.

param(
  [Parameter(Mandatory = $true)][string]$HeartbeatPath,
  [Parameter(Mandatory = $true)][string]$ExePath,
  [int]$StaleThresholdSeconds = 90
)

$ErrorActionPreference = 'SilentlyContinue'
$logPath = Join-Path (Split-Path $HeartbeatPath -Parent) 'safety-events.log'

function Write-SafetyEvent([string]$Type, [string]$Detail) {
  $entry = @{ ts = (Get-Date).ToString('o'); type = $Type; detail = $Detail } | ConvertTo-Json -Compress
  Add-Content -Path $logPath -Value $entry -Encoding UTF8
}

if (-not (Test-Path $HeartbeatPath)) {
  # App may still be starting up for the first time — nothing to act on yet.
  exit 0
}

$watchdogMarkerPath = Join-Path (Split-Path $HeartbeatPath -Parent) 'watchdog-last-run.txt'

# Grace period after a fresh boot. If the machine has been up for less than
# the stale threshold, the app hasn't had a fair chance to prove liveness yet.
$lastBoot = (Get-CimInstance Win32_OperatingSystem).LastBootUpTime
if ($lastBoot) {
  $uptimeSeconds = ((Get-Date) - $lastBoot).TotalSeconds
  if ($uptimeSeconds -lt $StaleThresholdSeconds) {
    Set-Content -Path $watchdogMarkerPath -Value (Get-Date).ToString('o') -Encoding UTF8
    exit 0
  }
}

# Grace period after sleep/resume. LastBootUpTime does NOT change on resume
# from sleep — it's not a reboot — so the check above can never catch this
# case despite what its original comment claimed. Detect it instead by
# comparing against when this script itself last ran: this task fires every
# minute, so a gap much larger than that (via -StartWhenAvailable catching up
# right after resume) means the machine — and this task — was suspended, not
# that the app hung. The stale heartbeat is expected in that case, not
# evidence of anything wrong.
if (Test-Path $watchdogMarkerPath) {
  try {
    $lastRun = [DateTime]::Parse((Get-Content -Path $watchdogMarkerPath -Raw))
    $gapSeconds = ((Get-Date) - $lastRun).TotalSeconds
    if ($gapSeconds -gt $StaleThresholdSeconds) {
      Write-SafetyEvent 'watchdog-resume-grace' "watchdog gap ${gapSeconds}s since last run — likely sleep/resume, skipping this cycle"
      Set-Content -Path $watchdogMarkerPath -Value (Get-Date).ToString('o') -Encoding UTF8
      exit 0
    }
  } catch {
    # Malformed/missing marker — fall through and treat normally rather than block on it
  }
}
Set-Content -Path $watchdogMarkerPath -Value (Get-Date).ToString('o') -Encoding UTF8

$lastWrite = (Get-Item $HeartbeatPath).LastWriteTimeUtc
$ageSeconds = ((Get-Date).ToUniversalTime() - $lastWrite).TotalSeconds

if ($ageSeconds -lt $StaleThresholdSeconds) {
  exit 0
}

$exeName = [System.IO.Path]::GetFileNameWithoutExtension($ExePath)
# Matching by name alone would kill any process sharing it — an unrelated
# app, or a stale copy of this one running from a different install path.
# Restrict to processes actually running from the expected executable.
$proc = Get-Process -Name $exeName -ErrorAction SilentlyContinue | Where-Object { $_.Path -eq $ExePath }

Write-SafetyEvent 'watchdog-hang-detected' "heartbeat stale ${ageSeconds}s (process running: $([bool]$proc))"

if ($proc) {
  $proc | Stop-Process -Force -ErrorAction SilentlyContinue
  Start-Sleep -Seconds 2
}

try {
  Start-Process -FilePath $ExePath -ErrorAction Stop
  Write-SafetyEvent 'watchdog-relaunch-succeeded' $ExePath
} catch {
  Write-SafetyEvent 'watchdog-relaunch-failed' $_.Exception.Message
}
