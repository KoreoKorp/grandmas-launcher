import React, { useState, useEffect } from 'react'
import TileManager from './components/TileManager'
import MyDayEditor from './components/MyDayEditor'
import ContactsManager from './components/ContactsManager'
import WeatherSettings from './components/WeatherSettings'
import MessengerSettings from './components/MessengerSettings'
import DisplaySettings from './components/DisplaySettings'
import ConfusionSettings from './components/ConfusionSettings'
import ActivityLog from './components/ActivityLog'
import ConfigRestore from './components/ConfigRestore'
import GamesSettings from './components/GamesSettings'
import PhotosSettings from './components/PhotosSettings'
import SetupWizard from './components/SetupWizard'
import CaregiverHandoff from './components/CaregiverHandoff'
import AIDailyDigest from './components/AIDailyDigest'

const SECTIONS = [
  {
    id: 'jeans-world',
    label: "Jean's World",
    icon: '🏠',
    tabs: [
      { id: 'tiles',   label: 'Home Screen' },
      { id: 'myday',   label: 'My Day' },
      { id: 'display', label: 'Display' },
    ]
  },
  {
    id: 'people',
    label: 'People',
    icon: '👥',
    tabs: [
      { id: 'contacts',  label: 'Contacts' },
      { id: 'messenger', label: 'Messenger' },
    ]
  },
  {
    id: 'activities',
    label: 'Activities',
    icon: '🎯',
    tabs: [
      { id: 'weather', label: 'Weather' },
      { id: 'games',   label: 'Games' },
      { id: 'photos',  label: 'Photos' },
    ]
  },
  {
    id: 'caregiver',
    label: 'Caregiver Tools',
    icon: '🛠️',
    tabs: [
      { id: 'confusion', label: 'Safety' },
      { id: 'log',       label: 'Activity Log' },
      { id: 'digest',    label: 'AI Digest' },
      { id: 'restore',   label: 'Restore' },
      { id: 'wizard',    label: 'Setup Wizard' },
      { id: 'handoff',   label: 'Handoff' },
    ]
  }
]

function sectionForTab(tabId) {
  return SECTIONS.find(s => s.tabs.some(t => t.id === tabId))?.id
}

// ── PIN Gate ──────────────────────────────────────────────────────────────────

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
  keySubmit: { background: 'var(--accent)', color: '#1C322D', border: 'none' }
}

// ── Sidebar Nav ───────────────────────────────────────────────────────────────

