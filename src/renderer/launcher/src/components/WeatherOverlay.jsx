import React, { useState } from 'react'

export default function WeatherOverlay({ weathers = [], onClose }) {
  const [activeIdx, setActiveIdx] = useState(0)

  if (!weathers.length) return (
    <div style={S.backdrop}>
      <div style={S.card}>
        <div style={S.emptyIcon}>🌤️</div>
        <div style={S.condition}>Weather not set up yet</div>
        <div style={S.location}>
          Ask a family member to add your city in the Admin Panel → Weather Settings.
        </div>
        <button style={S.closeBtn} onClick={onClose}>🏠 Back to Home</button>
      </div>
    </div>
  )

  const w = weathers[activeIdx] ?? weathers[0]

  return (
    <div style={S.backdrop}>
      <div style={S.card}>
        {weathers.length > 1 && (
          <div style={S.tabs}>
            {weathers.map((loc, i) => (
              <button
                key={i}
                style={{ ...S.tab, ...(i === activeIdx ? S.tabActive : {}) }}
                onClick={() => setActiveIdx(i)}
              >
                {loc.locationName || `Location ${i + 1}`}
              </button>
            ))}
          </div>
        )}

        <div style={S.icon}>{w.icon}</div>
        <div style={S.temp}>{w.temp}°{w.unit}</div>
        <div style={S.condition}>{w.condition}</div>

        {w.locationName && (
          <div style={S.location}>📍 {w.locationName}</div>
        )}

        {/* High / Low */}
        {w.high != null && w.low != null && (
          <div style={S.range}>
            ↑ {w.high}°&nbsp;&nbsp;↓ {w.low}°
          </div>
        )}

        {/* Details row */}
        <div style={S.details}>
          {w.feelsLike != null && (
            <div style={S.detailChip}>
              <span style={S.detailLabel}>Feels like</span>
              <span style={S.detailValue}>{w.feelsLike}°</span>
            </div>
          )}
          {w.humidity != null && (
            <div style={S.detailChip}>
              <span style={S.detailLabel}>Humidity</span>
              <span style={S.detailValue}>{w.humidity}%</span>
            </div>
          )}
          {w.windSpeed != null && (
            <div style={S.detailChip}>
              <span style={S.detailLabel}>Wind</span>
              <span style={S.detailValue}>{w.windSpeed} mph</span>
            </div>
          )}
        </div>

        {/* Hourly forecast strip */}
        {w.hourly?.length > 0 && (
          <div style={S.hourlyWrap}>
            {w.hourly.map((h, i) => (
              <div key={i} style={{ ...S.hourlyItem, ...(i === 0 ? S.hourlyNow : {}) }}>
                <span style={S.hourlyLabel}>{h.label}</span>
                <span style={S.hourlyIcon}>{h.icon}</span>
                <span style={S.hourlyTemp}>{h.temp}°</span>
              </div>
            ))}
          </div>
        )}

        {weathers.length > 1 && (
          <div style={S.dots}>
            {weathers.map((_, i) => (
              <button
                key={i}
                style={{ ...S.dot, ...(i === activeIdx ? S.dotActive : {}) }}
                onClick={() => setActiveIdx(i)}
                aria-label={`Location ${i + 1}`}
              />
            ))}
          </div>
        )}

        <button style={S.closeBtn} onClick={onClose}>🏠 Back to Home</button>
      </div>
    </div>
  )
}

