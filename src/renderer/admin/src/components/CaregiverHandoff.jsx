import React, { useRef, useState } from 'react'

export default function CaregiverHandoff({ onImportComplete }) {
  const fileInputRef = useRef(null)
  const [importState, setImportState] = useState(null) // null | 'confirming' | 'done' | 'error'
  const [pendingConfig, setPendingConfig] = useState(null)

  async function handleExport() {
    const config = await window.admin.getConfig()
    const json = JSON.stringify(config, null, 2)
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `grandmas-launcher-config-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  function handleFileChange(e) {
    const file = e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = evt => {
      try {
        const parsed = JSON.parse(evt.target.result)
        setPendingConfig(parsed)
        setImportState('confirming')
      } catch {
        setImportState('error')
      }
    }
    reader.readAsText(file)
    // reset so same file can be re-selected
    e.target.value = ''
  }

  async function confirmImport() {
    if (!pendingConfig) return
    // Write each top-level key individually so store listeners fire
    for (const [key, value] of Object.entries(pendingConfig)) {
      if (key === 'configHistory') continue // skip internal backup history
      await window.admin.set(key, value)
    }
    setPendingConfig(null)
    setImportState('done')
    onImportComplete?.()
  }

  return (
    <div>
      <h2>Caregiver Handoff</h2>

      <div className="card">
        <strong style={{ color: 'var(--text)' }}>Export Settings</strong>
        <p style={{ marginTop: 8, color: 'var(--text-dim)', fontSize: '0.9em', lineHeight: 1.6 }}>
          Download a backup of all settings as a JSON file. Use this to hand off to another caregiver,
          move to a new computer, or keep an off-device backup.
        </p>
        <div style={{ marginTop: 14 }}>
          <button className="btn btn-primary" onClick={handleExport}>
            ⬇ Export Settings
          </button>
        </div>
      </div>

      <div className="card">
        <strong style={{ color: 'var(--text)' }}>Import Settings</strong>
        <p style={{ marginTop: 8, color: 'var(--text-dim)', fontSize: '0.9em', lineHeight: 1.6 }}>
          Load a previously exported config file. <strong style={{ color: 'var(--danger)' }}>This will overwrite all current settings.</strong>
        </p>
        <div style={{ marginTop: 14, display: 'flex', gap: 10, alignItems: 'center' }}>
          <button className="btn btn-ghost" onClick={() => fileInputRef.current?.click()}>
            ⬆ Import Settings…
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json,application/json"
            style={{ display: 'none' }}
            onChange={handleFileChange}
          />
        </div>

        {importState === 'confirming' && pendingConfig && (
          <div style={s.confirmBox}>
            <div style={{ fontWeight: 600, marginBottom: 8 }}>
              Ready to import — this will replace all current settings.
            </div>
            <div style={{ fontSize: '0.85em', color: 'var(--text-dim)', marginBottom: 14 }}>
              Grandma's name in file: <strong style={{ color: 'var(--text)' }}>{pendingConfig.userName || '(not set)'}</strong>
            </div>
            <div className="row">
              <button className="btn btn-danger" onClick={confirmImport}>Yes, Import Now</button>
              <button className="btn btn-ghost" onClick={() => { setImportState(null); setPendingConfig(null) }}>Cancel</button>
            </div>
          </div>
        )}

        {importState === 'done' && (
          <div style={s.successBox}>
            ✓ Settings imported. Restart the app for all changes to take effect.
          </div>
        )}

        {importState === 'error' && (
          <div style={s.errorBox}>
            Could not read that file — make sure it's a valid launcher export.
          </div>
        )}
      </div>

      <div className="card" style={{ color: 'var(--text-dim)', fontSize: '0.88em', lineHeight: 1.6 }}>
        <strong style={{ color: 'var(--text)' }}>What's included in the export?</strong>
        <p style={{ marginTop: 8 }}>
          Everything: home screen tiles, contacts, messenger PIN, display settings, weather location,
          games, photos folder, safety settings, and Jean's daily message. Passwords are included in plain text —
          store the file somewhere private.
        </p>
      </div>
    </div>
  )
}

const s = {
  confirmBox: {
    marginTop: 16,
    background: 'rgba(220,80,80,0.08)',
    border: '1px solid rgba(220,80,80,0.3)',
    borderRadius: 10,
    padding: '16px 18px',
  },
  successBox: {
    marginTop: 14,
    padding: '12px 16px',
    background: 'rgba(80,200,120,0.1)',
    border: '1px solid rgba(80,200,120,0.35)',
    borderRadius: 8,
    color: '#4ec87a',
    fontWeight: 600,
    fontSize: '0.9em',
  },
  errorBox: {
    marginTop: 14,
    padding: '12px 16px',
    background: 'rgba(220,80,80,0.1)',
    border: '1px solid rgba(220,80,80,0.35)',
    borderRadius: 8,
    color: 'var(--danger)',
    fontWeight: 600,
    fontSize: '0.9em',
  }
}
