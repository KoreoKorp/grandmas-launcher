import React, { useState, useEffect } from 'react'

/**
 * Animated SVG mascot character - a friendly round robot buddy.
 * States: 'idle' | 'talking' | 'listening' | 'thinking'
 */
export default function BuddyMascot({ state = 'idle', onClick, size = 120 }) {
  const [blinkOpen, setBlinkOpen] = useState(true)
  const [bobOffset, setBobOffset] = useState(0)

  // Blink periodically when idle or talking
  useEffect(() => {
    if (state === 'thinking' || state === 'listening') return
    const interval = setInterval(() => {
      setBlinkOpen(false)
      setTimeout(() => setBlinkOpen(true), 150)
    }, 3000 + Math.random() * 2000)
    return () => clearInterval(interval)
  }, [state])

  // Gentle bob animation
  useEffect(() => {
    let frame
    let t = 0
    const animate = () => {
      t += 0.03
      setBobOffset(Math.sin(t) * 3)
      frame = requestAnimationFrame(animate)
    }
    frame = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(frame)
  }, [])

  const antennaGlow = state === 'thinking'

  return (
    <div
      onClick={onClick}
      style={{
        width: size,
        height: size,
        cursor: onClick ? 'pointer' : 'default',
        transform: `translateY(${bobOffset}px)`,
        transition: 'transform 0.1s ease',
        position: 'relative'
      }}
    >
      <svg
        viewBox="0 0 120 120"
        width={size}
        height={size}
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <radialGradient id="buddyBody" cx="50%" cy="40%" r="60%">
            <stop offset="0%" stopColor="#F5D9A8" />
            <stop offset="100%" stopColor="#EBB552" />
          </radialGradient>
          <radialGradient id="buddyFace" cx="50%" cy="45%" r="50%">
            <stop offset="0%" stopColor="#FFF8EC" />
            <stop offset="100%" stopColor="#F5E6C8" />
          </radialGradient>
          <filter id="softShadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="3" stdDeviation="3" floodColor="#1C322D" floodOpacity="0.25" />
          </filter>
        </defs>

        {/* Antenna */}
        <line x1="60" y1="18" x2="60" y2="28" stroke="#C99A3E" strokeWidth="2.5" strokeLinecap="round" />
        <circle
          cx="60"
          cy="15"
          r={antennaGlow ? 5 : 3.5}
          fill={antennaGlow ? '#FFE066' : '#EBB552'}
          style={{
            animation: antennaGlow ? 'pulse-glow 1s ease-in-out infinite' : 'none',
            transformOrigin: '60px 15px'
          }}
        />

        {/* Body */}
        <ellipse cx="60" cy="68" rx="38" ry="36" fill="url(#buddyBody)" filter="url(#softShadow)" />

        {/* Face plate */}
        <ellipse cx="60" cy="66" rx="30" ry="28" fill="url(#buddyFace)" />

        {/* Ears / side panels */}
        <circle cx="24" cy="62" r="7" fill="#EBB552" />
        <circle cx="96" cy="62" r="7" fill="#EBB552" />
        <circle cx="24" cy="62" r="4" fill="#C99A3E" />
        <circle cx="96" cy="62" r="4" fill="#C99A3E" />

        {/* Eyes */}
        <g style={{ opacity: blinkOpen ? 1 : 0.1, transition: 'opacity 0.08s ease' }}>
          <circle cx="47" cy="60" r="6" fill="#2C3E2D" />
          <circle cx="45" cy="58" r="2" fill="white" opacity="0.8" />
          <circle cx="73" cy="60" r="6" fill="#2C3E2D" />
          <circle cx="71" cy="58" r="2" fill="white" opacity="0.8" />
        </g>

        {/* Blush cheeks */}
        <ellipse cx="38" cy="72" rx="5" ry="3" fill="#F0A0A0" opacity="0.35" />
        <ellipse cx="82" cy="72" rx="5" ry="3" fill="#F0A0A0" opacity="0.35" />

        {/* Mouth - changes based on state */}
        {state === 'talking' ? (
          <ellipse
            cx="60"
            cy="78"
            rx="7"
            ry="5"
            fill="#C2553F"
            style={{ transition: 'all 0.12s ease' }}
          />
        ) : state === 'thinking' ? (
          <circle cx="64" cy="78" r="3" fill="#7E908C" />
        ) : state === 'listening' ? (
          <path d="M 53 78 Q 60 82 67 78" stroke="#C2553F" strokeWidth="2.5" fill="none" strokeLinecap="round" />
        ) : (
          <path d="M 52 76 Q 60 83 68 76" stroke="#C2553F" strokeWidth="2.5" fill="none" strokeLinecap="round" />
        )}

        {/* Feet */}
        <ellipse cx="48" cy="102" rx="10" ry="5" fill="#C99A3E" />
        <ellipse cx="72" cy="102" rx="10" ry="5" fill="#C99A3E" />

        {/* Thinking sparkles */}
        {state === 'thinking' && (
          <>
            <text x="95" y="35" fontSize="12" style={{ animation: 'float 1.5s ease-in-out infinite' }}>✦</text>
            <text x="100" y="48" fontSize="8" style={{ animation: 'float 1.5s ease-in-out 0.5s infinite' }}>·</text>
          </>
        )}
      </svg>
    </div>
  )
}
