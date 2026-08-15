import React, { useEffect } from 'react'
import { speak, stopSpeaking } from '../utils/speech'

export default function ConfusionOverlay({ onGoHome, onDismiss }) {
  // Auto-dismiss after 10s
  useEffect(() => {
    const id = setTimeout(onDismiss, 10_000)
    return () => clearTimeout(id)
  }, [])

  // This fires automatically (rapid-tapping, long inactivity) at exactly the
  // moment someone is frustrated or lost — read it aloud rather than relying
  // on her to notice and read the card herself.
  useEffect(() => {
    const t = setTimeout(() => speak('Take a breath — everything is fine.'), 300)
    return () => { clearTimeout(t); stopSpeaking() }
  }, [])

  return (
    <div style={styles.backdrop}>
      <div style={styles.card}>
        <div style={styles.emoji}>💙</div>
        <div style={styles.heading}>Take a breath — everything is fine.</div>

        <div style={styles.options}>
          <button style={styles.goHomeBtn} onClick={onGoHome}>
            🏠 Go Home
          </button>
          <button style={styles.dismissBtn} onClick={onDismiss}>
            I'm okay, continue
          </button>
        </div>
      </div>
    </div>
  )
}

const styles = {
  backdrop: {
    position: 'fixed',
    inset: 0,
    background: 'var(--overlay-bg)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    animation: 'fadeIn 0.4s ease'
  },
  card: {
    background: 'var(--bg-card)',
    border: '1.5px solid var(--border)',
    borderRadius: 'calc(var(--radius) * 1.5)',
    padding: '56px 64px',
    maxWidth: 500,
    width: '90%',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 28,
    textAlign: 'center'
  },
  emoji: { fontSize: 64 },
  heading: {
    fontSize: 'calc(1.6em * var(--font-scale, 1))',
    fontWeight: 700,
    color: 'var(--text-primary)',
    lineHeight: 1.4
  },
  options: {
    display: 'flex',
    flexDirection: 'column',
    gap: 14,
    width: '100%'
  },
  goHomeBtn: {
    padding: '20px 0',
    background: 'var(--accent)',
    color: '#1C322D',
    borderRadius: 'var(--radius)',
    fontSize: 'calc(1.2em * var(--font-scale, 1))',
    fontWeight: 700,
    cursor: 'pointer',
    border: 'none',
    width: '100%'
  },
  dismissBtn: {
    padding: '16px 0',
    background: 'transparent',
    color: 'var(--text-secondary)',
    borderRadius: 'var(--radius)',
    fontSize: 'calc(1em * var(--font-scale, 1))',
    fontWeight: 600,
    cursor: 'pointer',
    border: '1.5px solid var(--border)',
    width: '100%'
  }
}
