import React, { useState, useEffect } from 'react'

function greeting(name) {
  const h = new Date().getHours()
  const time = h < 5 ? 'Good night' : h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'
  return `${time}, ${name}!`
}

function formatDate(d) {
  return d.toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric'
  })
}

function formatTime(d) {
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

export default function Sidebar({ userName, dailyNote, reminders, weather, onHelpPress }) {
  const [now, setNow] = useState(new Date())
  const [activeReminder, setActiveReminder] = useState(null)

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    function check() {
      const n = Date.now()
      for (const r of reminders ?? []) {
        const t = new Date(r.time).getTime()
        if (Math.abs(n - t) < 60_000 && !r.dismissed) {
          setActiveReminder(r)
          break
        }
      }
    }
    check()
    const id = setInterval(check, 60_000)
    return () => clearInterval(id)
  }, [reminders])

  return (
    <aside style={S.sidebar} className="sidebar-panel">
      {/* Layered background for depth */}
      <div style={S.bgLayer2} />

      <div style={S.content}>
        {/* Clock — the most important piece of info */}
        <div style={S.timeWrap} className="view-slide-up">
          <div style={S.time}>{formatTime(now)}</div>
          <div style={S.date}>{formatDate(now)}</div>
        </div>

        {/* Greeting */}
        <div style={S.greeting} className="shimmer-text">{greeting(userName ?? 'Friend')}</div>

        {/* Weather card */}
        {weather && (
          <div style={S.weatherCard}>
            <span style={S.weatherIcon}>{weather.icon}</span>
            <div style={S.weatherInfo}>
              <div style={S.weatherTemp}>{weather.temp}°{weather.unit}</div>
              <div style={S.weatherCond}>{weather.condition}</div>
              {weather.locationName && (
                <div style={S.weatherLoc}>📍 {weather.locationName}</div>
              )}
            </div>
          </div>
        )}

        <div style={S.divider} />

        {/* Daily Note */}
        {dailyNote ? (
          <div style={S.noteCard}>
            <div style={S.noteLabel}>📋 Today's Note</div>
            <div style={S.noteText}>{dailyNote}</div>
          </div>
        ) : null}

        {/* Upcoming Reminders */}
        {reminders?.length > 0 && (
          <div style={S.reminderList}>
            {reminders.slice(0, 3).map((r, i) => (
              <div key={i} style={S.reminderItem}>
                <span style={S.reminderBell}>🔔</span>
                <div>
                  <div style={S.reminderText}>{r.message}</div>
                  <div style={S.reminderTime}>
                    {new Date(r.time).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        <div style={{ flex: 1 }} />

        {/* Help Button — large, obvious, friendly */}
        <button style={S.helpBtn} onClick={onHelpPress}>
          <span style={S.helpIcon}>💙</span>
          <span style={S.helpText}>Need help?<br /><small style={S.helpSub}>Tap here if you feel lost</small></span>
        </button>
      </div>

      {/* Reminder popup */}
      {activeReminder && (
        <div style={S.reminderOverlay}>
          <div style={S.reminderCard}>
            <div style={{ fontSize: '2.5em', marginBottom: 12 }}>🔔</div>
            <div style={S.reminderPopupText}>{activeReminder.message}</div>
            <button style={S.dismissBtn} onClick={() => setActiveReminder(null)}>
              Got it ✓
            </button>
          </div>
        </div>
      )}
    </aside>
  )
}

const S = {
  sidebar: {
    position: 'relative',
    width: '35%',
    minWidth: 280,
    maxWidth: 440,
    height: '100%',
    flexShrink: 0,
    overflow: 'hidden'
  },
  bgLayer2: {
    position: 'absolute',
    inset: 0,
    background: 'radial-gradient(ellipse at 50% 0%, rgba(235,181,82,0.06) 0%, transparent 70%)',
    zIndex: 1
  },
  content: {
    position: 'relative',
    zIndex: 2,
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    padding: '28px 24px',
    gap: 14,
    alignItems: 'stretch'
  },
  timeWrap: {
    textAlign: 'center',
    padding: '16px 0 8px',
  },
  time: {
    fontFamily: 'var(--font-display)',
    fontSize: 'calc(3.4em * var(--font-scale, 1))',
    fontWeight: 500,
    color: 'var(--text-primary)',
    lineHeight: 1,
    letterSpacing: -1,
    textShadow: '0 2px 12px rgba(0,0,0,0.3)'
  },
  date: {
    fontSize: 'calc(0.95em * var(--font-scale, 1))',
    color: 'var(--text-secondary)',
    marginTop: 6,
    fontWeight: 500
  },
  greeting: {
    fontSize: 'calc(1.05em * var(--font-scale, 1))',
    color: 'var(--accent)',
    fontWeight: 700,
    letterSpacing: 0.2,
    textAlign: 'center'
  },
  weatherCard: {
    display: 'flex',
    alignItems: 'center',
    gap: 14,
    background: 'linear-gradient(135deg, var(--accent-dim) 0%, rgba(255,255,255,0.03) 100%)',
    border: '1px solid rgba(235,181,82,0.25)',
    borderRadius: 'var(--radius-sm)',
    padding: '12px 16px',
    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.08)',
    backdropFilter: 'blur(8px)',
    WebkitBackdropFilter: 'blur(8px)'
  },
  weatherIcon: {
    fontSize: 'calc(2.2em * var(--font-scale, 1))',
    lineHeight: 1,
    flexShrink: 0
  },
  weatherInfo: { display: 'flex', flexDirection: 'column', gap: 2 },
  weatherTemp: {
    fontSize: 'calc(1.4em * var(--font-scale, 1))',
    fontWeight: 800,
    color: 'var(--text-primary)',
    lineHeight: 1
  },
  weatherCond: {
    fontSize: 'calc(0.85em * var(--font-scale, 1))',
    color: 'var(--text-secondary)',
    fontWeight: 500
  },
  weatherLoc: {
    fontSize: 'calc(0.75em * var(--font-scale, 1))',
    color: 'var(--text-dim)',
    marginTop: 2
  },
  divider: {
    height: 1,
    background: 'var(--border-subtle)',
    margin: '2px 0'
  },
  noteCard: {
    background: 'var(--accent-dim)',
    border: '1px solid rgba(235,181,82,0.25)',
    borderLeft: '3px solid var(--accent)',
    borderRadius: 'var(--radius-xs)',
    padding: '12px 14px',
    display: 'flex',
    flexDirection: 'column',
    gap: 6
  },
  noteLabel: {
    fontSize: 'calc(0.75em * var(--font-scale, 1))',
    color: 'var(--accent)',
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: 0.8
  },
  noteText: {
    fontSize: 'calc(0.95em * var(--font-scale, 1))',
    color: 'var(--text-primary)',
    lineHeight: 1.55
  },
  reminderList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8
  },
  reminderItem: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 10,
    background: 'rgba(255,255,255,0.04)',
    borderRadius: 'var(--radius-xs)',
    padding: '10px 12px',
    border: '1px solid var(--border-subtle)'
  },
  reminderBell: { fontSize: '1.1em', marginTop: 1, flexShrink: 0 },
  reminderText: {
    fontSize: 'calc(0.9em * var(--font-scale, 1))',
    color: 'var(--text-primary)',
    lineHeight: 1.4,
    fontWeight: 500
  },
  reminderTime: {
    fontSize: 'calc(0.75em * var(--font-scale, 1))',
    color: 'var(--text-dim)',
    marginTop: 3
  },
  helpBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: 14,
    width: '100%',
    padding: '20px 18px',
    background: 'var(--help-bg)',
    border: '1.5px solid var(--help-border)',
    borderRadius: 'var(--radius)',
    cursor: 'pointer',
    transition: 'filter var(--transition-smooth), transform var(--transition-bounce), box-shadow var(--transition-smooth)',
    boxShadow: '0 4px 16px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.15)',
    marginTop: 4,
    animation: 'pulse-glow 3s ease-in-out infinite'
  },
  helpIcon: { fontSize: 'calc(2em * var(--font-scale, 1))', flexShrink: 0 },
  helpText: {
    fontSize: 'calc(1.05em * var(--font-scale, 1))',
    color: '#fff',
    fontWeight: 700,
    lineHeight: 1.3,
    textAlign: 'left'
  },
  helpSub: { fontSize: '0.8em', fontWeight: 400, opacity: 0.85 },
  reminderOverlay: {
    position: 'absolute',
    inset: 0,
    background: 'var(--overlay-bg)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 20,
    padding: 24,
    animation: 'fadeIn 0.2s ease'
  },
  reminderCard: {
    background: 'var(--bg-card)',
    border: '1.5px solid var(--border)',
    borderRadius: 'var(--radius)',
    padding: '36px 32px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    textAlign: 'center',
    gap: 8,
    boxShadow: 'var(--shadow-lg)'
  },
  reminderPopupText: {
    fontSize: 'calc(1.3em * var(--font-scale, 1))',
    fontWeight: 700,
    color: 'var(--text-primary)',
    lineHeight: 1.5,
    marginBottom: 8
  },
  dismissBtn: {
    marginTop: 8,
    padding: '14px 36px',
    background: 'var(--accent)',
    color: '#1C322D',
    borderRadius: 'var(--radius)',
    fontSize: 'calc(1.1em * var(--font-scale, 1))',
    fontWeight: 800,
    cursor: 'pointer',
    border: 'none',
    boxShadow: '0 4px 12px rgba(235,181,82,0.3)'
  }
}
