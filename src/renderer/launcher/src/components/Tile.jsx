import React, { useState, useRef } from 'react'

function isImagePath(icon) {
  if (!icon) return false
  return /\.(png|jpg|jpeg|gif|svg|ico|webp|bmp)$/i.test(icon) ||
         /^(https?:\/\/|file:\/\/|data:image)/i.test(icon) ||
         /^[A-Z]:\\/i.test(icon)
}

export default function Tile({ tile, onClick }) {
  const [pressed, setPressed] = useState(false)
  const [activating, setActivating] = useState(false)
  const activatingTimer = useRef(null)

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
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 14,
        minHeight: 160,
        padding: '20px 16px',
        cursor: 'pointer',
        ...(activating ? {
          borderColor: 'var(--accent)',
          boxShadow: '0 0 0 3px rgba(235,181,82,0.3), var(--shadow-glow)'
        } : {})
      }}
      onClick={handleClick}
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => setPressed(false)}
      onMouseLeave={() => setPressed(false)}
      onTouchStart={() => setPressed(true)}
      onTouchEnd={() => setPressed(false)}
    >
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
  icon: {
    fontSize: 'calc(2.8em * var(--font-scale, 1))',
    lineHeight: 1,
    display: 'block',
    filter: 'drop-shadow(0 2px 8px rgba(0,0,0,0.3))',
    transition: 'transform 280ms cubic-bezier(0.34, 1.56, 0.64, 1)',
  },
  spinner: {
    fontSize: 'calc(2.4em * var(--font-scale, 1))',
    lineHeight: 1,
    display: 'block',
    animation: 'float 1.2s ease-in-out infinite'
  },
  iconImage: {
    width: 68,
    height: 68,
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
