// src/preload/browserView.js
// Injected into every BrowserView. Two responsibilities:
//   1. Detect user activity and report it to main for inactivity timer resets.
//   2. Block browser notification permission prompts so websites can't ask Jean
//      to enable push notifications (she has no way to dismiss them safely).
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

// ── Block notification permission prompts ─────────────────────────────────
// Websites check Notification.permission and call Notification.requestPermission
// before showing their custom "subscribe to notifications" modals. By overriding
// these as non-configurable/non-writable, page scripts cannot undo the override.
try {
  Object.defineProperty(window, 'Notification', {
    value: Object.assign(
      function Notification() { return {} },
      {
        permission: 'denied',
        requestPermission: () => Promise.resolve('denied'),
        maxActions: 0
      }
    ),
    writable: false,
    configurable: false
  })
} catch {
  // Already defined non-configurably by some browser engine version — ignore
}
