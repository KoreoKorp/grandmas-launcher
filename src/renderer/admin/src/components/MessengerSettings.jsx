import React, { useState } from 'react'

export default function MessengerSettings({ messenger, onSave }) {
  const [url, setUrl] = useState(messenger?.url || '')
  const [saved, setSaved] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState(null) // null | { ok, msg }

  const [turnUrl, setTurnUrl] = useState(messenger?.webrtc?.turnUrl ?? '')
  const [turnUsername, setTurnUsername] = useState(messenger?.webrtc?.turnUsername ?? '')
  const [turnCredential, setTurnCredential] = useState(messenger?.webrtc?.turnCredential ?? '')
  const [turnSaved, setTurnSaved] = useState(false)

  // Always send the complete messenger object to prevent stale-state races
  // between the URL save and TURN save merging against an out-of-date config.messenger
  function fullPayload() {
    return { url: url.trim(), webrtc: { ...(messenger?.webrtc ?? {}), turnUrl, turnUsername, turnCredential } }
  }

  async function save() {
    await onSave(fullPayload())
    setSaved(true)
    setTestResult(null)
    setTimeout(() => setSaved(false), 2500)
  }

  async function saveTurn() {
    await onSave(fullPayload())
    setTurnSaved(true)
    setTimeout(() => setTurnSaved(false), 2000)
  }

  async function testConnection() {
    setTesting(true)
    setTestResult(null)
    try {
      // Try to reach the health endpoint; fall back to the root URL
      const base = url.replace(/\/jean\.html.*$/, '')
      const healthUrl = `${base}/api/health`
      const res = await fetch(healthUrl, { method: 'GET', signal: AbortSignal.timeout(6000) })
      if (res.ok) {
        setTestResult({ ok: true, msg: '✓ Connected! Messenger is reachable.' })
      } else {
        setTestResult({ ok: false, msg: `Server responded with status ${res.status}.` })
      }
    } catch (err) {
      setTestResult({ ok: false, msg: 'Could not reach the messenger server. Check that it is running.' })
    }
    setTesting(false)
  }

  const isDefaultIP = url.includes('34.132.145.35')

  return (
    <div>
      <h2>Messenger Settings</h2>

      <div className="card">
        <div className="field">
          <label>Messenger URL (Jean's view)</label>
          <input
            value={url}
            onChange={e => setUrl(e.target.value)}
            placeholder="http://yourdomain.com/jean.html"
          />
          <div style={{ fontSize: '0.82em', color: 'var(--text-dim)', marginTop: 5 }}>
            This is the address that opens inside the launcher when Jean taps the Messages tile.
          </div>
        </div>

        {isDefaultIP && (
          <div style={styles.notice}>
            <span style={{ fontSize: '1.1em' }}>💡</span>
            <div>
              You're still using the raw IP address. Once you buy a domain and point it to the
              server, paste the new URL here (e.g. <code>http://jean.yourdomain.com/jean.html</code>)
              and click Save — no rebuild needed.
            </div>
          </div>
        )}

        <div className="row" style={{ marginTop: 8 }}>
          <button className="btn btn-primary" onClick={save}>Save</button>
          <button className="btn btn-ghost" onClick={testConnection} disabled={testing}>
            {testing ? 'Testing…' : '🔌 Test Connection'}
          </button>
          {saved && <span className="saved-notice">Saved!</span>}
        </div>

        {testResult && (
          <div style={{
            ...styles.testBadge,
            background: testResult.ok ? 'rgba(80,200,120,0.12)' : 'rgba(220,80,80,0.12)',
            borderColor: testResult.ok ? 'rgba(80,200,120,0.4)' : 'rgba(220,80,80,0.4)',
            color: testResult.ok ? '#4ec87a' : '#e05555'
          }}>
            {testResult.msg}
          </div>
        )}
      </div>

      <h2>Video Call (TURN Server)</h2>
      <div className="card">
        <p style={{ color: 'var(--text-dim)', fontSize: '0.9em', marginBottom: 12 }}>
          Optional — improves call reliability on restricted networks (e.g. work VPNs).
          Leave blank to use Google STUN only, which works on most home networks.
        </p>
        <div className="field">
          <label>TURN URL</label>
          <input value={turnUrl} onChange={e => setTurnUrl(e.target.value)} placeholder="turn:global.turn.twilio.com:3478" />
        </div>
        <div className="field">
          <label>Username</label>
          <input value={turnUsername} onChange={e => setTurnUsername(e.target.value)} placeholder="Twilio username" />
        </div>
        <div className="field">
          <label>Credential</label>
          <input type="password" value={turnCredential} onChange={e => setTurnCredential(e.target.value)} placeholder="Twilio credential" />
        </div>
        <div className="row">
          <button className="btn btn-primary" onClick={saveTurn}>Save</button>
          {turnSaved && <span className="saved-notice">Saved!</span>}
        </div>
      </div>

      <div className="card">
        <strong style={{ color: 'var(--text)' }}>How the Messages tile works</strong>
        <p style={{ marginTop: 8, color: 'var(--text-dim)', fontSize: '0.9em', lineHeight: 1.6 }}>
          When Jean taps the <strong>Messages</strong> tile, the launcher opens the URL above
          in a full-screen embedded browser — she never sees a browser bar or address.
          The page is your in-house messenger app (<code>jean.html</code>), which lets her
          read and reply to family messages with large text and simple PIN login.
        </p>
        <p style={{ marginTop: 8, color: 'var(--text-dim)', fontSize: '0.9em', lineHeight: 1.6 }}>
          <strong>To switch to a domain name:</strong> buy a domain (e.g. via Cloudflare
          Registrar, ~$10–14/yr), add an A record pointing to <code>34.132.145.35</code>,
          then update the URL above to <code>http://yourdomain.com/jean.html</code> and save.
        </p>
      </div>
    </div>
  )
}

const styles = {
  notice: {
    display: 'flex',
    gap: 10,
    alignItems: 'flex-start',
    background: 'rgba(245,184,112,0.1)',
    border: '1px solid rgba(245,184,112,0.3)',
    borderRadius: 8,
    padding: '10px 14px',
    fontSize: '0.88em',
    color: 'var(--text-dim)',
    lineHeight: 1.5,
    marginTop: 10
  },
  testBadge: {
    marginTop: 12,
    padding: '10px 14px',
    border: '1px solid',
    borderRadius: 8,
    fontSize: '0.9em',
    fontWeight: 600
  }
}
