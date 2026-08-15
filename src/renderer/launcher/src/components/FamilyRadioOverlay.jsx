import React, { useState, useEffect, useRef } from 'react'

// Ambient, zero-navigation surface for short voice notes / photos from family.
// Shown only on the idle home screen — never requires picking a contact or
// opening Messages. One clip at a time; "Done" marks it played and advances.
export default function FamilyRadioOverlay({ enabled, baseUrl }) {
  const [queue, setQueue] = useState([])
  const audioRef = useRef(null)

  // The server hands us RELATIVE media paths (e.g. /family-radio-media/…), but
  // this renderer runs on file:// (production) or the Vite dev origin — NOT the
  // messenger server's origin — so a relative <img>/<audio> src would 404.
  // Resolve against the embedded server base URL (config.messenger.url).
  function mediaUrl(relative) {
    if (!relative) return null
    if (/^https?:\/\//i.test(relative)) return relative       // already absolute
    if (!baseUrl) return relative                             // fallback: leave as-is
    return `${baseUrl.replace(/\/$/, '')}${relative.startsWith('/') ? '' : '/'}${relative}`
  }

  useEffect(() => {
    if (!enabled) return
    window.launcher.getFamilyRadioQueue().then(clips => {
      if (clips?.length) setQueue(clips)
    }).catch(() => {})

    const unsubscribe = window.launcher.onFamilyRadioNew((clip) => {
      setQueue(prev => [...prev, clip])
    })
    return unsubscribe
  }, [enabled])

  useEffect(() => {
    if (!audioRef.current || !queue.length) return
    const audio = audioRef.current
    // This clip arrives via a socket push, with no click/tap preceding it —
    // Chromium's autoplay policy blocks unmuted play() without a recent user
    // gesture, which would otherwise leave her staring at a card that never
    // makes a sound, with only the easy-to-miss "Play Again" button as a way
    // to notice anything's wrong. Muted playback is always allowed regardless
    // of policy, so start muted and unmute the instant play() actually starts —
    // a self-contained trick that doesn't need any app-wide policy override
    // (which would also unmute ad video/audio on every embedded website tile).
    audio.muted = true
    audio.play().then(() => { audio.muted = false }).catch(() => {})
  }, [queue[0]?.id])

  if (!enabled || queue.length === 0) return null

  const clip = queue[0]
  const photoUrl = mediaUrl(clip.photoUrl)
  const audioUrl = mediaUrl(clip.audioUrl)

  function dismiss() {
    window.launcher.markFamilyRadioPlayed(clip.id).catch(() => {})
    setQueue(prev => prev.slice(1))
  }

  function playAgain() {
    if (audioRef.current) {
      audioRef.current.currentTime = 0
      audioRef.current.play().catch(() => {})
    }
  }

  return (
    <div style={styles.overlay}>
      <div style={styles.card}>
        <div style={styles.from}>💌 A message from {clip.from}</div>

        {photoUrl && (
          <img src={photoUrl} alt="" style={styles.photo} />
        )}

        {clip.caption && <div style={styles.caption}>{clip.caption}</div>}

        {audioUrl && (
          <audio ref={audioRef} src={audioUrl} onEnded={() => {}} />
        )}

        <div style={styles.actions}>
          {audioUrl && (
            <button style={styles.secondaryBtn} onClick={playAgain}>🔁 Play Again</button>
          )}
          <button style={styles.primaryBtn} onClick={dismiss}>✓ Done</button>
        </div>
      </div>
    </div>
  )
}

const styles = {
  overlay: {
    position: 'absolute', inset: 0, zIndex: 5,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: 'rgba(0,0,0,0.45)'
  },
  card: {
    background: 'var(--bg-card)', border: '2px solid var(--border)', borderRadius: 'var(--radius)',
    padding: 40, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20,
    maxWidth: 560, width: '90%', boxShadow: '0 12px 48px rgba(0,0,0,0.35)'
  },
  from: { fontFamily: 'var(--font-display)', fontSize: 'calc(1.5em * var(--font-scale, 1))', fontWeight: 700, color: 'var(--accent)', textAlign: 'center' },
  photo: { width: '100%', maxHeight: 320, objectFit: 'cover', borderRadius: 12, border: '1px solid var(--border)' },
  caption: { fontSize: 'calc(1.2em * var(--font-scale, 1))', color: 'var(--text-primary)', textAlign: 'center' },
  actions: { display: 'flex', gap: 16, marginTop: 8 },
  secondaryBtn: { background: 'var(--bg-main)', padding: '18px 28px', borderRadius: 40, border: '2px solid var(--border)', fontSize: 'calc(1.1em * var(--font-scale, 1))', fontWeight: 600, color: 'var(--text-primary)', cursor: 'pointer' },
  primaryBtn: { background: 'var(--accent)', padding: '18px 40px', borderRadius: 40, border: 'none', fontSize: 'calc(1.1em * var(--font-scale, 1))', fontWeight: 700, color: '#fff', cursor: 'pointer', boxShadow: '0 4px 16px rgba(0,0,0,0.2)' }
}