const S = {
  backdrop: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(20, 20, 36, 0.92)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 900,
    animation: 'fadeIn 0.2s ease'
  },
  card: {
    background: 'var(--bg-card)',
    border: '1.5px solid var(--border)',
    borderRadius: 28,
    padding: '40px 56px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 12,
    minWidth: 380,
    maxWidth: 560,
    width: '90vw',
    textAlign: 'center',
    boxShadow: '0 24px 60px rgba(0,0,0,0.5)'
  },
  tabs: {
    display: 'flex',
    gap: 8,
    flexWrap: 'wrap',
    justifyContent: 'center',
    marginBottom: 4
  },
  tab: {
    padding: '6px 14px',
    background: 'rgba(255,255,255,0.07)',
    border: '1px solid var(--border)',
    borderRadius: 20,
    fontSize: 'calc(0.85em * var(--font-scale, 1))',
    color: 'var(--text-secondary)',
    cursor: 'pointer',
    fontWeight: 500,
    transition: 'background 0.12s, color 0.12s, border-color 0.12s'
  },
  tabActive: {
    background: 'var(--accent-dim)',
    borderColor: 'var(--accent)',
    color: 'var(--accent)',
    fontWeight: 700
  },
  emptyIcon: { fontSize: 80, lineHeight: 1 },
  icon: {
    fontSize: 88,
    lineHeight: 1,
    filter: 'drop-shadow(0 4px 12px rgba(0,0,0,0.3))'
  },
  temp: {
    fontSize: 'calc(3.2em * var(--font-scale, 1))',
    fontWeight: 800,
    color: 'var(--accent)',
    lineHeight: 1,
    letterSpacing: -1
  },
  condition: {
    fontSize: 'calc(1.2em * var(--font-scale, 1))',
    fontWeight: 600,
    color: 'var(--text-primary)',
    textTransform: 'capitalize'
  },
  location: {
    fontSize: 'calc(0.9em * var(--font-scale, 1))',
    color: 'var(--text-secondary)'
  },
  range: {
    fontSize: 'calc(1em * var(--font-scale, 1))',
    color: 'var(--text-secondary)',
    fontWeight: 600,
    letterSpacing: 1
  },
  details: {
    display: 'flex',
    gap: 12,
    flexWrap: 'wrap',
    justifyContent: 'center',
    marginTop: 4
  },
  detailChip: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 2,
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid var(--border)',
    borderRadius: 12,
    padding: '8px 16px',
    minWidth: 80
  },
  detailLabel: {
    fontSize: 'calc(0.72em * var(--font-scale, 1))',
    color: 'var(--text-secondary)',
    textTransform: 'uppercase',
    letterSpacing: 0.8
  },
  detailValue: {
    fontSize: 'calc(1em * var(--font-scale, 1))',
    fontWeight: 700,
    color: 'var(--text-primary)'
  },
  hourlyWrap: {
    display: 'flex',
    gap: 8,
    overflowX: 'auto',
    width: '100%',
    padding: '4px 2px',
    justifyContent: 'center'
  },
  hourlyItem: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 4,
    padding: '8px 12px',
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid var(--border)',
    borderRadius: 12,
    minWidth: 56,
    flexShrink: 0
  },
  hourlyNow: {
    background: 'var(--accent-dim)',
    borderColor: 'var(--accent)'
  },
  hourlyLabel: {
    fontSize: 'calc(0.7em * var(--font-scale, 1))',
    color: 'var(--text-secondary)',
    fontWeight: 600
  },
  hourlyIcon: { fontSize: 'calc(1.2em * var(--font-scale, 1))' },
  hourlyTemp: {
    fontSize: 'calc(0.85em * var(--font-scale, 1))',
    fontWeight: 700,
    color: 'var(--text-primary)'
  },
  dots: {
    display: 'flex',
    gap: 10,
    marginTop: 2
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: '50%',
    background: 'var(--border)',
    border: 'none',
    cursor: 'pointer',
    padding: 0,
    transition: 'background 0.14s, transform 0.12s'
  },
  dotActive: {
    background: 'var(--accent)',
    transform: 'scale(1.3)'
  },
  closeBtn: {
    marginTop: 8,
    padding: '16px 44px',
    background: 'var(--accent)',
    color: '#1C322D',
    border: 'none',
    borderRadius: 'var(--radius)',
    fontSize: 'calc(1.1em * var(--font-scale, 1))',
    fontWeight: 800,
    cursor: 'pointer',
    boxShadow: '0 4px 16px rgba(235,181,82,0.3)'
  }
}
