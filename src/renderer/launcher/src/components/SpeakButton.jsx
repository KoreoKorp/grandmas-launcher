import React, { useState } from 'react'
import { hasTTS, speak, stopSpeaking } from '../utils/speech'

/**
 * Small "read this aloud" button. Drop next to any block of text — the
 * daily note, a reminder, a photo caption — so it can be spoken on tap
 * without every caller reimplementing SpeechSynthesis wiring.
 *
 * If some other SpeakButton (or AIBuddy) starts talking, this instance's
 * "speaking" highlight drops on its own: speech.js's speak() cancels
 * whatever utterance was active before starting the new one, and Chromium
 * fires that cancelled utterance's own onerror handler — which is wired to
 * this button's onEnd callback below — so no polling is needed to notice.
 */
export default function SpeakButton({ text, size = 'md', style }) {
  const [speaking, setSpeaking] = useState(false)

  if (!hasTTS || !text?.trim()) return null

  function toggle(e) {
    e.stopPropagation()
    if (speaking) {
      stopSpeaking()
      setSpeaking(false)
    } else {
      speak(text, {
        onStart: () => setSpeaking(true),
        onEnd:   () => setSpeaking(false)
      })
    }
  }

  const dims = size === 'lg' ? 52 : size === 'sm' ? 32 : 40
  const fontSize = size === 'lg' ? '1.4em' : size === 'sm' ? '0.95em' : '1.15em'

  return (
    <button
      onClick={toggle}
      aria-label={speaking ? 'Stop reading aloud' : 'Read aloud'}
      title={speaking ? 'Stop reading aloud' : 'Read aloud'}
      style={{
        width: dims,
        height: dims,
        borderRadius: '50%',
        border: speaking ? '1.5px solid var(--accent)' : '1.5px solid var(--border)',
        background: speaking ? 'var(--accent-dim)' : 'var(--bg-card)',
        color: speaking ? 'var(--accent)' : 'var(--text-secondary)',
        fontSize,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        flexShrink: 0,
        transition: 'background var(--transition-fast, 0.15s), border-color var(--transition-fast, 0.15s)',
        ...style
      }}
    >
      {speaking ? '⏸' : '🔊'}
    </button>
  )
}
