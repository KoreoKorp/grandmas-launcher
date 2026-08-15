import React, { useState, useEffect, useRef } from 'react'
import BuddyMascot from './BuddyMascot'

/**
 * Floating buddy button that sits in the corner of the launcher.
 * Always visible - click to open the full chat panel.
 * Shows idle animation and occasional prompt bubbles.
 */
export default function BuddyFloat({ onClick, hasUnread }) {
  const [showHint, setShowHint] = useState(false)
  const [hintText, setHintText] = useState('')

  const hints = [
    "Tap me if you need help!",
    "I'm here to help you!",
    "Need me to do something?",
    "Let's chat!",
    "How can I help?"
  ]

  // The "hide after 5s" timeouts below weren't tracked, so unmounting mid-hint
  // (e.g. she taps a tile right as a bubble appears) couldn't cancel them —
  // they'd still fire setShowHint(false) on an unmounted component. This ref
  // always points at whichever hide-timer is currently pending.
  const hideTimerRef = useRef(null)

  // Show a hint bubble every 60 seconds
  useEffect(() => {
    function showHintFor(text) {
      setHintText(text)
      setShowHint(true)
      clearTimeout(hideTimerRef.current)
      hideTimerRef.current = setTimeout(() => setShowHint(false), 5000)
    }
    const interval = setInterval(() => {
      showHintFor(hints[Math.floor(Math.random() * hints.length)])
    }, 60000)
    const initial = setTimeout(() => {
      showHintFor("Hi! Tap me if you need anything!")
    }, 10000)
    return () => { clearInterval(interval); clearTimeout(initial); clearTimeout(hideTimerRef.current) }
  }, [])

  return (
    <div style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 800 }}>
      {showHint && (
        <div style={{
          position: 'absolute',
          bottom: '100%',
          right: 0,
          marginBottom: 10,
          background: 'var(--bg-card)',
          border: '1.5px solid var(--border)',
          borderRadius: '16px 16px 4px 16px',
          padding: '10px 16px',
          fontSize: 'calc(0.9em * var(--font-scale, 1))',
          color: 'var(--text-primary)',
          boxShadow: 'var(--shadow-md)',
          animation: 'popIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) both',
          maxWidth: 220,
          whiteSpace: 'normal',
          lineHeight: 1.4
        }}>
          {hintText}
        </div>
      )}

      <button
        onClick={onClick}
        style={{
          width: 'calc(72px * var(--font-scale, 1))',
          height: 'calc(72px * var(--font-scale, 1))',
          borderRadius: '50%',
          background: 'var(--bg-card)',
          border: '2px solid var(--accent)',
          boxShadow: '0 4px 20px rgba(235,181,82,0.35)',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 0,
          position: 'relative',
          transition: 'transform 0.15s, box-shadow 0.15s',
          animation: 'popIn 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) both'
        }}
        onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.08)' }}
        onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)' }}
        title="Chat with Buddy!"
      >
        <BuddyMascot state="idle" size={56} />
        {hasUnread && (
          <div style={{
            position: 'absolute',
            top: 2,
            right: 2,
            width: 14,
            height: 14,
            borderRadius: '50%',
            background: '#c2553f',
            border: '2px solid var(--bg-card)',
            animation: 'badgePulse 2s ease-in-out infinite'
          }} />
        )}
      </button>
    </div>
  )
}
