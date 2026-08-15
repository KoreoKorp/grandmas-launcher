import React, { useRef, useState } from 'react'
import { encryptConfig, decryptConfig, isEncryptedEnvelope } from '../utils/handoffCrypto'

export default function CaregiverHandoff({ onImportComplete }) {
  const fileInputRef = useRef(null)
  // null | 'confirming' | 'done' | 'done-with-skips' | 'error'
  const [importState, setImportState] = useState(null)
  const [pendingConfig, setPendingConfig] = useState(null)
  const [skippedKeys, setSkippedKeys] = useState([])
  const [pendingEnvelope, setPendingEnvelope] = useState(null) // encrypted file awaiting a passphrase
  const [importPassphrase, setImportPassphrase] = useState('')
  const [importPassError, setImportPassError] = useState(null)

  const [exportOpen, setExportOpen] = useState(false)
  const [exportPass1, setExportPass1] = useState('')
  const [exportPass2, setExportPass2] = useState('')
  const [exportError, setExportError] = useState(null)

  function downloadJson(obj) {
    const json = JSON.stringify(obj, null, 2)
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `grandmas-launcher-config-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  async function confirmExport() {
    setExportError(null)
    if (exportPass1.length < 6) {
      setExportError('Use at least 6 characters — this is what protects every password in the file.')
      return
    }
    if (exportPass1 !== exportPass2) {
      setExportError("Those two didn't match — try again.")
      return
    }
    const config = await window.admin.getConfig()
    const envelope = await encryptConfig(config, exportPass1)
    downloadJson(envelope)
    setExportOpen(false)
    setExportPass1('')
    setExportPass2('')
  }

  function handleFileChange(e) {
    const file = e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = evt => {
      try {
        const parsed = JSON.parse(evt.target.result)
        if (isEncryptedEnvelope(parsed)) {
          setPendingEnvelope(parsed)
          setImportPassphrase('')
          setImportPassError(null)
          setImportState('needs-passphrase')
        } else {
          // Older export from before encryption was added — still importable.
          setPendingConfig(parsed)
          setImportState('confirming')
        }
      } catch {
        setImportState('error')
      }
    }
    reader.readAsText(file)
    // reset so same file can be re-selected
    e.target.value = ''
  }

  async function unlockImport() {
    setImportPassError(null)
    try {
      const config = await decryptConfig(pendingEnvelope, importPassphrase)
      setPendingConfig(config)
      setPendingEnvelope(null)
      setImportState('confirming')
    } catch {
      // AES-GCM deliberately doesn't distinguish "wrong key" from "corrupt
      // data" — telling them apart would leak information useful for
      // brute-forcing the passphrase.
      setImportPassError('Wrong passphrase, or this file is corrupted.')
    }
  }

  async function confirmImport() {
    if (!pendingConfig) return
    // Write each top-level key individually so store listeners fire. The
    // main process rejects anything that isn't a real configurable setting
    // (this file's shape isn't trusted — it can come from another machine
    // or person) — collect what got skipped so she's not left wondering
    // why part of an old/corrupted export didn't apply.
    const skipped = []
    for (const [key, value] of Object.entries(pendingConfig)) {
      if (key === 'configHistory') continue // skip internal backup history
      const result = await window.admin.set(key, value)
      if (result && result.ok === false) skipped.push(key)
    }
    setPendingConfig(null)
    setImportState(skipped.length > 0 ? 'done-with-skips' : 'done')
    setSkippedKeys(skipped)
    onImportComplete?.()
  }

  return (
    <div>
      <h2>Caregiver Handoff</h2>

      <div className="card">
        <strong style={{ color: 'var(--text)' }}>Export Settings</strong>
        <p style={{ marginTop: 8, color: 'var(--text-dim)', fontSize: '0.9em', lineHeight: 1.6 }}>
          Download a backup of all settings as a JSON file. Use this to hand off to another caregiver,
          move to a new computer, or keep an off-device backup. The file is encrypted with a passphrase
          you choose — anyone who gets the file still needs that passphrase to read it.
        </p>
        {!exportOpen ? (
          <div style={{ marginTop: 14 }}>
            <button className="btn btn-primary" onClick={() => setExportOpen(true)}>
              ⬇ Export Settings
            </button>
          </div>
        ) : (
          <div style={s.confirmBox}>
            <div style={{ fontWeight: 600, marginBottom: 8 }}>Choose a passphrase for this export</div>
            <div style={{ fontSize: '0.85em', color: 'var(--text-dim)', marginBottom: 12 }}>
              Share it with the person importing this file through a different channel than the file
              itself (text it, say it on the phone). If you lose it, this specific export can't be recovered.
            </div>
            <div className="field" style={{ marginBottom: 10 }}>
              <input
                type="password"
                value={exportPass1}
                onChange={e => setExportPass1(e.target.value)}
                placeholder="Passphrase (at least 6 characters)"
              />
            </div>
            <div className="field" style={{ marginBottom: 10 }}>
              <input
                type="password"
                value={exportPass2}
                onChange={e => setExportPass2(e.target.value)}
                placeholder="Confirm passphrase"
              />
            </div>
            {exportError && <div style={{ color: 'var(--danger)', fontSize: '0.85em', marginBottom: 10 }}>{exportError}</div>}
            <div className="row">
              <button className="btn btn-primary" onClick={confirmExport}>Encrypt &amp; Download</button>
              <button className="btn btn-ghost" onClick={() => { setExportOpen(false); setExportPass1(''); setExportPass2(''); setExportError(null) }}>
                Cancel
              </button>
            </div>
          </div>
        )}
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

        {importState === 'needs-passphrase' && pendingEnvelope && (
          <div style={s.confirmBox}>
            <div style={{ fontWeight: 600, marginBottom: 8 }}>This file is encrypted</div>
            <div style={{ fontSize: '0.85em', color: 'var(--text-dim)', marginBottom: 12 }}>
              Enter the passphrase whoever exported it gave you.
            </div>
            <div className="field" style={{ marginBottom: 10 }}>
              <input
                type="password"
                value={importPassphrase}
                onChange={e => setImportPassphrase(e.target.value)}
                placeholder="Passphrase"
                autoFocus
              />
            </div>
            {importPassError && <div style={{ color: 'var(--danger)', fontSize: '0.85em', marginBottom: 10 }}>{importPassError}</div>}
            <div className="row">
              <button className="btn btn-primary" onClick={unlockImport} disabled={!importPassphrase}>Unlock</button>
              <button className="btn btn-ghost" onClick={() => { setImportState(null); setPendingEnvelope(null); setImportPassphrase(''); setImportPassError(null) }}>
                Cancel
              </button>
            </div>
          </div>
        )}

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

        {importState === 'done-with-skips' && (
          <div style={s.errorBox}>
            Imported, but skipped {skippedKeys.length} unrecognized setting{skippedKeys.length === 1 ? '' : 's'}
            {' '}({skippedKeys.join(', ')}) — this file may be from a different or older version.
            Restart the app for the rest to take effect.
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
          Everything: home screen tiles, contacts, messenger PIN, admin PIN, display settings, weather location,
          games, photos folder, safety settings, and Jean's daily message. The file itself is encrypted with
          the passphrase you set at export — but still store it somewhere private and share the passphrase
          separately, the same way you'd handle any password.
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
