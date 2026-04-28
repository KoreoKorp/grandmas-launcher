import React, { useState, useEffect } from 'react'

function formatTs(ts) {
  return new Date(ts).toLocaleString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  })
}

export default function ConfigRestore() {
  const [history, setHistory] = useState(null)
  const [confirming, setConfirming] = useState(null) // index being confirmed
  const [successMsg, setSuccessMsg] = useState(null)
  const [errorMsg, setErrorMsg] = useState(null)

  async function load() {
    const h = await window.admin.getConfigHistory()
    setHistory(h)
  }

  useEffect(() => {
    load()

    // Refresh list when a restore pushes config:updated back to this window
    if (window.admin.onConfigUpdated) {
      window.admin.onConfigUpdated(() => load())
    }
  }, [])

  async function doRestore(index) {
    setConfirming(null)
    setErrorMsg(null)
    setSuccessMsg(null)
    const result = await window.admin.restoreConfig(index)
    if (result?.ok) {
      setSuccessMsg('Settings restored! Restart the app for all changes to take effect.')
      load()
    } else {
      setErrorMsg('Restore failed — backup may be missing.')
    }
  }

  return (
    <div>
      <h2>Restore Settings</h2>

      <div className="card" style={{ color: 'var(--text-dim)', fontSize: '0.9em', marginBottom: 20 }}>
        <strong style={{ color: 'var(--text)' }}>Oops Revert</strong>
        <p style={{ marginTop: 8 }}>
          Every time you save a change in the admin panel, the previous settings are automatically
          backed up here (up to 5 backups). Click "Restore This" to roll back to an earlier state.
        </p>
      </div>

      {successMsg && (
        <div style={{ background: 'rgba(80,180,100,0.15)', border: '1px solid var(--success)', borderRadius: 10, padding: '12px 16px', marginBottom: 16, color: 'var(--success)', fontWeight: 600 }}>
          {successMsg}
        </div>
      )}

      {errorMsg && (
        <div style={{ background: 'rgba(200,60,60,0.12)', border: '1px solid var(--danger)', borderRadius: 10, padding: '12px 16px', marginBottom: 16, color: 'var(--danger)', fontWeight: 600 }}>
          {errorMsg}
        </div>
      )}

      {history === null && (
        <div style={{ color: 'var(--text-dim)', padding: '16px 0' }}>Loading…</div>
      )}

      {history !== null && history.length === 0 && (
        <div className="card" style={{ color: 'var(--text-dim)', fontSize: '0.95em' }}>
          No backups yet. Changes you make are automatically backed up here.
        </div>
      )}

      {history !== null && history.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {history.map((entry) => (
            <div key={entry.index} className="card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
              <div>
                <div style={{ fontWeight: 600, marginBottom: 2 }}>
                  {entry.index === 0 ? 'Most recent backup' : `Backup ${entry.index + 1}`}
                </div>
                <div style={{ fontSize: '0.88em', color: 'var(--text-dim)' }}>
                  {formatTs(entry.ts)}
                </div>
              </div>

              {confirming === entry.index ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                  <span style={{ fontSize: '0.85em', color: 'var(--text-dim)' }}>
                    Are you sure? This will replace your current settings.
                  </span>
                  <button className="btn btn-primary" onClick={() => doRestore(entry.index)}>
                    Yes, Restore
                  </button>
                  <button className="btn btn-ghost" onClick={() => setConfirming(null)}>
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  className="btn btn-ghost"
                  style={{ flexShrink: 0 }}
                  onClick={() => { setSuccessMsg(null); setErrorMsg(null); setConfirming(entry.index) }}
                >
                  Restore This
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
