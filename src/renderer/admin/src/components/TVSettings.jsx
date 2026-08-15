import React, { useState, useEffect } from 'react'

export default function TVSettings({ tv, onSave }) {
  const [status, setStatus] = useState({ paired: false, ip: null, name: null })
  const [ip, setIp] = useState('')
  const [pin, setPin] = useState('')
  const [msg, setMsg] = useState(null)
  const [discovering, setDiscovering] = useState(false)
  const [devices, setDevices] = useState([])
  const [pairing, setPairing] = useState(false)

  useEffect(() => {
    refreshStatus()
  }, [])

  async function refreshStatus() {
    const s = await window.admin.tvGetStatus()
    setStatus(s)
  }

  function notify(text, ok = true) {
    setMsg({ text, ok })
    setTimeout(() => setMsg(null), 4000)
  }

  async function discover() {
    setDiscovering(true)
    setDevices([])
    try {
      const found = await window.admin.tvDiscover()
      setDevices(found)
      if (found.length === 0) {
        notify('No TVs found. Make sure the TV is on and on the same network.', false)
      }
    } catch (err) {
      notify('Discovery failed: ' + err.message, false)
    }
    setDiscovering(false)
  }

  async function startPair(selectedIp) {
    setPairing(true)
    setIp(selectedIp)
    try {
      const result = await window.admin.tvStartPairing(selectedIp)
      if (result.success) {
        notify('TV is ready for pairing. Enter the PIN shown on the TV.')
      } else {
        notify('Failed to start pairing. Check the IP and try again.', false)
        setPairing(false)
      }
    } catch (err) {
      notify('Pairing error: ' + err.message, false)
      setPairing(false)
    }
  }

  async function completePair() {
    if (!pin.trim()) {
      notify('Please enter the PIN from the TV screen.', false)
      return
    }
    try {
      const result = await window.admin.tvCompletePairing(pin.trim())
      if (result.success) {
        notify('TV paired successfully!')
        setPin('')
        setPairing(false)
        await refreshStatus()
      } else {
        notify('Pairing failed. Check the PIN and try again.', false)
      }
    } catch (err) {
      notify('Pairing error: ' + err.message, false)
    }
  }

  async function clearPairing() {
    await window.admin.tvClearPairing()
    notify('TV pairing removed.')
    await refreshStatus()
  }

  async function testCommand(cmd) {
    try {
      let result
      switch (cmd) {
        case 'power-on': result = await window.admin.tvPowerOn(); break
        case 'power-off': result = await window.admin.tvPowerOff(); break
        case 'vol-up': result = await window.admin.tvVolumeUp(); break
        case 'vol-down': result = await window.admin.tvVolumeDown(); break
        case 'mute': result = await window.admin.tvMute(); break
      }
      if (result && result.ok) {
        notify('Command sent!')
      } else {
        notify('Command failed.', false)
      }
    } catch (err) {
      notify('Error: ' + err.message, false)
    }
  }

  return (
    <div>
      <h2>TV Remote</h2>

      <div className="card">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <div style={{
            width: 16, height: 16, borderRadius: '50%',
            background: status.paired ? '#4CAF50' : '#f44336',
            boxShadow: status.paired ? '0 0 8px #4CAF50' : 'none'
          }} />
          <span style={{ fontWeight: 600, fontSize: '1.1em' }}>
            {status.paired ? `Connected to ${status.name || 'Vizio TV'} (${status.ip})` : 'Not connected'}
          </span>
        </div>

        {msg && (
          <div style={{
            padding: '10px 16px',
            borderRadius: 8,
            marginBottom: 12,
            background: msg.ok ? 'rgba(76,175,80,0.15)' : 'rgba(244,67,54,0.15)',
            color: msg.ok ? '#4CAF50' : '#f44336',
            fontWeight: 600,
            fontSize: '0.95em'
          }}>
            {msg.text}
          </div>
        )}

        {!status.paired && !pairing && (
          <>
            <h3 style={{ fontSize: '1em', marginBottom: 8 }}>Find Your TV</h3>
            <div className="row" style={{ marginBottom: 16 }}>
              <button className="btn btn-primary" onClick={discover} disabled={discovering}>
                {discovering ? 'Searching...' : '🔍 Discover TVs on Network'}
              </button>
            </div>

            {devices.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: '0.9em', fontWeight: 600, marginBottom: 8 }}>Found TVs:</div>
                {devices.map(device => (
                  <div key={device.ip} className="row" style={{ marginBottom: 8 }}>
                    <div style={{ flex: 1 }}>
                      <strong>{device.name}</strong>
                      <span style={{ color: 'var(--text-dim)', fontSize: '0.85em', marginLeft: 8 }}>
                        {device.ip} {device.model ? `• ${device.model}` : ''}
                      </span>
                    </div>
                    <button className="btn btn-primary" onClick={() => startPair(device.ip)}>
                      Pair
                    </button>
                  </div>
                ))}
              </div>
            )}

            <h3 style={{ fontSize: '1em', marginBottom: 8 }}>Or Enter IP Manually</h3>
            <div className="row">
              <div className="field" style={{ flex: 1, marginBottom: 0 }}>
                <label>TV IP Address</label>
                <input
                  type="text"
                  value={ip}
                  onChange={e => setIp(e.target.value)}
                  placeholder="e.g. 192.168.1.100"
                />
              </div>
              <button
                className="btn btn-primary"
                disabled={!ip.trim()}
                onClick={() => startPair(ip.trim())}
                style={{ alignSelf: 'flex-end' }}
              >
                Start Pairing
              </button>
            </div>
            <div style={{ fontSize: '0.82em', color: 'var(--text-dim)', marginTop: 8 }}>
              Find your TV's IP in: Menu → Network → Network Status (on the TV)
            </div>
          </>
        )}

        {pairing && (
          <>
            <h3 style={{ fontSize: '1em', marginBottom: 8 }}>Enter the PIN from Your TV</h3>
            <p style={{ color: 'var(--text-dim)', fontSize: '0.9em', marginBottom: 12 }}>
              A PIN should appear on your TV screen. Enter it below to complete pairing.
            </p>
            <div className="row">
              <div className="field" style={{ flex: 1, marginBottom: 0 }}>
                <label>PIN</label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={pin}
                  onChange={e => setPin(e.target.value.replace(/\D/g, '').slice(0, 8))}
                  placeholder="Enter PIN"
                  maxLength={8}
                />
              </div>
              <button
                className="btn btn-primary"
                onClick={completePair}
                disabled={!pin.trim()}
                style={{ alignSelf: 'flex-end' }}
              >
                Complete Pairing
              </button>
              <button
                className="btn btn-ghost"
                onClick={() => { setPairing(false); setPin(''); }}
                style={{ alignSelf: 'flex-end' }}
              >
                Cancel
              </button>
            </div>
          </>
        )}

        {status.paired && (
          <>
            <h3 style={{ fontSize: '1em', marginBottom: 8 }}>Test Remote</h3>
            <div className="row" style={{ flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
              <button className="btn btn-ghost" onClick={() => testCommand('power-on')}>Power On</button>
              <button className="btn btn-ghost" onClick={() => testCommand('power-off')}>Power Off</button>
              <button className="btn btn-ghost" onClick={() => testCommand('vol-up')}>Vol Up</button>
              <button className="btn btn-ghost" onClick={() => testCommand('vol-down')}>Vol Down</button>
              <button className="btn btn-ghost" onClick={() => testCommand('mute')}>Mute</button>
            </div>

            <div className="row">
              <button className="btn btn-ghost" onClick={clearPairing}>
                Remove TV Pairing
              </button>
            </div>
          </>
        )}
      </div>

      <div className="card" style={{ color: 'var(--text-dim)', fontSize: '0.9em' }}>
        <strong style={{ color: 'var(--text)' }}>Requirements</strong>
        <ul style={{ marginTop: 8, paddingLeft: 20, lineHeight: 1.8 }}>
          <li>Vizio SmartCast TV (2016 or newer)</li>
          <li>TV and this computer must be on the same network</li>
          <li>TV must be powered on during pairing</li>
        </ul>
      </div>
    </div>
  )
}
