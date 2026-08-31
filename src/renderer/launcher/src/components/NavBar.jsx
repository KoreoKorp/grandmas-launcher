import React, { useState, useEffect } from 'react'

const NAV_WIDTH = 300

export default function NavBar({ url, weather, onHome, onBack, onHelp }) {
  const [now, setNow] = useState(new Date())

  useEffect(() => {
    window.launcher.setBrowserNavWidth(NAV_WIDTH)
  }, [])

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000)
    return () => clearInterval(id)
  }, [])

  const time = now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  const date = now.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })

  let domain = ''
  try { domain = new URL(url).hostname.replace(/^www\./, '') } catch {}

  return (
    <nav style={{ ...S.nav, width: NAV_WIDTH }}>

      {/* Clock header */}
      <div style={S.clockWrap}>
        <div style={S.clock}>{time}</div>
        <div style={S.date}>{date}</div>
      </div>

      {/* Current site indicator */}
      {domain && (
        <div style={S.siteBar}>
          <span style={S.siteDot}>🌐</span>
          <span style={S.siteName}>{domain}</span>
        </div>
      )}

      {/* Weather strip */}
      {weather && (
        <div style={S.weatherStrip}>
          <span style={S.weatherIcon}>{weather.icon}</span>
          <span style={S.weatherText}>{weather.temp}°{weather.unit}</span>
          <span style={S.weatherCond}>{weather.condition}</span>
        </div>
      )}

      <div style={{ flex: 1 }} />

      {/* Navigation buttons */}
      <div style={S.btnGroup}>
        <button style={S.homeBtn} onClick={onHome} title="Home (Alt+Down)">
          <span style={S.btnIcon}>🏠</span>
          <span>Home</span>
        </button>
        <button style={S.backBtn} onClick={onBack} title="Back (Alt+Left)">
          <span style={S.btnIcon}>←</span>
          <span>Back</span>
        </button>
      </div>

      {/* Help — visually separate, always prominent */}
      <button style={S.helpBtn} onClick={onHelp}>
        <span style={S.btnIcon}>💙</span>
        <span>Need help?</span>
      </button>
    </nav>
  )
}

const S = {
  nav: {
    height: '100%',
    background: 'linear-gradient(180deg, var(--bg-card) 0%, var(--bg-main) 100%)',
    borderRight: '1px solid var(--border-subtle)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'stretch',
    padding: '20px 16px',
    gap: 10,
    flexShrink: 0,
    boxShadow: '2px 0 12px rgba(0,0,0,0.2)'
  },
  clockWrap: {
    textAlign: 'center',
    padding: '10px 0 6px'
  },
  clock: {
    fontSize: 'calc(2.4em * var(--font-scale, 1))',
    fontWeight: 800,
    color: 'var(--text-primary)',
    letterSpacing: -0.5,
    lineHeight: 1
  },
  date: {
    fontSize: 'calc(0.82em * var(--font-scale, 1))',
    color: 'var(--text-secondary)',
    marginTop: 5,
    fontWeight: 500
  },
  siteBar: {
    display: 'flex',
    alignItems: 'center',
    gap: 7,
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid var(--border-subtle)',
    borderRadius: 'var(--radius-xs)',
    padding: '7px 10px',
    overflow: 'hidden'
  },
  siteDot: { fontSize: '0.9em', flexShrink: 0 },
  siteName: {
    fontSize: 'calc(0.78em * var(--font-scale, 1))',
    color: 'var(--text-secondary)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    fontWeight: 500
  },
  weatherStrip: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    background: 'var(--accent-dim)',
    border: '1px solid rgba(235,181,82,0.15)',
    borderRadius: 'var(--radius-xs)',
    padding: '8px 10px'
  },
  weatherIcon: { fontSize: 'calc(1.1em * var(--font-scale, 1))', lineHeight: 1 },
  weatherText: {
    fontSize: 'calc(0.95em * var(--font-scale, 1))',
    color: 'var(--text-primary)',
    fontWeight: 700
  },
  weatherCond: {
    fontSize: 'calc(0.78em * var(--font-scale, 1))',
    color: 'var(--text-secondary)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap'
  },
  btnGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8
  },
  homeBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    padding: '16px 0',
    background: 'var(--accent)',
    color: '#1C322D',
    borderRadius: 'var(--radius)',
    fontSize: 'calc(1.1em * var(--font-scale, 1))',
    fontWeight: 800,
    cursor: 'pointer',
    border: 'none',
    transition: 'filter 0.12s',
    boxShadow: '0 4px 12px rgba(235,181,82,0.25)'
  },
  backBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    padding: '14px 0',
    background: 'rgba(255,255,255,0.06)',
    color: 'var(--text-primary)',
    borderRadius: 'var(--radius)',
    fontSize: 'calc(1em * var(--font-scale, 1))',
    fontWeight: 600,
    cursor: 'pointer',
    border: '1.5px solid var(--border)',
    transition: 'background 0.12s, border-color 0.12s'
  },
  helpBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    padding: '14px 0',
    background: 'var(--help-bg)',
    color: '#fff',
    borderRadius: 'var(--radius)',
    fontSize: 'calc(0.95em * var(--font-scale, 1))',
    fontWeight: 700,
    cursor: 'pointer',
    border: '1.5px solid var(--help-border)',
    transition: 'filter 0.12s'
  },
  btnIcon: { fontSize: '1.1em' }
}
