// Shared text-to-speech helper. Kept as one module (rather than each
// component calling window.speechSynthesis directly) so there's a single
// place that owns "what rate/pitch does read-aloud use" and so starting a
// new utterance always cancels whatever was playing before — without that,
// tapping "Read aloud" on a second card while the first is still speaking
// would queue rather than interrupt, which reads as the app being stuck.

export const hasTTS = typeof window !== 'undefined' && !!window.speechSynthesis

let currentUtterance = null

/**
 * Speak `text` aloud. Calling this again (from anywhere) cancels whatever
 * is currently speaking first.
 * @param {string} text
 * @param {{ rate?: number, pitch?: number, onStart?: () => void, onEnd?: () => void }} [opts]
 */
export function speak(text, opts = {}) {
  if (!hasTTS || !text) return
  window.speechSynthesis.cancel()
  const utt = new SpeechSynthesisUtterance(text)
  utt.rate = opts.rate ?? 0.9
  utt.pitch = opts.pitch ?? 1.0
  utt.onstart = () => opts.onStart?.()
  utt.onend = () => { currentUtterance = null; opts.onEnd?.() }
  utt.onerror = () => { currentUtterance = null; opts.onEnd?.() }
  currentUtterance = utt
  window.speechSynthesis.speak(utt)
}

export function stopSpeaking() {
  window.speechSynthesis?.cancel()
  currentUtterance = null
}

export function isSpeaking() {
  return hasTTS && window.speechSynthesis.speaking
}