function SideNav({ activeTab, onSelect }) {
  const activeSection = sectionForTab(activeTab)
  const [openSections, setOpenSections] = useState(() => new Set([activeSection]))

  function toggleSection(sectionId) {
    setOpenSections(prev => {
      const next = new Set(prev)
      if (next.has(sectionId)) { next.delete(sectionId) } else { next.add(sectionId) }
      return next
    })
  }

  function selectTab(tabId) {
    const sec = sectionForTab(tabId)
    setOpenSections(prev => new Set([...prev, sec]))
    onSelect(tabId)
  }

  return (
    <nav style={styles.nav}>
      <div style={styles.navTitle}>Admin Panel</div>

      {SECTIONS.map(section => {
        const isOpen = openSections.has(section.id)
        return (
          <div key={section.id}>
            <button
              style={styles.sectionBtn}
              onClick={() => toggleSection(section.id)}
            >
              <span>{section.icon} {section.label}</span>
              <span style={{ fontSize: '0.75em', opacity: 0.6 }}>{isOpen ? '▲' : '▼'}</span>
            </button>

            {isOpen && section.tabs.map(tab => (
              <button
                key={tab.id}
                style={{
                  ...styles.tabBtn,
                  background: activeTab === tab.id ? 'rgba(235,181,82,0.15)' : 'transparent',
                  color: activeTab === tab.id ? 'var(--accent)' : 'var(--text-dim)',
                }}
                onClick={() => selectTab(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </div>
        )
      })}

      <div style={{ flex: 1 }} />
      <button
        className="btn btn-ghost"
        style={{ margin: '12px 16px', fontSize: '0.9em' }}
        onClick={() => window.admin.showLauncher()}
      >
        Show Launcher
      </button>
    </nav>
  )
}

// ── App ───────────────────────────────────────────────────────────────────────

export default function App() {
  const [config, setConfig] = useState(null)
  const [unlocked, setUnlocked] = useState(false)
  const [activeTab, setActiveTab] = useState('tiles')
  const [helpAlert, setHelpAlert] = useState(false)
  const [showWizard, setShowWizard] = useState(false)

  useEffect(() => {
    window.admin.getConfig().then(cfg => {
      setConfig(cfg)
      if (!cfg.adminPin) {
        setUnlocked(true)
        // First-run: open wizard automatically if name isn't set yet
        if (!cfg.userName) setShowWizard(true)
      }
    })

    window.admin.onHelpAlert(() => {
      setHelpAlert(true)
      setTimeout(() => setHelpAlert(false), 8000)
    })
  }, [])

  async function save(key, value) {
    await window.admin.set(key, value)
    // Re-fetch config to properly handle nested keys (e.g., 'ai.openrouterKey')
    const cfg = await window.admin.getConfig()
    setConfig(cfg)
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
      {helpAlert && (
        <div style={styles.helpBanner}>
          ⚠️ Grandma pressed the Help button! Go check on her.
        </div>
      )}

      <div style={styles.body}>
        <SideNav activeTab={activeTab} onSelect={setActiveTab} />

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
          {activeTab === 'display' && (
            <DisplaySettings
              display={{ ...config.display, aiKeySet: !!(config.ai?.anthropicKey) }}
              onSave={d => save('display', { ...config.display, ...d })}
            />
          )}
          {activeTab === 'contacts' && (
            <ContactsManager
              contacts={config.contacts}
              onSave={contacts => save('contacts', contacts)}
            />
          )}
          {activeTab === 'messenger' && (
            <MessengerSettings
              messenger={config.messenger}
              onSave={m => save('messenger', { ...config.messenger, ...m })}
            />
          )}
          {activeTab === 'weather' && (
            <WeatherSettings
              weather={config.weather}
              onSave={w => save('weather', { ...config.weather, ...w })}
            />
          )}
          {activeTab === 'games' && (
            <GamesSettings
              games={config.games}
              onSave={g => save('games', { ...config.games, ...g })}
            />
          )}
          {activeTab === 'photos' && (
            <PhotosSettings
              photos={config.photos}
              onSave={p => save('photos', { ...config.photos, ...p })}
            />
          )}
          {activeTab === 'confusion' && (
            <ConfusionSettings
              confusion={config.confusion}
              onSave={c => save('confusion', { ...config.confusion, ...c })}
            />
          )}
          {activeTab === 'log' && <ActivityLog />}
          {activeTab === 'digest' && (
            <AIDailyDigest aiKeySet={!!(config.ai?.anthropicKey)} />
          )}
          {activeTab === 'restore' && <ConfigRestore />}
          {activeTab === 'wizard' && (
            <div>
              <h2>Setup Wizard</h2>
              <div className="card">
                <strong style={{ color: 'var(--text)' }}>Run the setup wizard</strong>
                <p style={{ marginTop: 8, color: 'var(--text-dim)', fontSize: '0.9em', lineHeight: 1.6 }}>
                  Walk through 5 quick questions to configure the essentials: grandma's name,
                  location, admin PIN, messenger PIN, and help message.
                </p>
                <div style={{ marginTop: 14 }}>
                  <button className="btn btn-primary" onClick={() => setShowWizard(true)}>
                    Start Setup Wizard →
                  </button>
                </div>
              </div>
            </div>
          )}
          {activeTab === 'handoff' && (
            <CaregiverHandoff
              onImportComplete={() => window.admin.getConfig().then(setConfig)}
            />
          )}
        </main>
      </div>

      {showWizard && (
        <SetupWizard
          config={config}
          onSave={save}
          onClose={() => setShowWizard(false)}
        />
      )}
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
  sectionBtn: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    padding: '10px 16px',
    border: 'none',
    background: 'transparent',
    color: 'var(--text)',
    fontSize: '0.88em',
    fontWeight: 700,
    textAlign: 'left',
    cursor: 'pointer',
    letterSpacing: '0.02em',
    marginTop: 4,
  },
  tabBtn: {
    display: 'block',
    width: '100%',
    padding: '8px 16px 8px 28px',
    border: 'none',
    textAlign: 'left',
    fontSize: '0.9em',
    fontWeight: 500,
    cursor: 'pointer',
    transition: 'background 0.1s, color 0.1s',
  },
  main: {
    flex: 1,
    overflowY: 'auto',
    padding: 28
  }
}
