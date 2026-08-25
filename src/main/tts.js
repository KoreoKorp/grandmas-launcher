// Cloud TTS for Buddy via the Microsoft Edge Read-Aloud service (the same
// natural voices Edge uses). No API key needed. Falls back gracefully —
// the caller (renderer) drops to local speechSynthesis on any error.
import { MsEdgeTTS, OUTPUT_FORMAT } from 'msedge-tts'
import { store } from './store.js'

const instances = new Map() // voice -> ready client

export function cloudTTSEnabled() {
  return store.get('ai.cloudTTS') !== false // default on
}

export function ttsVoice() {
  return store.get('ai.ttsVoice') || 'en-US-AriaNeural'
}

async function getClient(voice) {
  let tts = instances.get(voice)
  if (!tts) {
    tts = new MsEdgeTTS()
    await tts.setMetadata(voice, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3)
    instances.set(voice, tts)
  }
  return tts
}

export async function synthesize(text) {
  const voice = ttsVoice()
  const tts = await getClient(voice)
  const { audioStream } = tts.toStream(text)
  const chunks = []
  for await (const chunk of audioStream) chunks.push(chunk)
  const audio = Buffer.concat(chunks)
  if (!audio.length) throw new Error('empty audio')
  return audio.toString('base64')
}

// Drop a cached client after a failure so the next call reconnects fresh.
export function dropClient(voice) {
  instances.delete(voice || ttsVoice())
}
