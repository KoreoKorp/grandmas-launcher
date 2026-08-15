import { app } from 'electron'
import { ElectronBlocker } from '@ghostery/adblocker-electron'
import { readFile, writeFile } from 'fs/promises'
import { join } from 'path'

let blocker = null

const REFRESH_INTERVAL_MS = 24 * 60 * 60 * 1000 // once a day

// "Ads only" (not ads+tracking) — a narrower filter list means less
// detection surface against sites that actively fight adblockers
// (YouTube, some news sites), which matters more here than the privacy
// upside of also stripping trackers.
async function loadFilterList() {
  const cachePath = join(app.getPath('userData'), 'adblock-engine.bin')
  try {
    // fromPrebuiltAdsOnly checks for a newer list each time it's called —
    // this is the library's own documented refresh mechanism, there's no
    // separate .update() method on the returned instance.
    blocker = await ElectronBlocker.fromPrebuiltAdsOnly(fetch, {
      path: cachePath,
      read: readFile,
      write: writeFile
    })
  } catch (err) {
    console.warn('[ad-blocker] Failed to initialize, browsing will proceed unfiltered:', err.message)
  }
}

export async function initAdBlocker() {
  await loadFilterList()
  // This kiosk runs unattended for months at a stretch — without a periodic
  // refresh the filter list only ever reflects whatever was current at the
  // last app restart, gradually losing coverage as new ad domains appear.
  // Re-fetching just replaces the module-level `blocker` reference; it
  // doesn't touch sessions already opened with the old one (their listeners
  // stay as they were), but enableAdBlockingFor() is called fresh every
  // time a website tile opens a new BrowserView, so any tile opened after a
  // refresh picks up the updated list automatically.
  setInterval(loadFilterList, REFRESH_INTERVAL_MS)
}

// Fails open — if the engine hasn't finished loading yet (e.g. very first
// launch, no cached filter list), the embedded browser still opens normally.
export function enableAdBlockingFor(session) {
  if (!blocker) return
  try {
    blocker.enableBlockingInSession(session)
  } catch (err) {
    console.warn('[ad-blocker] Failed to enable for session:', err.message)
  }
}
