import React, { useState, useEffect } from 'react'

export default function DisplaySettings({ display, onSave }) {
  const [fontScale, setFontScale] = useState(display.fontScale)
  const [saved, setSaved] = useState(false)
  const [anthropicKey, setAnthropicKey] = useState('')
  const [aiKeySaved, setAiKeySaved] = useState(false)
  const [cloudTTS, setCloudTTS] = useState(true)
  const [volumeLevel, setVolumeLevel] = useState(display.volumeLevel ?? 40)
  const [volumeSaved, setVolumeSaved] = useState(false)
  const [ambientBackground, setAmbientBackground] = useState(display.ambientBackground !== false)

  async function saveAmbient(next) {
    setAmbientBackground(next)
    await onSave({ ambientBackground: next })
  }

  useEffect(() => {
    window.admin.getConfig().then(c => setCloudTTS(c.ai?.cloudTTS !== false)).catch(() => {})
  }, [])

  async function saveCloudTTS(next) {
    setCloudTTS(next)
    await window.admin.set('ai.cloudTTS', next)
  }

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

      <h2>AI Helper (Claude)</h2>
      <div className="card">
        {display.aiKeySet && !aiKeySaved && !anthropicKey && (
          <div style={{ fontSize: '0.85em', color: 'var(--success)', fontWeight: 600, marginBottom: 8 }}>
            ✓ API key is configured
          </div>
        )}
        <div className="field">
          <label>Claude API Key (Anthropic)</label>
          <input
            type="password"
            value={anthropicKey}
            onChange={e => setAnthropicKey(e.target.value)}
            placeholder={display.aiKeySet ? '(leave blank to keep existing key)' : 'sk-ant-…'}
          />
          <div style={{ fontSize: '0.82em', color: 'var(--text-dim)', marginTop: 4 }}>
            Get a key at console.anthropic.com. Powers Buddy the cat and the weekly digest.
          </div>
        </div>
        <div className="row">
          <button
            className="btn btn-primary"
            disabled={!anthropicKey.trim()}
            onClick={async () => {
              if (!anthropicKey.trim()) return
              await window.admin.set('ai.anthropicKey', anthropicKey.trim())
              setAnthropicKey('')
              setAiKeySaved(true)
              setTimeout(() => setAiKeySaved(false), 2000)
            }}
          >
            Save Key
          </button>
          {aiKeySaved && <span className="saved-notice">Saved!</span>}
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10, cursor: 'pointer', fontSize: '0.9em' }}>
          <input
            type="checkbox"
            checked={cloudTTS}
            onChange={e => saveCloudTTS(e.target.checked)}
          />
          Natural cloud voice for Buddy (needs internet; falls back to the
          local Windows voice offline)
        </label>
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
