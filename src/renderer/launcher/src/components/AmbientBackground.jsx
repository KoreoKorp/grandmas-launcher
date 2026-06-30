import React, { useRef, useEffect, useState } from 'react'

/**
 * AmbientBackground
 * A calm, full-bleed "Mindful Moments" dot-matrix field: sparse amber dots on
 * the forest-green shell with a slow breathing pulse and a subtle pointer drift.
 *
 * Implemented with Canvas 2D (not raw WebGL) — it captures the same meditative
 * effect while being lighter and free of WebGL context-loss fragility on the
 * dementia-care device. Falls back to a static dot field when:
 *   - the `enabled` prop is false (caregiver "calm" toggle), or
 *   - the OS reports prefers-reduced-motion.
 *
 * Always renders behind content (pointer-events:none, absolute inset 0).
 */
export default function AmbientBackground({ enabled = true }) {
  const canvasRef = useRef(null)
  const [reduceMotion, setReduceMotion] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const update = () => setReduceMotion(mq.matches)
    update()
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [])

  const animate = enabled && !reduceMotion

  useEffect(() => {
    if (!animate) return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const SPACING = 40        // px between dots
    const RADIUS = 1.4        // dot radius
    const DRIFT_MAX = 14      // px the field drifts toward the pointer
    const BREATH_MS = 6500    // full breathe cycle

    let raf = 0
    let dpr = Math.min(window.devicePixelRatio || 1, 2)
    let width = 0, height = 0
    const pointer = { x: 0.5, y: 0.5 }   // normalized; defaults to centre
    const drift = { x: 0, y: 0 }

    function resize() {
      const rect = canvas.getBoundingClientRect()
      width = rect.width
      height = rect.height
      canvas.width = Math.round(width * dpr)
      canvas.height = Math.round(height * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }

    function onMove(e) {
      const rect = canvas.getBoundingClientRect()
      pointer.x = (e.clientX - rect.left) / Math.max(rect.width, 1)
      pointer.y = (e.clientY - rect.top) / Math.max(rect.height, 1)
    }

    function frame(t) {
      // Breathing: global alpha eases between calm bounds
      const breath = (Math.sin((t / BREATH_MS) * Math.PI * 2) + 1) / 2 // 0..1
      const alpha = 0.10 + breath * 0.16                                // 0.10..0.26

      // Ease the field drift toward the pointer offset from centre
      const targetX = (pointer.x - 0.5) * 2 * DRIFT_MAX
      const targetY = (pointer.y - 0.5) * 2 * DRIFT_MAX
      drift.x += (targetX - drift.x) * 0.04
      drift.y += (targetY - drift.y) * 0.04

      ctx.clearRect(0, 0, width, height)
      ctx.fillStyle = `rgba(235, 181, 82, ${alpha})`

      const startX = ((drift.x % SPACING) + SPACING) % SPACING
      const startY = ((drift.y % SPACING) + SPACING) % SPACING
      for (let x = startX; x < width; x += SPACING) {
        for (let y = startY; y < height; y += SPACING) {
          // Soft depth fade toward the edges
          const dx = (x / width) - 0.5
          const dy = (y / height) - 0.5
          const edge = 1 - Math.min(1, Math.sqrt(dx * dx + dy * dy) * 1.3)
          if (edge <= 0) continue
          ctx.globalAlpha = edge
          ctx.beginPath()
          ctx.arc(x, y, RADIUS, 0, Math.PI * 2)
          ctx.fill()
        }
      }
      ctx.globalAlpha = 1
      raf = requestAnimationFrame(frame)
    }

    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(canvas)
    window.addEventListener('pointermove', onMove)
    raf = requestAnimationFrame(frame)

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      window.removeEventListener('pointermove', onMove)
    }
  }, [animate])

  // Static fallback (disabled or reduced-motion): a calm, non-animated dot field
  if (!animate) {
    return (
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          inset: 0,
          zIndex: 0,
          pointerEvents: 'none',
          backgroundColor: 'var(--bg-main)',
          backgroundImage:
            'radial-gradient(rgba(235,181,82,0.14) 1.2px, transparent 1.3px)',
          backgroundSize: '40px 40px',
          maskImage:
            'radial-gradient(ellipse at center, #000 35%, transparent 85%)',
          WebkitMaskImage:
            'radial-gradient(ellipse at center, #000 35%, transparent 85%)'
        }}
      />
    )
  }

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 0,
        pointerEvents: 'none',
        width: '100%',
        height: '100%',
        display: 'block'
      }}
    />
  )
}
