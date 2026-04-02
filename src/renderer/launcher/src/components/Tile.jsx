import React, { useState, useRef } from 'react'

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

  return (
    <button
      style={{
        ...styles.tile,
        background: isActive ? 'var(--bg-card-hover)' : hovered ? 'var(--bg-card-hover)' : 'var(--bg-card)',
        borderColor: isActive ? 'var(--accent)' : hovered ? 'var(--accent)' : 'var(--border)',
        transform: pressed ? 'scale(0.97)' : 'scale(1)',
        boxShadow: hovered || isActive
          ? '0 6px 24px rgba(0,0,0,0.35)'
          : '0 2px 8px rgba(0,0,0,0.2)',
        opacity: activating ? 0.85 : 1
      }}
      onClick={handleClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => { setHovered(false); setPressed(false) }}
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => setPressed(false)}
    >
      <span style={styles.icon}>{activating ? '⏳' : tile.icon}</span>
      <span style={styles.label}>{tile.label}</span>
    </button>
  )
}

const styles = {
  tile: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    minHeight: 140,
    borderRadius: 'var(--radius)',
    border: '1.5px solid var(--border)',
    cursor: 'pointer',
    transition: 'background 0.12s, border-color 0.12s, transform 0.1s, box-shadow 0.12s',
    padding: 20
  },
  icon: {
    fontSize: 'calc(2.6em * var(--font-scale, 1))',
    lineHeight: 1
  },
  label: {
    fontSize: 'calc(1.05em * var(--font-scale, 1))',
    fontWeight: 600,
    color: 'var(--text-primary)',
    letterSpacing: 0.3
  }
}
