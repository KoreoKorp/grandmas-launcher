import React, { useState, useRef } from 'react'

function isImagePath(icon) {
  if (!icon) return false
  return /\.(png|jpg|jpeg|gif|svg|ico|webp|bmp)$/i.test(icon) ||
         /^(https?:\/\/|file:\/\/|data:image)/i.test(icon) ||
         /^[A-Z]:\\/i.test(icon)
}

export default function Tile({ tile, onClick }) {
  const [hovered, setHovered] = useState(false)
  const [pressed, setPressed] = useState(false)
  const [activating, setActivating] = useState(false)
  const activatingTimer = useRef(null)

  function handleClick() {
    clearTimeout(activatingTimer.current)
    setActivating(true)
    activatingTimer.current = setTimeout(() => setActivating(false), 2000)
    onClick()
  }

  const isActive = activating || pressed
  const useImage = isImagePath(tile.icon)

  return (
    <button
      style={{
        ...S.tile,
        background: isActive
          ? 'linear-gradient(145deg, var(--bg-card-hover) 0%, var(--bg-card) 100%)'
          : hovered
            ? 'linear-gradient(145deg, var(--bg-card-hover) 0%, var(--bg-card) 100%)'
            : 'linear-gradient(145deg, var(--bg-card) 0%, rgba(45,45,65,0.9) 100%)',
        borderColor: isActive
          ? 'var(--accent)'
          : hovered ? 'rgba(245,184,112,0.5)' : 'var(--border)',
        transform: pressed ? 'scale(0.95)' : 'scale(1)',
        boxShadow: isActive
          ? '0 0 0 2px rgba(245,184,112,0.25), 0 8px 24px rgba(0,0,0,0.45)'
          : hovered
            ? '0 8px 28px rgba(0,0,0,0.4)'
            : '0 2px 8px rgba(0,0,0,0.22)',
        opacity: activating ? 0.9 : 1
      }}
      onClick={handleClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => { setHovered(false); setPressed(false) }}
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => setPressed(false)}
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
        color: isActive || hovered ? 'var(--accent)' : 'var(--text-primary)'
      }}>
        {tile.label}
      </span>
    </button>
  )
}

const S = {
  tile: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
    minHeight: 160,
    borderRadius: 20,
    border: '1.5px solid var(--border)',
    cursor: 'pointer',
    transition: 'background 0.14s, border-color 0.14s, transform 0.1s, box-shadow 0.14s, color 0.14s',
    padding: '20px 16px',
    position: 'relative',
    overflow: 'hidden'
  },
  icon: {
    fontSize: 'calc(2.8em * var(--font-scale, 1))',
    lineHeight: 1,
    display: 'block'
  },
  spinner: {
    fontSize: 'calc(2.4em * var(--font-scale, 1))',
    lineHeight: 1,
    display: 'block',
    animation: 'spin 1s linear infinite'
  },
  iconImage: {
    width: 68,
    height: 68,
    objectFit: 'contain',
    borderRadius: 12,
    pointerEvents: 'none'
  },
  label: {
    fontSize: 'calc(1.05em * var(--font-scale, 1))',
    fontWeight: 700,
    letterSpacing: 0.2,
    transition: 'color 0.14s',
    textAlign: 'center',
    lineHeight: 1.2
  }
}
