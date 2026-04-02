import React, { useState, useEffect } from 'react'

const TYPE_LABELS = {
  'tile-open': 'Tile opened',
  'app-launched': 'App launched',
  'help-pressed': '⚠️ Help pressed',
  'help-overlay-shown': 'Help overlay shown',
  'inactivity-timeout': 'Inactivity — returned home',
  'rapid-tap': 'Rapid tap detected',
  'message-sent': 'Message sent'
}

function relativeTime(ts) {
  const diff = Date.now() - ts
  if (diff < 60_000) return 'just now'
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`
  if (diff < 7 * 86_400_000) return `${Math.floor(diff / 86_400_000)}d ago`
  return new Date(ts).toLocaleDateString()
}

export default function ActivityLog() {
  const [log, setLog] = useState([])
  const [filter, setFilter] = useState('')

  useEffect(() => {
    window.admin.getActivityLog().then(entries => setLog([...entries].reverse()))
  }, [])

  async function clear() {
    if (!confirm('Clear the activity log?')) return
    await window.admin.clearActivityLog()
    setLog([])
  }

  const filtered = filter
    ? log.filter(e => e.type.includes(filter) || e.detail?.includes(filter))
    : log

  return (
    <div>
      <div className="row" style={{ marginBottom: 20 }}>
        <h2 style={{ margin: 0 }}>Activity Log</h2>
        <input
          value={filter}
          onChange={e => setFilter(e.target.value)}
          placeholder="Filter..."
          style={{ width: 200 }}
        />
        <button className="btn btn-ghost" onClick={() => window.admin.getActivityLog().then(e => setLog([...e].reverse()))}>
          Refresh
        </button>
        <button className="btn btn-danger" onClick={clear}>Clear</button>
      </div>

      {filtered.length === 0 && (
        <div style={{ color: 'var(--text-dim)' }}>No entries.</div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {filtered.map((entry, i) => (
          <div key={i} className="card" style={{ padding: '10px 16px', display: 'flex', gap: 16, alignItems: 'baseline' }}>
            <span style={{ color: 'var(--text-dim)', fontSize: '0.8em', flexShrink: 0 }} title={new Date(entry.ts).toLocaleString()}>
              {relativeTime(entry.ts)}
            </span>
            <span style={{ fontWeight: 600, color: entry.type.includes('help') || entry.type.includes('rapid') ? '#f59b70' : 'var(--text)' }}>
              {TYPE_LABELS[entry.type] ?? entry.type}
            </span>
            {entry.detail && (
              <span style={{ color: 'var(--text-dim)', fontSize: '0.85em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {entry.detail}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
