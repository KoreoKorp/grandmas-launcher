import React, { useState, useEffect, useRef } from 'react'

export default function WhosHomeOverlay({ onClose }) {
  const [loading, setLoading] = useState(true)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)
  const audioRef = useRef(null)
  const speechTokenRef = useRef(0)
  const mountedRef = useRef(true)

  function stopVoice() {
    speechTokenRef.current += 1
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.currentTime = 0
      audioRef.current = null
    }
    window.speechSynthesis?.cancel?.()
  }

  function speak(text) {
    if (!text) return
    stopVoice()
    const token = speechTokenRef.current
    try {
      window.launcher.speakTTS?.(text).then(res => {
        if (!mountedRef.current || token !== speechTokenRef.current) return
        if (res?.audio) {
          const a = new Audio('data:audio/mp3;base64,' + res.audio)
          audioRef.current = a
          a.onended = () => { if (audioRef.current === a) audioRef.current = null }
          a.play().catch(() => {
            if (audioRef.current === a) audioRef.current = null
            if (mountedRef.current && token === speechTokenRef.current) speakLocal(text)
          })
        } else {
          speakLocal(text)
        }
      }).catch(() => {
        if (mountedRef.current && token === speechTokenRef.current) speakLocal(text)
      })
    } catch {
      if (mountedRef.current && token === speechTokenRef.current) speakLocal(text)
    }
  }

  function speakLocal(text) {
    if (!window.speechSynthesis) return
    window.speechSynthesis.cancel()
    const u = new SpeechSynthesisUtterance(text)
    u.rate = 0.95
    window.speechSynthesis.speak(u)
  }

  function buildSummary(people) {
    if (!people || !people.length) {
      return "No family members are set up yet. Ask a family member to add them in the Admin Panel under Who's Home."
    }
    const home = people.filter(p => p.home)
    const away = people.filter(p => !p.home)
    if (!home.length) return "No one appears to be home right now."
    let s = home.map(p => {
      let part = `${p.name} is home`
      if (p.signalLabel === 'Weak') part += ', but the phone has a weak signal, so they may be outside or in the garage'
      else if (p.signalLabel === 'Good') part += ' and the phone has a good signal'
      else if (p.signalLabel === 'Strong') part += ' and the phone has a strong signal'
      return part
    }).join('. ') + '.'
    if (away.length) s += ' ' + away.map(p => `${p.name} is not home`).join('. ') + '.'
    return s
  }

  async function runScan() {
    stopVoice()
    setLoading(true)
    setError(null)
    try {
      const res = await window.launcher.scanLan()
      if (!mountedRef.current) return
      setResult(res)
      if (res?.error) {
        setError(res.error)
      } else {
        speak(buildSummary(res?.people))
      }
    } catch (e) {
      if (!mountedRef.current) return
      setError('Could not check who is home')
    } finally {
      if (mountedRef.current) setLoading(false)
    }
  }

  useEffect(() => {
    mountedRef.current = true
    runScan()
    return () => {
      mountedRef.current = false
      stopVoice()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const people = result?.people || []

  return (
    <div style={S.backdrop}>
      <div style={S.card}>
        <div style={S.headerRow}>
          <div style={S.title}>🏡 Who's Home?</div>
          {!loading && (
            <button style={S.rescanBtn} onClick={runScan} title="Check again">
              🔄 Check again
            </button>
          )}
        </div>

        {loading && (
          <>
            <div style={S.spinner} />
            <div style={S.sub}>Checking the Wi-Fi…</div>
          </>
        )}

        {!loading && error && (
          <>
            <div style={S.emptyIcon}>📡</div>
            <div style={S.sub}>{error}</div>
            <div style={S.hint}>Make sure the computer is connected to Wi-Fi.</div>
          </>
        )}

        {!loading && !error && people.length === 0 && (
          <>
            <div style={S.emptyIcon}>👪</div>
            <div style={S.sub}>No family members are set up yet</div>
            <div style={S.hint}>
              Ask a family member to add people in the Admin Panel → Who's Home.
            </div>
          </>
        )}

        {!loading && !error && people.length > 0 && (
          <div style={S.list}>
            {people.map((p, i) => (
              <div key={i} style={S.row}>
                <div style={{ ...S.dot, ...(p.home ? S.dotHome : S.dotAway) }} />
                <div style={S.name}>{p.name || 'Family member'}</div>
                <div style={S.status}>
                  {p.home ? 'Home' : 'Away'}
                </div>
                {p.home && p.signalLabel && (
                  <div style={S.signal}>
                    {p.signalLabel === 'Weak' ? '📶 Weak' : p.signalLabel === 'Good' ? '📶 Good' : '📶 Strong'}
                    {p.signalValue ? ` (${p.signalValue} Mbps)` : ''}
                  </div>
                )}
              </div>
            ))}
            <div style={S.method}>
              {result.method === 'att'
                ? 'Checked through your AT&T gateway.'
                : result.method === 'arp'
                ? 'Checked the local network (router not recognized as AT&T).'
                : ''}
            </div>
          </div>
        )}

        <button style={S.closeBtn} onClick={onClose}>🏠 Back to Home</button>
      </div>
    </div>
  )
}

const S = {
  backdrop: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(20, 20, 36, 0.92)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 900,
    animation: 'fadeIn 0.2s ease'
  },
  card: {
    background: 'var(--bg-card)',
    border: '1.5px solid var(--border)',
    borderRadius: 28,
    padding: '36px 48px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 12,
    minWidth: 380,
    maxWidth: 560,
    width: '90vw',
    textAlign: 'center',
    boxShadow: '0 24px 60px rgba(0,0,0,0.5)'
  },
  headerRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
    width: '100%'
  },
  title: {
    fontSize: 'calc(1.6em * var(--font-scale, 1))',
    fontWeight: 800,
    color: 'var(--accent)'
  },
  rescanBtn: {
    padding: '8px 14px',
    background: 'rgba(255,255,255,0.07)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius)',
    color: 'var(--text-secondary)',
    fontSize: 'calc(0.85em * var(--font-scale, 1))',
    fontWeight: 600,
    cursor: 'pointer'
  },
  spinner: {
    width: 44,
    height: 44,
    border: '5px solid rgba(255,255,255,0.15)',
    borderTopColor: 'var(--accent)',
    borderRadius: '50%',
    animation: 'spin 0.9s linear infinite',
    marginTop: 8
  },
  sub: {
    fontSize: 'calc(1.1em * var(--font-scale, 1))',
    fontWeight: 600,
    color: 'var(--text-primary)'
  },
  hint: {
    fontSize: 'calc(0.9em * var(--font-scale, 1))',
    color: 'var(--text-secondary)',
    maxWidth: 380
  },
  emptyIcon: { fontSize: 72, lineHeight: 1 },
  list: {
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
    width: '100%',
    marginTop: 4
  },
  row: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid var(--border)',
    borderRadius: 16,
    padding: '14px 18px',
    width: '100%'
  },
  dot: {
    width: 16,
    height: 16,
    borderRadius: '50%',
    flexShrink: 0
  },
  dotHome: { background: '#5dd35d', boxShadow: '0 0 10px rgba(93,211,93,0.7)' },
  dotAway: { background: 'var(--border)' },
  name: {
    flex: 1,
    textAlign: 'left',
    fontSize: 'calc(1.1em * var(--font-scale, 1))',
    fontWeight: 700,
    color: 'var(--text-primary)'
  },
  status: {
    fontSize: 'calc(0.95em * var(--font-scale, 1))',
    fontWeight: 700,
    color: 'var(--text-secondary)'
  },
  signal: {
    fontSize: 'calc(0.85em * var(--font-scale, 1))',
    fontWeight: 600,
    color: 'var(--accent)'
  },
  method: {
    fontSize: 'calc(0.78em * var(--font-scale, 1))',
    color: 'var(--text-secondary)',
    fontStyle: 'italic',
    marginTop: 4
  },
  closeBtn: {
    marginTop: 10,
    padding: '16px 44px',
    background: 'var(--accent)',
    color: '#1C322D',
    border: 'none',
    borderRadius: 'var(--radius)',
    fontSize: 'calc(1.1em * var(--font-scale, 1))',
    fontWeight: 800,
    cursor: 'pointer',
    boxShadow: '0 4px 16px rgba(235,181,82,0.3)'
  }
}
