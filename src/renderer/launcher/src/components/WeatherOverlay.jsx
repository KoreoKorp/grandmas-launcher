import React from 'react'

export default function WeatherOverlay({ weather, onClose }) {
  if (!weather) return (
    <div style={styles.backdrop}>
      <div style={styles.card}>
        <div style={styles.icon}>🌤️</div>
        <div style={styles.condition}>Weather not set up yet</div>
        <div style={styles.location}>Ask a family member to add your city in the Admin Panel → Weather tab.</div>
        <button style={styles.closeBtn} onClick={onClose}>🏠 Back to Home</button>
      </div>
    </div>
  )

  return (
    <div style={styles.backdrop}>
      <div style={styles.card}>
        <div style={styles.icon}>{weather.icon}</div>
        <div style={styles.temp}>{weather.temp}°{weather.unit}</div>
        <div style={styles.condition}>{weather.condition}</div>
        {weather.locationName && (
          <div style={styles.location}>📍 {weather.locationName}</div>
        )}
        {weather.high != null && weather.low != null && (
          <div style={styles.range}>
            High {weather.high}° · Low {weather.low}°
          </div>
        )}
        <button style={styles.closeBtn} onClick={onClose}>🏠 Back to Home</button>
      </div>
    </div>
  )
}

const styles = {
  backdrop: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(30, 30, 48, 0.88)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 900
  },
  card: {
    background: 'var(--bg-card)',
    border: '1.5px solid var(--border)',
    borderRadius: 'var(--radius)',
    padding: '48px 64px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 16,
    minWidth: 340,
    textAlign: 'center'
  },
  icon: {
    fontSize: 80,
    lineHeight: 1
  },
  temp: {
    fontSize: 'calc(3em * var(--font-scale, 1))',
    fontWeight: 700,
    color: 'var(--accent)'
  },
  condition: {
    fontSize: 'calc(1.3em * var(--font-scale, 1))',
    fontWeight: 600,
    color: 'var(--text-primary)',
    textTransform: 'capitalize'
  },
  location: {
    fontSize: 'calc(1em * var(--font-scale, 1))',
    color: 'var(--text-secondary)'
  },
  range: {
    fontSize: 'calc(1em * var(--font-scale, 1))',
    color: 'var(--text-secondary)'
  },
  closeBtn: {
    marginTop: 16,
    padding: '16px 40px',
    background: 'var(--accent)',
    color: '#2a2a3c',
    border: 'none',
    borderRadius: 'var(--radius)',
    fontSize: 'calc(1.1em * var(--font-scale, 1))',
    fontWeight: 700,
    cursor: 'pointer'
  }
}
