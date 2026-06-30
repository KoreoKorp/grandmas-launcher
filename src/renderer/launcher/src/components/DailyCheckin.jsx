import React, { useEffect, useState } from 'react'

export default function DailyCheckin({ onComplete }) {
  const [step, setStep] = useState(1)

  function handleMood(selectedMood) {
    window.launcher.logActivity('daily-checkin-mood', selectedMood)
    setStep(2)
  }

  function handleWater(answer) {
    window.launcher.logActivity('daily-checkin-water', answer)
    onComplete()
  }

  if (step === 2) {
    return (
      <div style={styles.backdrop}>
        <div style={styles.card}>
          <div style={styles.icon}>💧</div>
          <div style={styles.title}>Good! One more thing...</div>
          <div style={styles.subtitle}>Did you drink water this morning?</div>

          <div style={styles.waterOptions}>
            <button style={styles.yesBtn} onClick={() => handleWater('yes')}>
              <span style={styles.waterEmoji}>✅</span>
              <span style={styles.waterLabel}>Yes!</span>
            </button>

            <button style={styles.noBtn} onClick={() => handleWater('not-yet')}>
              <span style={styles.waterEmoji}>❌</span>
              <span style={styles.waterLabel}>Not Yet</span>
            </button>
          </div>

          <button style={styles.skipBtn} onClick={() => handleWater('skipped')}>
            Not Right Now
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={styles.backdrop}>
      <div style={styles.card}>
        <div style={styles.icon}>👋</div>
        <div style={styles.title}>Good Morning!</div>
        <div style={styles.subtitle}>How are you feeling today?</div>

        <div style={styles.options}>
          <button style={styles.moodBtn} onClick={() => handleMood('Great')}>
            <span style={styles.moodEmoji}>😊</span>
            <span style={styles.moodLabel}>Great</span>
          </button>

          <button style={styles.moodBtn} onClick={() => handleMood('Okay')}>
            <span style={styles.moodEmoji}>😐</span>
            <span style={styles.moodLabel}>Okay</span>
          </button>

          <button style={styles.moodBtn} onClick={() => handleMood('Not Well')}>
            <span style={styles.moodEmoji}>🤕</span>
            <span style={styles.moodLabel}>Not Well</span>
          </button>
        </div>

        <button style={styles.skipBtn} onClick={() => handleMood('Skipped')}>
          Not Right Now
        </button>
      </div>
    </div>
  )
}

const styles = {
  backdrop: { position: 'fixed', inset: 0, background: 'rgba(28,28,44,0.95)', zIndex: 1200, display: 'flex', alignItems: 'center', justifyContent: 'center' },
  card: { background: 'var(--bg-card)', border: '2px solid var(--accent)', borderRadius: 'var(--radius)', padding: '56px 64px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 32, minWidth: 480, textAlign: 'center', boxShadow: '0 12px 48px rgba(0,0,0,0.4)' },
  icon: { fontSize: 80, marginBottom: -16 },
  title: { fontFamily: 'var(--font-display)', fontSize: 'calc(2em * var(--font-scale, 1))', fontWeight: 700, color: 'var(--text-primary)' },
  subtitle: { fontSize: 'calc(1.3em * var(--font-scale, 1))', color: 'var(--text-secondary)' },
  options: { display: 'flex', gap: 24, width: '100%', justifyContent: 'center' },
  moodBtn: { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '24px 0', background: 'var(--bg-main)', border: '2px solid var(--border)', borderRadius: 'var(--radius)', cursor: 'pointer', transition: 'transform 0.1s', minWidth: 120 },
  moodEmoji: { fontSize: 56, marginBottom: 12 },
  moodLabel: { fontSize: 'calc(1.2em * var(--font-scale, 1))', fontWeight: 600, color: 'var(--text-primary)' },
  waterOptions: { display: 'flex', gap: 32, width: '100%', justifyContent: 'center' },
  yesBtn: { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '32px 0', background: 'rgba(52, 168, 83, 0.15)', border: '3px solid rgba(52, 168, 83, 0.6)', borderRadius: 'var(--radius)', cursor: 'pointer', transition: 'transform 0.1s', minWidth: 160 },
  noBtn: { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '32px 0', background: 'var(--bg-main)', border: '3px solid var(--border)', borderRadius: 'var(--radius)', cursor: 'pointer', transition: 'transform 0.1s', minWidth: 160 },
  waterEmoji: { fontSize: 64, marginBottom: 16 },
  waterLabel: { fontSize: 'calc(1.4em * var(--font-scale, 1))', fontWeight: 700, color: 'var(--text-primary)' },
  skipBtn: { marginTop: 16, background: 'transparent', border: 'none', color: 'var(--text-secondary)', fontSize: 'calc(1.1em * var(--font-scale, 1))', fontWeight: 600, cursor: 'pointer', padding: '16px 32px' }
}
