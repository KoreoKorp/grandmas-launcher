// Shared text-to-speech helper. Kept as one module (rather than each
// component calling window.speechSynthesis directly) so there's a single
// place that owns "what rate/pitch does read-aloud use" and so starting a
// new utterance always cancels whatever was playing before — without that,
// tapping "Read aloud" on a second card while the first is still speaking
// would queue rather than interrupt, which reads as the app being stuck.

export const hasTTS = typeof window !== 'undefined' && !!window.speechSynthesis

let currentUtterance = null
// Bumped on every speak()/stopSpeaking() call so a delayed speak() (see
// below) can tell whether something newer has superseded it before it fires.
let speakToken = 0

/**
 * Speak `text` aloud. Calling this again (from anywhere) cancels whatever
 * is currently speaking first.
 *
 * cancel() is processed asynchronously by the platform speech service —
 * calling speak() synchronously right after it is a known Chromium bug
 * where the new utterance can be silently dropped (onstart never fires,
 * nothing is heard, no error). A short delay lets the cancel land first.
 * The token guard means only the most recent speak() call in a rapid
 * sequence actually starts — an earlier one that's still waiting out its
 * delay when a newer one arrives is dropped rather than briefly speaking
 * over the newer text.
 *
 * @param {string} text
 * @param {{ rate?: number, pitch?: number, onStart?: () => void, onEnd?: () => void }} [opts]
 */
export function speak(text, opts = {}) {
  if (!hasTTS || !text) return
  window.speechSynthesis.cancel()
  const myToken = ++speakToken
  setTimeout(() => {
    if (myToken !== speakToken) return // superseded by a newer speak()/stopSpeaking() call
    const utt = new SpeechSynthesisUtterance(text)
    utt.rate = opts.rate ?? 0.9
    utt.pitch = opts.pitch ?? 1.0
    utt.onstart = () => opts.onStart?.()
    utt.onend = () => { currentUtterance = null; opts.onEnd?.() }
    utt.onerror = () => { currentUtterance = null; opts.onEnd?.() }
    currentUtterance = utt
    window.speechSynthesis.speak(utt)
  }, 50)
}

export function stopSpeaking() {
  window.speechSynthesis?.cancel()
  currentUtterance = null
  speakToken++ // invalidate any speak() still waiting out its post-cancel delay
}

export function isSpeaking() {
  return hasTTS && window.speechSynthesis.speaking
}
