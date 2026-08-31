import React, { useState } from 'react'

const TILE_TYPES = ['web', 'app', 'built-in']
const BUILT_IN_TARGETS = ['photos', 'weather', 'messages', 'music', 'games', 'whoshome']

const DEFAULT_TILES = [
  { id: 'news',      type: 'web',      icon: '📰',  label: 'News',     target: 'https://apnews.com',            kiosk: false },
  { id: 'pinterest', type: 'web',      icon: '📌',  label: 'Pinterest', target: 'https://pinterest.com',        kiosk: false },
  { id: 'youtube',   type: 'web',      icon: '▶️',  label: 'YouTube',  target: 'https://www.youtube.com',       kiosk: false },
  { id: 'bermuda-news', type: 'web',   icon: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxMDAgMTAwIj4KICA8Y2lyY2xlIGN4PSI1MCIgY3k9IjUwIiByPSI0OCIgZmlsbD0iIzJFODZBQiIvPgogIDxwYXRoIGQ9IgogICAgTSAzMCAyOAogICAgQyA0MCAyNCwgNTUgMjYsIDYyIDMyCiAgICBDIDY4IDM3LCA3MCA0NCwgNjYgNDkKICAgIEMgNzQgNTIsIDgwIDU4LCA3OCA2NAogICAgQyA3NiA3MCwgNjggNzIsIDYwIDcwCiAgICBDIDUyIDY4LCA0OCA2MiwgNTAgNTYKICAgIEMgNDQgNjAsIDM2IDYyLCAzMCA1OAogICAgQyAyNCA1NCwgMjQgNDYsIDMwIDQyCiAgICBDIDI0IDQwLCAyMCAzNCwgMjQgMzAKICAgIEMgMjYgMjcsIDI4IDI3LCAzMCAyOAogICAgWiIKICAgIGZpbGw9IiM0Q0FGNTAiIHN0cm9rZT0iIzJFN0QzMiIgc3Ryb2tlLXdpZHRoPSIxLjUiLz4KPC9zdmc+Cg==', label: 'Bermuda News', target: 'https://www.royalgazette.com/', kiosk: false },
  { id: 'photos',    type: 'built-in', icon: '🖼️',  label: 'Photos',   target: 'photos' },
  { id: 'games',     type: 'built-in', icon: '🎮',  label: 'Games',    target: 'games' },
  { id: 'weather',   type: 'built-in', icon: '🌤️', label: 'Weather',  target: 'weather' },
  { id: 'messages',  type: 'built-in', icon: '💬',  label: 'Messages', target: 'messages' },
  { id: 'music',     type: 'built-in', icon: '🎵',  label: 'Music',    target: 'music' },
  { id: 'whos-home', type: 'built-in', icon: '🏡',  label: "Who's Home?", target: 'whoshome' }
]

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
  const [confirmReset, setConfirmReset] = useState(false)

  async function resetToDefaults() {
    setList(DEFAULT_TILES)
    await onSave(DEFAULT_TILES)
    setConfirmReset(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

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
        {confirmReset ? (
          <>
            <span style={{ color: 'var(--text-dim)', fontSize: '0.9em' }}>Reset all tiles to defaults?</span>
            <button className="btn btn-danger" onClick={resetToDefaults}>Yes, reset</button>
            <button className="btn btn-ghost" onClick={() => setConfirmReset(false)}>Cancel</button>
          </>
        ) : (
          <button className="btn btn-ghost" onClick={() => setConfirmReset(true)} title="Remove all custom tiles and restore the 8 original defaults">
            ↺ Reset to Defaults
          </button>
        )}
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
