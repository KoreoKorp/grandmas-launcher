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
import WhosHomeSettings from './components/WhosHomeSettings'

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
      { id: 'whoshome',  label: "Who's Home?" },
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
  const [activeTab, setActiveTab] = useState('tiles')
  const [helpAlert, setHelpAlert] = useState(false)
  const [showWizard, setShowWizard] = useState(false)

  useEffect(() => {
    window.admin.getConfig().then(cfg => {
      setConfig(cfg)
      // First-run is tracked explicitly; userName has a non-empty default and
      // therefore cannot reliably indicate whether setup was completed.
      if (cfg.setupCompleted !== true) setShowWizard(true)
    })

    window.admin.onHelpAlert(() => {
      setHelpAlert(true)
      setTimeout(() => setHelpAlert(false), 8000)
    })
  }, [])

  async function save(key, value) {
    await window.admin.set(key, value)
    // Re-fetch config to properly handle nested keys (e.g., 'ai.anthropicKey')
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
          {activeTab === 'whoshome' && (
            <WhosHomeSettings
              whosHome={config.whosHome}
              onSave={w => save('whosHome', { ...config.whosHome, ...w })}
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
