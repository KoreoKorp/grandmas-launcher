// src/preload/browserView.js
// Injected into every BrowserView. Detects user activity and reports
// it to the main process so the inactivity timer resets.
import { ipcRenderer } from 'electron'

const THROTTLE_MS = 5000  // send at most once per 5s to avoid IPC spam

let lastSent = 0

function heartbeat() {
  const now = Date.now()
  if (now - lastSent < THROTTLE_MS) return
  lastSent = now
  ipcRenderer.send('browserView:activity')
}

window.addEventListener('click',      heartbeat, { capture: true, passive: true })
window.addEventListener('mousemove',  heartbeat, { capture: true, passive: true })
window.addEventListener('keydown',    heartbeat, { capture: true, passive: true })
window.addEventListener('scroll',     heartbeat, { capture: true, passive: true })
window.addEventListener('touchstart', heartbeat, { capture: true, passive: true })
