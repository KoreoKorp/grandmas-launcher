import React, { useState, useRef, useEffect } from 'react'

function isImagePath(icon) {
  if (!icon) return false
  return /\.(png|jpg|jpeg|gif|svg|ico|webp|bmp)$/i.test(icon) ||
         /^(https?:\/\/|file:\/\/|data:image)/i.test(icon) ||
         /^[A-Z]:\\/i.test(icon)
}

export default function Tile({ tile, onClick, badge = 0 }) {
  const [pressed, setPressed] = useState(false)
  const [activating, setActivating] = useState(false)
  const activatingTimer = useRef(null)

  // The grid re-renders tiles when the caregiver edits them elsewhere, which
  // can unmount a mid-animation Tile before its 2s timer fires.
  useEffect(() => () => clearTimeout(activatingTimer.current), [])

  function handleClick() {
    clearTimeout(activatingTimer.current)
    setActivating(true)
    activatingTimer.current = setTimeout(() => setActivating(false), 2000)
    onClick()
  }

  const useImage = isImagePath(tile.icon)

  return (
    <button
      className="tile-btn"
      style={{
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 14,
        minHeight: 190,
        padding: '20px 16px',
        cursor: 'pointer',
        transform: pressed ? 'scale(0.92)' : 'scale(1)',
        transition: 'transform 0.18s cubic-bezier(0.34, 1.56, 0.64, 1), border-color 0.15s, box-shadow 0.15s',
        ...(activating ? {
          borderColor: 'var(--accent)',
          boxShadow: '0 0 0 3px rgba(235,181,82,0.3), var(--shadow-glow)'
        } : {}),
        ...(pressed ? {
          boxShadow: '0 0 0 2px rgba(235,181,82,0.5), 0 4px 12px rgba(0,0,0,0.2)'
        } : {})
      }}
      onClick={handleClick}
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => setPressed(false)}
      onMouseLeave={() => setPressed(false)}
      onTouchStart={() => setPressed(true)}
      onTouchEnd={() => setPressed(false)}
    >
      {badge > 0 && (
        <span style={S.badge}>{badge > 9 ? '9+' : badge}</span>
      )}
      {activating ? (
        <span style={S.spinner}>⏳</span>
      ) : useImage ? (
        <img src={tile.icon} alt={tile.label} style={S.iconImage} draggable={false} />
      ) : (
        <span style={S.icon}>{tile.icon}</span>
      )}
      <span style={{
        ...S.label,
        color: 'var(--text-on-card)'
      }}>
        {tile.label}
      </span>
    </button>
  )
}

const S = {
  badge: {
    position: 'absolute',
    top: 10,
    right: 10,
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    background: '#E53935',
    color: '#fff',
    fontSize: 11,
    fontWeight: 800,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '0 5px',
    boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
    animation: 'badgePulse 2s ease-in-out infinite',
    pointerEvents: 'none',
    zIndex: 2
  },
  icon: {
    fontSize: 'calc(6em * var(--font-scale, 1))',
    lineHeight: 1,
    display: 'block',
    filter: 'drop-shadow(0 2px 8px rgba(0,0,0,0.3))',
    transition: 'transform 280ms cubic-bezier(0.34, 1.56, 0.64, 1)',
  },
  spinner: {
    fontSize: 'calc(4.8em * var(--font-scale, 1))',
    lineHeight: 1,
    display: 'block',
    animation: 'float 1.2s ease-in-out infinite'
  },
  iconImage: {
    width: 152,
    height: 152,
    objectFit: 'contain',
    borderRadius: 12,
    pointerEvents: 'none',
    filter: 'drop-shadow(0 4px 12px rgba(0,0,0,0.35))'
  },
  label: {
    fontSize: 'calc(1.05em * var(--font-scale, 1))',
    fontWeight: 700,
    letterSpacing: 0.2,
    transition: 'color var(--transition-fast)',
    textAlign: 'center',
    lineHeight: 1.2
  }
}
