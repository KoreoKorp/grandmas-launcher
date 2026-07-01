import React, { useState } from 'react'

export default function DisplaySettings({ display, onSave }) {
  const [fontScale, setFontScale] = useState(display.fontScale)
  const [saved, setSaved] = useState(false)
  const [openrouterKey, setOpenrouterKey] = useState('')
  const [aiKeySaved, setAiKeySaved] = useState(false)
  const [volumeLevel, setVolumeLevel] = useState(display.volumeLevel ?? 40)
  const [volumeSaved, setVolumeSaved] = useState(false)
  const [ambientBackground, setAmbientBackground] = useState(display.ambientBackground !== false)

  async function saveAmbient(next) {
    setAmbientBackground(next)
    await onSave({ ambientBackground: next })
  }

  const [newPin, setNewPin] = useState('')
  const [confirmPin, setConfirmPin] = useState('')
  const [pinMsg, setPinMsg] = useState(null) // { ok, text }

  async function saveFont() {
    await onSave({ fontScale })
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  async function saveVolume() {
    const safe = Math.min(100, Math.max(0, Number(volumeLevel)))
    await onSave({ volumeLevel: safe })
    setVolumeSaved(true)
    setTimeout(() => setVolumeSaved(false), 2000)
  }

  async function savePin() {
    if (newPin.length < 4) { setPinMsg({ ok: false, text: 'PIN must be at least 4 digits.' }); return }
    if (newPin !== confirmPin) { setPinMsg({ ok: false, text: 'PINs do not match.' }); return }
    await window.admin.set('adminPin', newPin)
    setNewPin(''); setConfirmPin('')
    setPinMsg({ ok: true, text: 'PIN saved!' })
    setTimeout(() => setPinMsg(null), 3000)
  }

  async function clearPin() {
    await window.admin.set('adminPin', '')
    setPinMsg({ ok: true, text: 'PIN removed — admin panel is now open access.' })
    setTimeout(() => setPinMsg(null), 4000)
  }

  return (
    <div>
      <h2>Display Settings</h2>
      <div className="card">
        <div className="field">
          <label>Font Size</label>
          <select value={fontScale} onChange={e => setFontScale(e.target.value)} style={{ width: 'auto' }}>
            <option value="small">Small</option>
            <option value="medium">Medium (default)</option>
            <option value="large">Large</option>
            <option value="xlarge">Extra Large</option>
            <option value="xxlarge">Maximum (biggest)</option>
          </select>
        </div>
        <div className="row">
          <button className="btn btn-primary" onClick={saveFont}>Save</button>
          {saved && <span className="saved-notice">Saved!</span>}
        </div>
      </div>

      <h2>Home Background</h2>
      <div className="card">
        <label style={{ display: 'flex', alignItems: 'center', gap: 12, textTransform: 'none', letterSpacing: 0, cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={ambientBackground}
            onChange={e => saveAmbient(e.target.checked)}
            style={{ width: 'auto', cursor: 'pointer' }}
          />
          <span style={{ color: 'var(--text)', fontWeight: 600 }}>
            Show the calm animated dot background on the home screen
          </span>
        </label>
        <div style={{ fontSize: '0.82em', color: 'var(--text-dim)', marginTop: 8 }}>
          Turn this off for a plain, still background. The animation also turns
          itself off automatically when the system "reduce motion" setting is on.
        </div>
      </div>

      <h2>Volume Lock</h2>
      <div className="card">
        <div className="field">
          <label>Maximum volume (0–100)</label>
          <input
            type="number"
            min={0}
            max={100}
            value={volumeLevel}
            onChange={e => setVolumeLevel(Number(e.target.value))}
            style={{ width: 100 }}
          />
          <div style={{ fontSize: '0.82em', color: 'var(--text-dim)', marginTop: 4 }}>
            System volume is checked every 30 seconds and nudged back to this level if changed.
          </div>
        </div>
        <div className="row">
          <button className="btn btn-primary" onClick={saveVolume}>Save</button>
          {volumeSaved && <span className="saved-notice">Saved!</span>}
        </div>
      </div>

      <h2>Admin PIN</h2>
      <div className="card">
        <p style={{ color: 'var(--text-dim)', fontSize: '0.9em', marginBottom: 16 }}>
          Set a PIN to prevent accidental access to the admin panel. Leave blank to disable.
        </p>
        <div className="row" style={{ marginBottom: 10 }}>
          <div className="field" style={{ flex: 1, marginBottom: 0 }}>
            <label>New PIN</label>
            <input
              type="password"
              inputMode="numeric"
              value={newPin}
              onChange={e => setNewPin(e.target.value.replace(/\D/g, '').slice(0, 8))}
              placeholder="4–8 digits"
            />
          </div>
          <div className="field" style={{ flex: 1, marginBottom: 0 }}>
            <label>Confirm PIN</label>
            <input
              type="password"
              inputMode="numeric"
              value={confirmPin}
              onChange={e => setConfirmPin(e.target.value.replace(/\D/g, '').slice(0, 8))}
              placeholder="Repeat PIN"
            />
          </div>
        </div>
        <div className="row">
          <button className="btn btn-primary" onClick={savePin}>Set PIN</button>
          <button className="btn btn-ghost" onClick={clearPin}>Remove PIN</button>
          {pinMsg && (
            <span style={{ fontSize: '0.85em', fontWeight: 600, color: pinMsg.ok ? 'var(--success)' : 'var(--danger)' }}>
              {pinMsg.text}
            </span>
          )}
        </div>
      </div>

      <h2>AI Helper (OpenRouter)</h2>
      <div className="card">
        {display.aiKeySet && !aiKeySaved && !openrouterKey && (
          <div style={{ fontSize: '0.85em', color: 'var(--success)', fontWeight: 600, marginBottom: 8 }}>
            ✓ API key is configured
          </div>
        )}
        <div className="field">
          <label>OpenRouter API Key</label>
          <input
            type="password"
            value={openrouterKey}
            onChange={e => setOpenrouterKey(e.target.value)}
            placeholder={display.aiKeySet ? '(leave blank to keep existing key)' : 'sk-or-…'}
          />
          <div style={{ fontSize: '0.82em', color: 'var(--text-dim)', marginTop: 4 }}>
            Get a free key at openrouter.ai. Powers the "Ask AI" tile on the home screen.
          </div>
        </div>
        <div className="row">
          <button
            className="btn btn-primary"
            disabled={!openrouterKey.trim()}
            onClick={async () => {
              if (!openrouterKey.trim()) return
              await window.admin.set('ai.openrouterKey', openrouterKey.trim())
              setOpenrouterKey('')
              setAiKeySaved(true)
              setTimeout(() => setAiKeySaved(false), 2000)
            }}
          >
            Save Key
          </button>
          {aiKeySaved && <span className="saved-notice">Saved!</span>}
        </div>
      </div>

      <div className="card" style={{ color: 'var(--text-dim)', fontSize: '0.9em' }}>
        <strong style={{ color: 'var(--text)' }}>Monitor assignment</strong>
        <p style={{ marginTop: 8 }}>
          The launcher automatically opens on the largest connected display (external monitor)
          and the admin panel opens on the smaller display (laptop screen). Reconnect monitors
          and restart the app if placement is wrong.
        </p>
      </div>
    </div>
  )
}
