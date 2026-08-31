import React, { useState, useRef, useEffect } from 'react'

const COLS = 4

function isImagePath(icon) {
  return typeof icon === 'string' && (
    /\.(png|jpe?g|gif|svg|webp|bmp|ico)$/i.test(icon) ||
    /^(https?:\/\/|file:\/\/|data:image)/i.test(icon) ||
    /^[A-Za-z]:\\/.test(icon)
  )
}

/**
 * Full-screen "jump to any screen" picker. Opened with Alt+Up (from the home
 * screen, a built-in view, or a website — see ipc.js). Every tile at once,
 * navigable with the arrow keys, Enter/Space to open, Esc to close. Digit
 * keys 1–9 and 0 also pick directly, matching the home-screen shortcuts.
 */
export default function TilePickerOverlay({ tiles = [], onPick, onClose }) {
  const [focus, setFocus] = useState(0)
  const panelRef = useRef(null)
  const btnRefs = useRef([])

  const n = tiles.length
  const cols = Math.min(COLS, Math.max(1, n))

  useEffect(() => { panelRef.current?.focus() }, [])
  useEffect(() => {
    btnRefs.current[focus]?.scrollIntoView({ block: 'nearest' })
  }, [focus])

  function move(delta) {
    setFocus(i => Math.max(0, Math.min(n - 1, i + delta)))
  }

  function handleKeyDown(e) {
    const k = e.key
    const handled = [
      'Escape', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Enter', ' ',
    ].includes(k) || /^[0-9]$/.test(k)
    if (!handled) return
    e.preventDefault()
    e.stopPropagation()   // keep App's window-level shortcut handler out of it

    if (k === 'Escape') return onClose()
    if (k === 'ArrowRight') return move(1)
    if (k === 'ArrowLeft') return move(-1)
    if (k === 'ArrowDown') return move(cols)
    if (k === 'ArrowUp') return move(-cols)
    if (k === 'Enter' || k === ' ') {
      const t = tiles[focus]
      if (t) onPick(t)
      return
    }
    // digit
    const idx = k === '0' ? 9 : Number(k) - 1
    if (tiles[idx]) onPick(tiles[idx])
  }

  return (
    <div style={S.backdrop} onClick={onClose}>
      <div
        ref={panelRef}
        tabIndex={-1}
        style={S.panel}
        onClick={e => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        <div style={S.title}>Choose a screen</div>
        <div style={S.hint}>Arrow keys to move · Enter to open · Esc to close</div>

        {n === 0 ? (
          <div style={S.empty}>No screens are set up yet.</div>
        ) : (
          <div style={{ ...S.grid, gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
            {tiles.map((t, i) => (
              <button
                key={t.id ?? i}
                ref={el => (btnRefs.current[i] = el)}
                style={{ ...S.tile, ...(i === focus ? S.tileFocused : {}) }}
                onClick={() => onPick(t)}
                onMouseEnter={() => setFocus(i)}
              >
                {i < 10 && <span style={S.num}>{i === 9 ? 0 : i + 1}</span>}
                <span style={S.icon}>
                  {isImagePath(t.icon)
                    ? <img src={t.icon} alt="" style={S.iconImg} />
                    : t.icon}
                </span>
                <span style={S.label}>{t.label}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

const S = {
  backdrop: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.72)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 120,
    animation: 'fadeIn 0.15s ease',
    padding: 32
  },
  panel: {
    width: 'min(1100px, 94vw)',
    maxHeight: '90vh',
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
    padding: 28,
    borderRadius: 'var(--radius, 16px)',
    background: 'var(--bg-main)',
    border: '1px solid var(--border)',
    boxShadow: 'var(--shadow-lg, 0 20px 60px rgba(0,0,0,0.4))',
    outline: 'none'
  },
  title: {
    fontFamily: 'var(--font-display)',
    fontSize: 'calc(1.6em * var(--font-scale, 1))',
    fontWeight: 800,
    color: 'var(--text-primary)',
    textAlign: 'center'
  },
  hint: {
    fontSize: 'calc(0.9em * var(--font-scale, 1))',
    color: 'var(--text-secondary)',
    textAlign: 'center',
    marginBottom: 12
  },
  empty: {
    fontSize: 'calc(1.1em * var(--font-scale, 1))',
    color: 'var(--text-secondary)',
    textAlign: 'center',
    padding: 40
  },
  grid: {
    display: 'grid',
    gap: 16
  },
  tile: {
    position: 'relative',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    minHeight: 140,
    padding: '18px 14px',
    borderRadius: 'var(--radius-sm, 12px)',
    border: '2px solid var(--border)',
    background: 'var(--bg-card)',
    color: 'var(--text-primary)',
    cursor: 'pointer',
    transition: 'transform 0.12s, border-color 0.12s, box-shadow 0.12s'
  },
  tileFocused: {
    borderColor: 'var(--accent)',
    boxShadow: '0 0 0 3px rgba(235,181,82,0.35), var(--shadow-glow, 0 8px 24px rgba(0,0,0,0.25))',
    transform: 'scale(1.03)'
  },
  num: {
    position: 'absolute',
    top: 8,
    left: 10,
    fontSize: 'calc(0.8em * var(--font-scale, 1))',
    fontWeight: 800,
    color: 'var(--text-secondary)'
  },
  icon: {
    fontSize: 'calc(2.6em * var(--font-scale, 1))',
    lineHeight: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  },
  iconImg: { width: 56, height: 56, objectFit: 'contain' },
  label: {
    fontSize: 'calc(1.05em * var(--font-scale, 1))',
    fontWeight: 700,
    textAlign: 'center'
  }
}
