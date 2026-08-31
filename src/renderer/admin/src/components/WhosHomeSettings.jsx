import React, { useState } from 'react'

function newPersonId() {
  return globalThis.crypto?.randomUUID?.() || `person-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

export default function WhosHomeSettings({ whosHome, onSave }) {
  const [gateway, setGateway] = useState(whosHome?.gateway || '')
  const [people, setPeople] = useState(() => (whosHome?.people || []).map(person => ({
    ...person,
    id: person.id || newPersonId()
  })))
  const [saved, setSaved] = useState(false)
  const [scan, setScan] = useState(null)
  const [scanning, setScanning] = useState(false)

  function updatePerson(id, field, value) {
    setPeople(prev => prev.map(p => (p.id === id ? { ...p, [field]: value } : p)))
  }
  function addPerson() {
    setPeople(prev => [...prev, { id: newPersonId(), name: '', device: '' }])
  }
  function removePerson(id) {
    setPeople(prev => prev.filter(p => p.id !== id))
  }

  async function save() {
    const clean = people
      .filter(p => (p.name || '').trim())
      .map(p => ({ id: p.id || newPersonId(), name: p.name.trim(), device: (p.device || '').trim() }))
    await onSave({ gateway: gateway.trim(), people: clean })
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  async function runScan() {
    setScanning(true)
    setScan(null)
    try {
      const res = await window.admin.scanLan()
      setScan(res)
    } catch {
      setScan({ error: 'Could not reach the network' })
    } finally {
      setScanning(false)
    }
  }

  return (
    <div>
      <h2 style={{ margin: '0 0 6px' }}>Who's Home?</h2>
      <p style={{ color: 'var(--text-dim)', marginTop: 0 }}>
        Check which family members are on the Wi-Fi by their phone's network name. Tap the
        home tile to hear and see who is home.
      </p>

      <div className="field" style={{ maxWidth: 480 }}>
        <label>Router Gateway (optional)</label>
        <input
          value={gateway}
          onChange={e => setGateway(e.target.value)}
          placeholder="auto (192.168.1.254)"
        />
        <span style={{ fontSize: '0.8em', color: 'var(--text-dim)' }}>
          Leave blank to auto-detect. AT&amp;T gateways are read directly; others use a network scan.
        </span>
      </div>

      <h3 style={{ margin: '24px 0 8px' }}>Family Members</h3>
      {people.length === 0 && (
        <div style={{ color: 'var(--text-dim)', marginBottom: 12 }}>
          No one added yet. Add a family member and enter the network name their phone shows up as.
        </div>
      )}
      {people.map(p => (
        <div key={p.id} className="card" style={{ marginBottom: 12 }}>
          <div className="row" style={{ gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <div className="field" style={{ flex: '1 1 200px' }}>
              <label>Name</label>
              <input
                value={p.name}
                onChange={e => updatePerson(p.id, 'name', e.target.value)}
                placeholder="e.g. Mom"
              />
            </div>
            <div className="field" style={{ flex: '1 1 220px' }}>
              <label>Phone Network Name</label>
              <input
                value={p.device}
                onChange={e => updatePerson(p.id, 'device', e.target.value)}
                placeholder="e.g. Sarahs-iPhone"
              />
            </div>
            <button
              className="btn btn-danger"
              style={{ padding: '6px 10px' }}
              onClick={() => removePerson(p.id)}
            >
              ✕
            </button>
          </div>
        </div>
      ))}
      <button className="btn btn-ghost" onClick={addPerson}>+ Add Family Member</button>

      <div style={{ marginTop: 24 }}>
        <button className="btn btn-primary" onClick={save}>Save</button>
        <button className="btn btn-ghost" onClick={runScan} disabled={scanning}>
          {scanning ? 'Scanning…' : '🔍 Scan Network Now'}
        </button>
        {saved && <span className="saved-notice">Saved!</span>}
      </div>

      {scan && (
        <div className="card" style={{ marginTop: 16 }}>
          <h3 style={{ marginTop: 0 }}>Devices Found</h3>
          {scan.error && <div style={{ color: 'var(--text-dim)' }}>{scan.error}</div>}
          {!scan.error && scan.discovered?.length === 0 && (
            <div style={{ color: 'var(--text-dim)' }}>No devices responded.</div>
          )}
          {scan.discovered?.map((d, i) => (
            <div key={i} style={{
              padding: '8px 10px',
              borderBottom: '1px solid var(--border)',
              fontSize: '0.9em'
            }}>
              <strong>{d.name || '(unknown)'}</strong>
              {d.ip ? ` · ${d.ip}` : ''}
              {d.mac ? ` · ${d.mac}` : ''}
              {d.connectionType ? ` · ${d.connectionType}` : ''}
              {d.signalLabel ? ` · ${d.signalLabel}` : ''}
            </div>
          ))}
          <p style={{ color: 'var(--text-dim)', fontSize: '0.82em', marginTop: 10 }}>
            Tip: find the phone in this list and copy its name (or MAC) into the matching family
            member above. The router does not expose exact signal strength, so "Weak/Good/Strong"
            is only a rough estimate from Wi-Fi link speed.
          </p>
        </div>
      )}
    </div>
  )
}
