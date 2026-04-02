import React, { useState } from 'react'

export default function ConfusionSettings({ confusion, onSave }) {
  const [c, setC] = useState(confusion)
  const [saved, setSaved] = useState(false)

  function set(field, value) {
    setC(prev => ({ ...prev, [field]: value }))
  }

  async function save() {
    await onSave(c)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div>
      <h2>Safety Settings</h2>

      <div className="card">
        <strong style={{ display: 'block', marginBottom: 12 }}>Inactivity Timeout</strong>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, textTransform: 'none', letterSpacing: 0 }}>
          <input
            type="checkbox"
            checked={c.inactivityEnabled}
            onChange={e => set('inactivityEnabled', e.target.checked)}
            style={{ width: 'auto' }}
          />
          Return to home screen after inactivity
        </label>
        <div className="field">
          <label>Timeout (minutes)</label>
          <input
            type="number"
            min={1}
            max={120}
            value={c.inactivityMinutes}
            onChange={e => set('inactivityMinutes', Number(e.target.value))}
            style={{ width: 100 }}
          />
        </div>
      </div>

      <div className="card">
        <strong style={{ display: 'block', marginBottom: 12 }}>Rapid-Tap Detection</strong>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, textTransform: 'none', letterSpacing: 0 }}>
          <input
            type="checkbox"
            checked={c.rapidTapEnabled}
            onChange={e => set('rapidTapEnabled', e.target.checked)}
            style={{ width: 'auto' }}
          />
          Show calming overlay on rapid/frantic tapping
        </label>
        <div className="row">
          <div className="field" style={{ flex: 1 }}>
            <label>Tap count threshold</label>
            <input
              type="number"
              min={5}
              max={50}
              value={c.rapidTapCount}
              onChange={e => set('rapidTapCount', Number(e.target.value))}
            />
          </div>
          <div className="field" style={{ flex: 1 }}>
            <label>Within (seconds)</label>
            <input
              type="number"
              min={1}
              max={10}
              value={c.rapidTapWindowMs / 1000}
              onChange={e => set('rapidTapWindowMs', Number(e.target.value) * 1000)}
            />
          </div>
        </div>
      </div>

      <div className="row">
        <button className="btn btn-primary" onClick={save}>Save</button>
        {saved && <span className="saved-notice">Saved!</span>}
      </div>
    </div>
  )
}
