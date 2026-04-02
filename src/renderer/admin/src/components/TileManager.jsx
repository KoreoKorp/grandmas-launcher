import React, { useState } from 'react'

const TILE_TYPES = ['web', 'app', 'built-in']
const BUILT_IN_TARGETS = ['photos', 'weather', 'messages']

function isImagePath(icon) {
  if (!icon) return false
  return /\.(png|jpg|jpeg|gif|svg|ico|webp|bmp)$/i.test(icon) ||
         /^(https?:\/\/|file:\/\/|data:image)/i.test(icon) ||
         /^[A-Z]:\\/i.test(icon)
}

function emptyTile() {
  return { id: Date.now().toString(), type: 'web', icon: '🔗', label: '', target: '', kiosk: false }
}

export default function TileManager({ tiles, onSave }) {
  const [list, setList] = useState(tiles)
  const [editing, setEditing] = useState(null)
  const [saved, setSaved] = useState(false)

  function update(id, field, value) {
    setList(prev => prev.map(t => t.id === id ? { ...t, [field]: value } : t))
  }

  async function pickImageFor(id) {
    const path = await window.admin.pickImage()
    if (path) update(id, 'icon', path)
  }

  function addTile() {
    const t = emptyTile()
    setList(prev => [...prev, t])
    setEditing(t.id)
  }

  function removeTile(id) {
    setList(prev => prev.filter(t => t.id !== id))
  }

  function moveUp(index) {
    if (index === 0) return
    setList(prev => {
      const next = [...prev]
      ;[next[index - 1], next[index]] = [next[index], next[index - 1]]
      return next
    })
  }

  function moveDown(index) {
    setList(prev => {
      if (index === prev.length - 1) return prev
      const next = [...prev]
      ;[next[index], next[index + 1]] = [next[index + 1], next[index]]
      return next
    })
  }

  async function save() {
    await onSave(list)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div>
      <div className="row" style={{ marginBottom: 20 }}>
        <h2 style={{ margin: 0 }}>Tile Manager</h2>
        <button className="btn btn-primary" onClick={addTile}>+ Add Tile</button>
        <button className="btn btn-primary" onClick={save}>Save</button>
        {saved && <span className="saved-notice">Saved!</span>}
      </div>

      {list.map((tile, index) => (
        <div key={tile.id} className="card">
          <div className="row" style={{ marginBottom: 12 }}>
            {/* Icon preview + input */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {isImagePath(tile.icon) ? (
                <img
                  src={tile.icon}
                  alt=""
                  style={{ width: 36, height: 36, objectFit: 'contain', borderRadius: 4, border: '1px solid var(--border)' }}
                />
              ) : (
                <input
                  value={tile.icon}
                  onChange={e => update(tile.id, 'icon', e.target.value)}
                  style={{ width: 50, textAlign: 'center', fontSize: '1.4em' }}
                  placeholder="🔗"
                />
              )}
              <button
                className="btn btn-ghost"
                style={{ padding: '4px 8px', fontSize: '0.8em', whiteSpace: 'nowrap' }}
                onClick={() => pickImageFor(tile.id)}
                title="Choose a custom image for this tile"
              >
                🖼️
              </button>
              {isImagePath(tile.icon) && (
                <button
                  className="btn btn-ghost"
                  style={{ padding: '4px 8px', fontSize: '0.8em' }}
                  onClick={() => update(tile.id, 'icon', '🔗')}
                  title="Reset to emoji"
                >
                  ✕
                </button>
              )}
            </div>
            <input
              value={tile.label}
              onChange={e => update(tile.id, 'label', e.target.value)}
              placeholder="Label"
              style={{ flex: 1 }}
            />
            <select
              value={tile.type}
              onChange={e => update(tile.id, 'type', e.target.value)}
              style={{ width: 100 }}
            >
              {TILE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <button className="btn btn-ghost" style={{ padding: '6px 10px' }} onClick={() => moveUp(index)}>↑</button>
            <button className="btn btn-ghost" style={{ padding: '6px 10px' }} onClick={() => moveDown(index)}>↓</button>
            <button className="btn btn-danger" style={{ padding: '6px 10px' }} onClick={() => removeTile(tile.id)}>✕</button>
          </div>

          {tile.type === 'web' && (
            <div className="row">
              <div style={{ flex: 1 }} className="field">
                <label>URL</label>
                <input
                  value={tile.target}
                  onChange={e => update(tile.id, 'target', e.target.value)}
                  placeholder="https://..."
                />
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 20, whiteSpace: 'nowrap' }}>
                <input
                  type="checkbox"
                  checked={tile.kiosk}
                  onChange={e => update(tile.id, 'kiosk', e.target.checked)}
                  style={{ width: 'auto' }}
                />
                Kiosk mode
              </label>
            </div>
          )}

          {tile.type === 'app' && (
            <div className="field">
              <label>App Path</label>
              <input
                value={tile.target}
                onChange={e => update(tile.id, 'target', e.target.value)}
                placeholder="C:\Program Files\..."
              />
            </div>
          )}

          {tile.type === 'built-in' && (
            <div className="field">
              <label>Built-in Feature</label>
              <select
                value={tile.target}
                onChange={e => update(tile.id, 'target', e.target.value)}
              >
                <option value="">Select...</option>
                {BUILT_IN_TARGETS.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
