import React, { useEffect } from 'react'

export default function HelpOverlay({ caregiverName, onGoHome, onDismiss, onCallCaregiver }) {
  // Fade in on mount
  useEffect(() => {
    window.launcher.logActivity('help-overlay-shown')
  }, [])

  return (
    <div style={styles.backdrop}>
      <div style={styles.card}>
        <div style={styles.emoji}>💙</div>
        <div style={styles.heading}>It's okay! You're safe at home on your laptop.</div>

        <div style={styles.options}>
          <button style={styles.optionBtn} onClick={onGoHome}>
            <span style={styles.optionIcon}>🏠</span>
            <span>Go back to the home screen</span>
          </button>

          <button style={styles.optionBtn} onClick={onCallCaregiver}>
            <span style={styles.optionIcon}>📞</span>
            <span>Alert {caregiverName}</span>
          </button>

          <button style={{ ...styles.optionBtn, ...styles.optionBtnSubtle }} onClick={onDismiss}>
            <span style={styles.optionIcon}>✓</span>
            <span>Everything is fine — go back to what I was doing</span>
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
    animation: 'fadeIn 0.3s ease'
  },
  card: {
    background: 'var(--bg-card)',
    border: '1.5px solid var(--border)',
    borderRadius: 'calc(var(--radius) * 1.5)',
    padding: '48px 56px',
    maxWidth: 620,
    width: '90%',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 24,
    textAlign: 'center'
  },
  emoji: { fontSize: 56 },
  heading: {
    fontSize: 'calc(1.5em * var(--font-scale, 1))',
    fontWeight: 700,
    color: 'var(--text-primary)',
    lineHeight: 1.4
  },
  options: {
    display: 'flex',
    flexDirection: 'column',
    gap: 14,
    width: '100%',
    marginTop: 8
  },
  optionBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: 16,
    width: '100%',
    padding: '20px 24px',
    background: 'var(--bg-main)',
    border: '1.5px solid var(--border)',
    borderRadius: 'var(--radius)',
    color: 'var(--text-primary)',
    fontSize: 'calc(1.1em * var(--font-scale, 1))',
    fontWeight: 600,
    cursor: 'pointer',
    textAlign: 'left',
    transition: 'background 0.12s, border-color 0.12s'
  },
  optionBtnSubtle: {
    opacity: 0.8
  },
  optionIcon: { fontSize: '1.4em', flexShrink: 0 }
}
