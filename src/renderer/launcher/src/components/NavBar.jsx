import React, { useState, useEffect, useRef } from 'react'

const NAV_WIDTH = 300

export default function NavBar({ url, weather, onHome, onBack, onHelp }) {
  const [now, setNow] = useState(new Date())

  useEffect(() => {
    // Tell main process how wide the nav bar is so it can position the BrowserView
    window.launcher.setBrowserNavWidth(NAV_WIDTH)
  }, [])

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000)
    return () => clearInterval(id)
  }, [])

  const time = now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  const date = now.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })

  return (
    <nav style={{ ...styles.nav, width: NAV_WIDTH }}>
      <div style={styles.clock}>{time}</div>
      <div style={styles.date}>{date}</div>

      {weather && (
        <div style={styles.weather}>
          <span>{weather.icon}</span>
          <span>{weather.temp}°{weather.unit}</span>
        </div>
      )}

      <div style={{ flex: 1 }} />

      <button style={styles.homeBtn} onClick={onHome}>
        🏠 Home
      </button>

      <button style={styles.backBtn} onClick={onBack}>
        ← Back
      </button>

      <button style={styles.helpBtn} onClick={onHelp}>
        💙 Need help?
      </button>
    </nav>
  )
}

const styles = {
  nav: {
    height: '100%',
    background: 'linear-gradient(180deg, var(--bg-card) 0%, var(--bg-main) 100%)',
    borderRight: '1px solid var(--border)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '24px 16px',
    gap: 12,
    flexShrink: 0
  },
  clock: {
    fontSize: 'calc(2em * var(--font-scale, 1))',
    fontWeight: 700,
    color: 'var(--text-primary)'
  },
  date: {
    fontSize: 'calc(0.85em * var(--font-scale, 1))',
    color: 'var(--text-secondary)'
  },
  weather: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    fontSize: 'calc(1em * var(--font-scale, 1))',
    color: 'var(--text-secondary)'
  },
  homeBtn: {
    width: '100%',
    padding: '16px 0',
    background: 'var(--accent)',
    color: '#2a2a3c',
    borderRadius: 'var(--radius)',
    fontSize: 'calc(1.1em * var(--font-scale, 1))',
    fontWeight: 700,
    cursor: 'pointer',
    border: 'none',
    transition: 'filter 0.12s'
  },
  backBtn: {
    width: '100%',
    padding: '14px 0',
    background: 'var(--bg-card)',
    color: 'var(--text-primary)',
    borderRadius: 'var(--radius)',
    fontSize: 'calc(1em * var(--font-scale, 1))',
    fontWeight: 600,
    cursor: 'pointer',
    border: '1.5px solid var(--border)',
    transition: 'background 0.12s'
  },
  helpBtn: {
    width: '100%',
    padding: '14px 0',
    background: 'var(--help-bg)',
    color: '#fff',
    borderRadius: 'var(--radius)',
    fontSize: 'calc(0.95em * var(--font-scale, 1))',
    fontWeight: 600,
    cursor: 'pointer',
    border: '1.5px solid var(--help-border)',
    transition: 'filter 0.12s'
  }
}
