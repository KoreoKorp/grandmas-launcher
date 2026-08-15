import React, { useState, useEffect, useRef } from 'react'
import SpeakButton from './SpeakButton'

const SLIDE_INTERVAL_MS = 8000

/**
 * Full-screen ambient photo slideshow shown after the home screen sits idle
 * for a while. Purely comfort/presence — any tap, click, key, or mouse move
 * dismisses it immediately and hands control straight back.
 */
export default function PhotoScreensaver({ onDismiss }) {
  const [photos, setPhotos] = useState(null)  // null = loading, [] = none available
  const [index, setIndex] = useState(0)
  const dismissedRef = useRef(false)

  useEffect(() => {
    window.launcher.getLocalPhotos().then(list => {
      // Shuffle so the same lead photo doesn't open every screensaver
      const shuffled = [...list].sort(() => Math.random() - 0.5)
      setPhotos(shuffled)
    })
  }, [])

  useEffect(() => {
    if (!photos || photos.length < 2) return
    const id = setInterval(() => setIndex(i => (i + 1) % photos.length), SLIDE_INTERVAL_MS)
    return () => clearInterval(id)
  }, [photos])

  // Dismiss on literally any interaction — this is ambient, not a screen
  // she's meant to have to figure out how to close.
  useEffect(() => {
    function dismiss() {
      if (dismissedRef.current) return
      dismissedRef.current = true
      onDismiss()
    }
    const events = ['mousedown', 'mousemove', 'keydown', 'touchstart', 'wheel']
    events.forEach(e => window.addEventListener(e, dismiss, { once: true }))
    return () => events.forEach(e => window.removeEventListener(e, dismiss))
  }, [onDismiss])

  // Nothing to show — bail without ever rendering a blank overlay
  if (photos && photos.length === 0) return null

  const photo = photos && photos.length > 0 ? photos[index] : null

  return (
    <div style={styles.backdrop}>
      {photo && (
        <React.Fragment key={photo.path}>
          <img src={photo.url} alt={photo.name} style={styles.image} />
          {photo.caption && (
            <div style={styles.captionBanner}>
              <span style={styles.captionText}>{photo.caption}</span>
              <SpeakButton text={photo.caption} size="md" />
            </div>
          )}
        </React.Fragment>
      )}
      <div style={styles.hint}>Tap anywhere to continue</div>
    </div>
  )
}

const styles = {
  backdrop: {
    position: 'fixed',
    inset: 0,
    background: '#000',
    zIndex: 950,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    animation: 'fadeIn 1.2s ease'
  },
  image: {
    maxWidth: '100%',
    maxHeight: '100%',
    objectFit: 'contain',
    animation: 'fadeIn 1.5s ease'
  },
  captionBanner: {
    position: 'absolute',
    bottom: 48,
    left: '50%',
    transform: 'translateX(-50%)',
    maxWidth: '80%',
    display: 'flex',
    alignItems: 'center',
    gap: 14,
    padding: '12px 24px',
    borderRadius: 22,
    background: 'rgba(0,0,0,0.55)',
    border: '1px solid rgba(255,255,255,0.2)'
  },
  captionText: {
    color: '#fff',
    fontSize: 'calc(1.25em * var(--font-scale, 1))',
    fontWeight: 700,
    lineHeight: 1.4
  },
  hint: {
    position: 'absolute',
    top: 24,
    left: '50%',
    transform: 'translateX(-50%)',
    color: 'rgba(255,255,255,0.5)',
    fontSize: '0.9em',
    fontWeight: 600,
    letterSpacing: 0.3
  }
}
