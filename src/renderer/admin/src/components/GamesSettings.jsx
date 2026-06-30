import React, { useState } from 'react'

function emptyGame() {
  return { id: Date.now().toString(), name: '', icon: '🎮', path: '' }
}

export default function GamesSettings({ games, onSave }) {
  const [onlineUrl, setOnlineUrl] = useState(games?.onlineUrl || 'https://www.pogo.com')
  const [localGames, setLocalGames] = useState(games?.localGames || [])
  const [saved, setSaved] = useState(false)

  function addGame() {
    setLocalGames(prev => [...prev, emptyGame()])
  }

  function removeGame(id) {
    setLocalGames(prev => prev.filter(g => g.id !== id))
  }

  function updateGame(id, field, value) {
    setLocalGames(prev => prev.map(g => g.id === id ? { ...g, [field]: value } : g))
  }

  async function pickPath(id) {
    const path = await window.admin.pickApp()
    if (path) updateGame(id, 'path', path)
  }

  async function save() {
    await onSave({ onlineUrl, localGames })
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div style={S.wrap}>
      <h2 style={S.heading}>🎮 Games Settings</h2>

      {/* Online Games URL */}
      <section style={S.section}>
        <h3 style={S.sectionTitle}>Online Games URL</h3>
        <p style={S.hint}>When Jean taps "Online Games" in the Games tile, this website opens.</p>
        <input
          style={S.input}
          type="url"
          value={onlineUrl}
          onChange={e => setOnlineUrl(e.target.value)}
          placeholder="https://www.pogo.com"
        />
      </section>

      {/* Local Games */}
      <section style={S.section}>
        <div style={S.sectionHeader}>
          <h3 style={S.sectionTitle}>Local Games</h3>
          <button style={S.addBtn} onClick={addGame}>+ Add Game</button>
        </div>
        <p style={S.hint}>Games installed on this computer that Jean can launch with one tap.</p>

        {localGames.length === 0 && (
          <div style={S.empty}>No local games added yet. Click "+ Add Game" to get started.</div>
        )}

        <div style={S.gameList}>
          {localGames.map(game => (
            <div key={game.id} style={S.gameRow}>
              <input
                style={{ ...S.input, width: 60, textAlign: 'center', padding: '8px 4px' }}
                value={game.icon}
                onChange={e => updateGame(game.id, 'icon', e.target.value)}
                placeholder="🎮"
                maxLength={2}
              />
              <input
                style={{ ...S.input, flex: 1 }}
                value={game.name}
                onChange={e => updateGame(game.id, 'name', e.target.value)}
                placeholder="Game name (e.g. Solitaire)"
              />
              <div style={S.pathWrap}>
                <input
                  style={{ ...S.input, flex: 1, fontSize: '0.85em' }}
                  value={game.path}
                  onChange={e => updateGame(game.id, 'path', e.target.value)}
                  placeholder="C:\path\to\game.exe"
                />
                <button style={S.pickBtn} onClick={() => pickPath(game.id)}>Browse…</button>
              </div>
              <button style={S.removeBtn} onClick={() => removeGame(game.id)}>✕</button>
            </div>
          ))}
        </div>
      </section>

      <button style={{ ...S.saveBtn, ...(saved ? S.saveBtnSuccess : {}) }} onClick={save}>
        {saved ? '✓ Saved!' : 'Save Changes'}
      </button>
    </div>
  )
}

const S = {
  wrap: { padding: '28px 32px', maxWidth: 700, display: 'flex', flexDirection: 'column', gap: 24 },
  heading: { fontSize: '1.4em', fontWeight: 800, color: 'var(--text)', margin: 0 },
  section: { display: 'flex', flexDirection: 'column', gap: 10 },
  sectionHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  sectionTitle: { fontSize: '1.05em', fontWeight: 700, color: 'var(--text)', margin: 0 },
  hint: { fontSize: '0.88em', color: 'var(--text-dim)', margin: 0, lineHeight: 1.4 },
  input: {
    background: 'var(--input-bg)',
    border: '1px solid var(--border)',
    borderRadius: 8,
    color: 'var(--text)',
    padding: '10px 14px',
    fontSize: '1em',
    outline: 'none',
    width: '100%'
  },
  addBtn: {
    padding: '8px 18px',
    background: 'var(--accent)',
    color: '#1C322D',
    borderRadius: 8,
    fontWeight: 700,
    cursor: 'pointer',
    border: 'none',
    fontSize: '0.95em'
  },
  gameList: { display: 'flex', flexDirection: 'column', gap: 10 },
  gameRow: { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  pathWrap: { display: 'flex', flex: 2, gap: 6, minWidth: 200 },
  pickBtn: {
    padding: '8px 14px',
    background: 'var(--card)',
    border: '1px solid var(--border)',
    borderRadius: 8,
    color: 'var(--text)',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    fontSize: '0.88em'
  },
  removeBtn: {
    padding: '8px 12px',
    background: 'rgba(224,85,85,0.15)',
    border: '1px solid rgba(224,85,85,0.3)',
    borderRadius: 8,
    color: '#e05555',
    cursor: 'pointer',
    fontWeight: 700
  },
  empty: {
    padding: '16px',
    background: 'var(--card)',
    borderRadius: 10,
    color: 'var(--text-dim)',
    fontSize: '0.9em',
    textAlign: 'center'
  },
  saveBtn: {
    alignSelf: 'flex-start',
    padding: '12px 28px',
    background: 'var(--accent)',
    color: '#1C322D',
    borderRadius: 10,
    fontWeight: 800,
    cursor: 'pointer',
    border: 'none',
    fontSize: '1em',
    transition: 'background 0.2s'
  },
  saveBtnSuccess: { background: '#4caf7d', color: '#fff' }
}
