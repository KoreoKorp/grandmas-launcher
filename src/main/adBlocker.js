import { app } from 'electron'
import { ElectronBlocker } from '@ghostery/adblocker-electron'
import { readFile, writeFile } from 'fs/promises'
import { join } from 'path'

let blocker = null

// "Ads only" (not ads+tracking) — a narrower filter list means less
// detection surface against sites that actively fight adblockers
// (YouTube, some news sites), which matters more here than the privacy
// upside of also stripping trackers.
export async function initAdBlocker() {
  const cachePath = join(app.getPath('userData'), 'adblock-engine.bin')
  try {
    blocker = await ElectronBlocker.fromPrebuiltAdsOnly(fetch, {
      path: cachePath,
      read: readFile,
      write: writeFile
    })
  } catch (err) {
    console.warn('[ad-blocker] Failed to initialize, browsing will proceed unfiltered:', err.message)
  }
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
