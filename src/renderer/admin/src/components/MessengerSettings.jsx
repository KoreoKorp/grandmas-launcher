import React, { useState, useEffect } from 'react'

export default function MessengerSettings({ messenger, onSave }) {
  const [serverInfo, setServerInfo] = useState(null) // { port, lanIps }
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState(null)

  const [turnUrl, setTurnUrl] = useState(messenger?.webrtc?.turnUrl ?? '')
  const [turnUsername, setTurnUsername] = useState(messenger?.webrtc?.turnUsername ?? '')
  const [turnCredential, setTurnCredential] = useState(messenger?.webrtc?.turnCredential ?? '')
  const [turnSaved, setTurnSaved] = useState(false)

  useEffect(() => {
    window.admin.getMessengerInfo().then(setServerInfo).catch(() => setServerInfo(null))
  }, [])

  async function saveTurn() {
    await onSave({ ...messenger, webrtc: { ...(messenger?.webrtc ?? {}), turnUrl, turnUsername, turnCredential } })
    setTurnSaved(true)
    setTimeout(() => setTurnSaved(false), 2000)
  }

  async function testConnection() {
    if (!serverInfo?.port) return
    setTesting(true)
    setTestResult(null)
    try {
      const res = await fetch(`http://localhost:${serverInfo.port}/api/health`, {
        method: 'GET',
        signal: AbortSignal.timeout(6000)
      })
      if (res.ok) {
        setTestResult({ ok: true, msg: '✓ Embedded server is running and healthy.' })
      } else {
        setTestResult({ ok: false, msg: `Server responded with status ${res.status}.` })
      }
    } catch {
      setTestResult({ ok: false, msg: 'Could not reach the embedded server.' })
    }
    setTesting(false)
  }

  const localUrl = serverInfo?.port ? `http://localhost:${serverInfo.port}` : null

  return (
    <div>
      <h2>Messenger</h2>

      <div className="card">
        <strong style={{ color: 'var(--text)' }}>Embedded Server Status</strong>
        <p style={{ marginTop: 6, marginBottom: 12, color: 'var(--text-dim)', fontSize: '0.9em', lineHeight: 1.5 }}>
          The messenger server runs inside the launcher — no separate install needed.
        </p>

        {serverInfo === null ? (
          <div style={styles.badge}>Loading…</div>
        ) : serverInfo.port ? (
          <>
            <div style={{ ...styles.badge, ...styles.badgeOn }}>
              ● Running on port {serverInfo.port}
            </div>

            <div style={{ marginTop: 12 }}>
              <div style={styles.label}>Jean's URL (this device)</div>
              <code style={styles.code}>{localUrl}/jean.html</code>
            </div>

            {serverInfo.lanIps?.length > 0 && (
              <div style={{ marginTop: 10 }}>
                <div style={styles.label}>LAN access (other family devices)</div>
                {serverInfo.lanIps.map(ip => (
                  <div key={ip}>
                    <code style={styles.code}>http://{ip}:{serverInfo.port}/jean.html</code>
                  </div>
                ))}
              </div>
            )}

            <div className="row" style={{ marginTop: 14 }}>
              <button className="btn btn-ghost" onClick={testConnection} disabled={testing}>
                {testing ? 'Testing…' : '🔌 Test Connection'}
              </button>
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
          </>
        ) : (
          <div style={{ ...styles.badge, ...styles.badgeOff }}>
            ● Server not running
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
          When Jean taps the <strong>Messages</strong> tile, the launcher opens a full-screen
          messenger view — she never sees a browser bar or address. The server runs automatically
          in the background whenever the launcher is open.
        </p>
        <p style={{ marginTop: 8, color: 'var(--text-dim)', fontSize: '0.9em', lineHeight: 1.6 }}>
          Family members on the same network can open their browser to any of the LAN URLs above
          to send Jean messages.
        </p>
      </div>
    </div>
  )
}

const styles = {
  label: {
    fontSize: '0.8em',
    color: 'var(--text-dim)',
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: '0.04em'
  },
  code: {
    display: 'block',
    background: 'rgba(255,255,255,0.06)',
    borderRadius: 6,
    padding: '6px 10px',
    fontSize: '0.88em',
    color: 'var(--text)',
    marginBottom: 4,
    wordBreak: 'break-all'
  },
  badge: {
    display: 'inline-block',
    padding: '5px 12px',
    borderRadius: 20,
    fontSize: '0.85em',
    fontWeight: 600,
    background: 'rgba(255,255,255,0.07)',
    color: 'var(--text-dim)'
  },
  badgeOn: {
    background: 'rgba(80,200,120,0.12)',
    color: '#4ec87a'
  },
  badgeOff: {
    background: 'rgba(220,80,80,0.12)',
    color: '#e05555'
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
