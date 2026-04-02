import React, { useState, useEffect } from 'react'

function greeting(name) {
  const h = new Date().getHours()
  const time = h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'
  return `${time}, ${name}!`
}

function formatDate(d) {
  return d.toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric'
  })
}

function formatTime(d) {
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

export default function Sidebar({ userName, dailyNote, reminders, weather, onHelpPress }) {
  const [now, setNow] = useState(new Date())
  const [activeReminder, setActiveReminder] = useState(null)

  // Clock tick
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000)
    return () => clearInterval(id)
  }, [])

  // Check reminders every minute
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
    <aside style={styles.sidebar}>
      {/* Gradient background */}
      <div style={styles.gradient} />

      <div style={styles.content}>
        {/* Welcoming clipart */}
        <div style={styles.clipart}>🌸</div>

        {/* Greeting */}
        <div style={styles.greeting}>{greeting(userName ?? 'Friend')}</div>

        {/* Date */}
        <div style={styles.date}>{formatDate(now)}</div>

        {/* Time */}
        <div style={styles.time}>{formatTime(now)}</div>

        {/* Weather */}
        {weather && (
          <div style={styles.weatherBox}>
            <span style={styles.weatherIcon}>{weather.icon}</span>
            <div>
              <div style={styles.weatherTemp}>{weather.temp}°{weather.unit}</div>
              <div style={styles.weatherCond}>{weather.condition}</div>
            </div>
          </div>
        )}

        <div style={styles.divider} />

        {/* Daily Note */}
        {dailyNote ? (
          <div style={styles.noteBox}>
            <div style={styles.noteLabel}>Today's Note</div>
            <div style={styles.noteText}>{dailyNote}</div>
          </div>
        ) : null}

        {/* Upcoming Reminders */}
        {reminders?.length > 0 && (
          <div style={styles.reminderList}>
            {reminders.slice(0, 3).map((r, i) => (
              <div key={i} style={styles.reminderItem}>
                <span style={{ fontSize: '1.1em' }}>🔔</span>
                <div>
                  <div style={styles.reminderText}>{r.message}</div>
                  <div style={styles.reminderTime}>
                    {new Date(r.time).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        <div style={{ flex: 1 }} />

        {/* Help Button */}
        <button style={styles.helpBtn} onClick={onHelpPress}>
          <span style={{ fontSize: '1.6em' }}>💙</span>
          <span style={styles.helpText}>Tap here if you need help or feel lost</span>
        </button>
      </div>

      {/* Reminder popup overlay */}
      {activeReminder && (
        <div style={styles.reminderPopup}>
          <div style={{ fontSize: '2em' }}>🔔</div>
          <div style={styles.reminderPopupText}>{activeReminder.message}</div>
          <button
            style={styles.reminderDismiss}
            onClick={() => setActiveReminder(null)}
          >
            Got it
          </button>
        </div>
      )}
    </aside>
  )
}

const styles = {
  sidebar: {
    position: 'relative',
    width: '35%',
    minWidth: 280,
    maxWidth: 440,
    height: '100%',
    flexShrink: 0,
    overflow: 'hidden',
    borderRight: '1px solid var(--border)'
  },
  gradient: {
    position: 'absolute',
    inset: 0,
    background: 'linear-gradient(180deg, var(--bg-card) 0%, var(--bg-main) 100%)',
    zIndex: 0
  },
  content: {
    position: 'relative',
    zIndex: 1,
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    padding: '32px 28px',
    gap: 12,
    alignItems: 'center',
    textAlign: 'center'
  },
  clipart: {
    fontSize: 56,
    lineHeight: 1,
    marginBottom: 4,
    filter: 'drop-shadow(0 2px 6px rgba(0,0,0,0.18))'
  },
  greeting: {
    fontSize: 'calc(1.1em * var(--font-scale, 1))',
    color: 'var(--accent)',
    fontWeight: 600,
    letterSpacing: 0.3
  },
  date: {
    fontSize: 'calc(1.1em * var(--font-scale, 1))',
    color: 'var(--text-primary)',
    fontWeight: 700,
    lineHeight: 1.3
  },
  time: {
    fontSize: 'calc(2.8em * var(--font-scale, 1))',
    color: 'var(--text-primary)',
    fontWeight: 700,
    lineHeight: 1,
    marginBottom: 4
  },
  weatherBox: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    background: 'rgba(255,255,255,0.07)',
    borderRadius: 'var(--radius-sm)',
    padding: '10px 14px',
    marginTop: 4
  },
  weatherIcon: { fontSize: '2em' },
  weatherTemp: { fontSize: 'calc(1.3em * var(--font-scale, 1))', fontWeight: 700 },
  weatherCond: { fontSize: 'calc(0.85em * var(--font-scale, 1))', color: 'var(--text-secondary)' },
  divider: {
    height: 1,
    background: 'var(--border)',
    margin: '4px 0'
  },
  noteBox: {
    background: 'rgba(245,184,112,0.12)',
    border: '1px solid rgba(245,184,112,0.3)',
    borderRadius: 'var(--radius-sm)',
    padding: '12px 14px',
    gap: 6,
    display: 'flex',
    flexDirection: 'column'
  },
  noteLabel: {
    fontSize: 'calc(0.75em * var(--font-scale, 1))',
    color: 'var(--accent)',
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: 1
  },
  noteText: {
    fontSize: 'calc(0.95em * var(--font-scale, 1))',
    color: 'var(--text-primary)',
    lineHeight: 1.5
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
    background: 'rgba(255,255,255,0.05)',
    borderRadius: 'var(--radius-sm)',
    padding: '10px 12px'
  },
  reminderText: {
    fontSize: 'calc(0.9em * var(--font-scale, 1))',
    color: 'var(--text-primary)',
    lineHeight: 1.4
  },
  reminderTime: {
    fontSize: 'calc(0.75em * var(--font-scale, 1))',
    color: 'var(--text-secondary)',
    marginTop: 2
  },
  helpBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    width: '100%',
    padding: '18px 20px',
    background: 'var(--help-bg)',
    border: '1.5px solid var(--help-border)',
    borderRadius: 'var(--radius)',
    cursor: 'pointer',
    textAlign: 'left',
    transition: 'filter 0.15s',
    marginTop: 8
  },
  helpText: {
    fontSize: 'calc(1em * var(--font-scale, 1))',
    color: '#fff',
    fontWeight: 600,
    lineHeight: 1.4
  },
  reminderPopup: {
    position: 'absolute',
    inset: 0,
    background: 'var(--overlay-bg)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20,
    zIndex: 10,
    padding: 32,
    textAlign: 'center'
  },
  reminderPopupText: {
    fontSize: 'calc(1.4em * var(--font-scale, 1))',
    fontWeight: 600,
    color: 'var(--text-primary)',
    lineHeight: 1.5
  },
  reminderDismiss: {
    padding: '14px 40px',
    background: 'var(--accent)',
    color: '#2a2a3c',
    borderRadius: 'var(--radius)',
    fontSize: 'calc(1.1em * var(--font-scale, 1))',
    fontWeight: 700,
    cursor: 'pointer',
    border: 'none'
  }
}
