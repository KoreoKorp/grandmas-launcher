import React, { useState, useEffect } from 'react'
import TileManager from './components/TileManager'
import MyDayEditor from './components/MyDayEditor'
import ContactsManager from './components/ContactsManager'
import WeatherSettings from './components/WeatherSettings'
import MessengerSettings from './components/MessengerSettings'
import DisplaySettings from './components/DisplaySettings'
import ConfusionSettings from './components/ConfusionSettings'
import ActivityLog from './components/ActivityLog'

const TABS = [
  { id: 'tiles', label: '🔲 Tiles' },
  { id: 'myday', label: '📅 My Day' },
  { id: 'contacts', label: '💬 Contacts' },
  { id: 'weather', label: '🌤️ Weather' },
  { id: 'messenger', label: '📡 Messenger' },
  { id: 'display', label: '🖥️ Display' },
  { id: 'confusion', label: '🧭 Safety' },
  { id: 'log', label: '📋 Activity' }
]

function PinGate({ onUnlock }) {
  const [entry, setEntry] = useState('')
  const [error, setError] = useState(false)

  function press(digit) {
    if (entry.length >= 8) return
    setEntry(prev => prev + digit)
    setError(false)
  }

  function backspace() { setEntry(prev => prev.slice(0, -1)); setError(false) }

  async function submit() {
    const cfg = await window.admin.getConfig()
    if (entry === cfg.adminPin) {
      onUnlock()
    } else {
      setError(true)
      setEntry('')
    }
  }

  const dots = Array.from({ length: Math.max(entry.length, 4) }, (_, i) => (
    <span key={i} style={{ ...pinStyles.dot, background: i < entry.length ? 'var(--accent)' : 'var(--border)' }} />
  ))

  return (
    <div style={pinStyles.backdrop}>
      <div style={pinStyles.card}>
        <div style={pinStyles.title}>Admin Panel</div>
        <div style={pinStyles.subtitle}>Enter your PIN to continue</div>
        <div style={pinStyles.dots}>{dots}</div>
        {error && <div style={pinStyles.error}>Incorrect PIN</div>}
        <div style={pinStyles.grid}>
          {['1','2','3','4','5','6','7','8','9','⌫','0','→'].map(k => (
            <button
              key={k}
              style={{ ...pinStyles.key, ...(k === '→' ? pinStyles.keySubmit : {}) }}
              onClick={() => k === '⌫' ? backspace() : k === '→' ? submit() : press(k)}
            >
              {k}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

const pinStyles = {
  backdrop: { display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', background: 'var(--bg)' },
  card: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20, padding: '40px 48px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 16, minWidth: 320 },
  title: { fontSize: '1.3em', fontWeight: 700, color: 'var(--accent)' },
  subtitle: { fontSize: '0.9em', color: 'var(--text-dim)' },
  dots: { display: 'flex', gap: 12, margin: '4px 0' },
  dot: { width: 14, height: 14, borderRadius: '50%', transition: 'background 0.15s' },
  error: { color: '#e05555', fontSize: '0.85em', fontWeight: 600 },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, width: '100%' },
  key: { padding: '16px 0', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 10, fontSize: '1.2em', fontWeight: 600, cursor: 'pointer', color: 'var(--text)', transition: 'filter 0.1s' },
  keySubmit: { background: 'var(--accent)', color: '#1e1e2e', border: 'none' }
}

export default function App() {
  const [config, setConfig] = useState(null)
  const [unlocked, setUnlocked] = useState(false)
  const [activeTab, setActiveTab] = useState('tiles')
  const [helpAlert, setHelpAlert] = useState(false)

  useEffect(() => {
    window.admin.getConfig().then(cfg => {
      setConfig(cfg)
      // Skip PIN gate if no PIN is set
      if (!cfg.adminPin) setUnlocked(true)
    })

    window.admin.onHelpAlert(() => {
      setHelpAlert(true)
      setTimeout(() => setHelpAlert(false), 8000)
    })
  }, [])

  async function save(key, value) {
    await window.admin.set(key, value)
    setConfig(prev => ({ ...prev, [key]: value }))
  }

  if (!config) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
        Loading...
      </div>
    )
  }

  if (!unlocked) {
    return <PinGate onUnlock={() => setUnlocked(true)} />
  }

  return (
    <div style={styles.root}>
      {/* Help alert banner */}
      {helpAlert && (
        <div style={styles.helpBanner}>
          ⚠️ Grandma pressed the Help button! Go check on her.
        </div>
      )}

      <div style={styles.body}>
      {/* Sidebar nav */}
      <nav style={styles.nav}>
        <div style={styles.navTitle}>Admin Panel</div>
        {TABS.map(tab => (
          <button
            key={tab.id}
            style={{
              ...styles.navBtn,
              background: activeTab === tab.id ? 'rgba(245,184,112,0.15)' : 'transparent',
              color: activeTab === tab.id ? 'var(--accent)' : 'var(--text)'
            }}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}

        <div style={{ flex: 1 }} />
        <button
          className="btn btn-ghost"
          style={{ margin: '12px 16px', fontSize: '0.9em' }}
          onClick={() => window.admin.showLauncher()}
        >
          Show Launcher
        </button>
      </nav>

      {/* Main content */}
      <main style={styles.main}>
        {activeTab === 'tiles' && (
          <TileManager tiles={config.tiles} onSave={tiles => save('tiles', tiles)} />
        )}
        {activeTab === 'myday' && (
          <MyDayEditor
            dailyNote={config.dailyNote}
            reminders={config.reminders}
            userName={config.userName}
            help={config.help}
            onSaveNote={note => save('dailyNote', note)}
            onSaveReminders={r => save('reminders', r)}
            onSaveName={name => save('userName', name)}
            onSaveHelp={h => save('help', { ...config.help, ...h })}
          />
        )}
        {activeTab === 'contacts' && (
          <ContactsManager
            contacts={config.contacts}
            onSave={contacts => save('contacts', contacts)}
          />
        )}
        {activeTab === 'weather' && (
          <WeatherSettings
            weather={config.weather}
            onSave={w => save('weather', { ...config.weather, ...w })}
          />
        )}
        {activeTab === 'messenger' && (
          <MessengerSettings
            messenger={config.messenger}
            onSave={m => save('messenger', { ...config.messenger, ...m })}
          />
        )}
        {activeTab === 'display' && (
          <DisplaySettings
            display={config.display}
            onSave={d => save('display', { ...config.display, ...d })}
          />
        )}
        {activeTab === 'confusion' && (
          <ConfusionSettings
            confusion={config.confusion}
            onSave={c => save('confusion', { ...config.confusion, ...c })}
          />
        )}
        {activeTab === 'log' && <ActivityLog />}
      </main>
      </div>
    </div>
  )
}

const styles = {
  root: {
    display: 'flex',
    height: '100%',
    overflow: 'hidden',
    flexDirection: 'column'
  },
  body: {
    display: 'flex',
    flex: 1,
    overflow: 'hidden',
    position: 'relative'
  },
  helpBanner: {
    background: '#b83232',
    color: '#fff',
    padding: '12px 20px',
    fontWeight: 700,
    fontSize: '1em',
    textAlign: 'center',
    flexShrink: 0
  },
  nav: {
    width: 200,
    background: 'var(--bg-card)',
    borderRight: '1px solid var(--border)',
    display: 'flex',
    flexDirection: 'column',
    padding: '16px 0',
    flexShrink: 0,
    overflowY: 'auto'
  },
  navTitle: {
    padding: '0 16px 16px',
    fontWeight: 700,
    fontSize: '1em',
    color: 'var(--accent)',
    borderBottom: '1px solid var(--border)',
    marginBottom: 8
  },
  navBtn: {
    display: 'block',
    width: '100%',
    padding: '11px 16px',
    border: 'none',
    textAlign: 'left',
    fontSize: '0.95em',
    fontWeight: 600,
    borderRadius: 0,
    transition: 'background 0.1s, color 0.1s',
    cursor: 'pointer'
  },
  main: {
    flex: 1,
    overflowY: 'auto',
    padding: 28
  }
}
