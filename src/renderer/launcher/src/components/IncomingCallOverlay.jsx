import React, { useEffect, useState, useRef } from 'react'

export default function IncomingCallOverlay({ caller, onAnswer, onDecline }) {
  const [countdown, setCountdown] = useState(3)
  const answered = useRef(false)
  // Ref keeps the latest onAnswer without being a countdown-effect dependency —
  // prevents the 3-second interval from restarting on every App.jsx re-render
  const onAnswerRef = useRef(onAnswer)
  useEffect(() => { onAnswerRef.current = onAnswer }, [onAnswer])

  // Chime using Web Audio API — ctx.resume() required for Electron's autoplay policy
  useEffect(() => {
    let ctx
    try {
      ctx = new AudioContext()
      ctx.resume().then(() => {
        ;[523, 659, 784].forEach((freq, i) => {
          const osc = ctx.createOscillator()
          const gain = ctx.createGain()
          osc.connect(gain)
          gain.connect(ctx.destination)
          osc.frequency.value = freq
          osc.type = 'sine'
          gain.gain.setValueAtTime(0.3, ctx.currentTime + i * 0.25)
          gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.25 + 0.4)
          osc.start(ctx.currentTime + i * 0.25)
          osc.stop(ctx.currentTime + i * 0.25 + 0.4)
        })
      })
    } catch (_) {}
    return () => { if (ctx) ctx.close() }
  }, [])

  // 3-second countdown then auto-answer — empty deps so interval never restarts
  useEffect(() => {
    const id = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(id)
          if (!answered.current) {
            answered.current = true
            onAnswerRef.current()
          }
          return 0
        }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(id)
  }, [])

  return (
    <div style={styles.backdrop}>
      <div style={styles.card}>
        <div style={styles.avatar}>📞</div>
        <div style={styles.title}>Family is calling…</div>
        <div style={styles.name}>{caller.callerName || 'Family'}</div>
        {caller.relation && <div style={styles.relation}>This is your {caller.relation}</div>}
        <div style={styles.countdown}>Connecting in {countdown}…</div>
        <button style={styles.answerBtn} onClick={() => { answered.current = true; onAnswer() }}>
          Answer Now
        </button>
        <button style={styles.declineBtn} onClick={onDecline}>
          Not Now
        </button>
      </div>
    </div>
  )
}

const styles = {
  backdrop: { position: 'fixed', inset: 0, background: 'rgba(28,28,44,0.92)', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center' },
  card: { background: 'var(--bg-card)', border: '2px solid var(--accent)', borderRadius: 'var(--radius)', padding: '48px 56px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20, minWidth: 360, textAlign: 'center' },
  avatar: { fontSize: 72 },
  title: { fontFamily: 'var(--font-display)', fontSize: 'calc(1.5em * var(--font-scale, 1))', fontWeight: 700, color: 'var(--text-primary)' },
  name: { fontSize: 'calc(1.8em * var(--font-scale, 1))', fontWeight: 700, color: 'var(--accent)' },
  relation: { fontSize: 'calc(1.2em * var(--font-scale, 1))', fontWeight: 600, color: 'var(--text-primary)', marginTop: -12, marginBottom: 12 },
  countdown: { fontSize: 'calc(1em * var(--font-scale, 1))', color: 'var(--text-secondary)' },
  answerBtn: { width: '100%', padding: '20px 0', background: '#4caf6e', border: 'none', borderRadius: 'var(--radius)', color: '#fff', fontSize: 'calc(1.2em * var(--font-scale, 1))', fontWeight: 700, cursor: 'pointer' },
  declineBtn: { width: '100%', padding: '14px 0', background: 'transparent', border: '1.5px solid var(--border)', borderRadius: 'var(--radius)', color: 'var(--text-secondary)', fontSize: 'calc(1em * var(--font-scale, 1))', fontWeight: 600, cursor: 'pointer' }
}
