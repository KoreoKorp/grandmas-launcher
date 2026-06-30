import React, { useState } from 'react'

const STEPS = [
  { id: 'name',     title: "What's her name?",           desc: "Used in greetings and the daily message." },
  { id: 'location', title: 'Where does she live?',       desc: 'City or ZIP code — used to show local weather.' },
  { id: 'adminPin', title: 'Set your admin PIN',         desc: 'You\'ll enter this to open the admin panel. 4–8 digits.' },
  { id: 'jeanPin',  title: 'Set her messenger PIN',      desc: 'Jean enters this to open Messages. Keep it simple — 4 digits is plenty.' },
  { id: 'help',     title: 'Emergency help message',     desc: "When she presses Help, what message do you want to send yourself?" },
]

export default function SetupWizard({ config, onSave, onClose }) {
  const [step, setStep] = useState(0)
  const [values, setValues] = useState({
    name:     config.userName        || '',
    location: config.weather?.city   || '',
    adminPin: config.adminPin        || '',
    jeanPin:  config.messenger?.jeanPin || '',
    help:     config.help?.message   || "Jean pressed the Help button and may need assistance.",
  })
  const [saving, setSaving] = useState(false)

  const current = STEPS[step]

  function set(field, val) {
    setValues(prev => ({ ...prev, [field]: val }))
  }

  async function finish() {
    setSaving(true)
    await onSave('userName', values.name.trim())
    await onSave('weather', { ...config.weather, city: values.location.trim() })
    if (values.adminPin.trim()) await onSave('adminPin', values.adminPin.trim())
    await onSave('messenger', { ...config.messenger, jeanPin: values.jeanPin.trim() })
    await onSave('help', { ...config.help, message: values.help.trim() })
    setSaving(false)
    onClose()
  }

  function canAdvance() {
    const v = values[current.id]?.trim()
    if (current.id === 'adminPin') return v?.length >= 4 || v?.length === 0 // optional
    if (current.id === 'jeanPin') return v?.length >= 4 || v?.length === 0
    return true // name, location, help can be blank
  }

  return (
    <div style={s.backdrop}>
      <div style={s.modal}>
        {/* Progress dots */}
        <div style={s.dots}>
          {STEPS.map((_, i) => (
            <div key={i} style={{ ...s.dot, background: i === step ? 'var(--accent)' : i < step ? 'rgba(235,181,82,0.4)' : 'var(--border)' }} />
          ))}
        </div>

        <div style={s.stepNum}>Step {step + 1} of {STEPS.length}</div>
        <div style={s.title}>{current.title}</div>
        <div style={s.desc}>{current.desc}</div>

        <div style={{ marginTop: 20, marginBottom: 24 }}>
          {current.id === 'name' && (
            <input
              autoFocus
              value={values.name}
              onChange={e => set('name', e.target.value)}
              placeholder="e.g. Jean"
              style={s.input}
            />
          )}
          {current.id === 'location' && (
            <input
              autoFocus
              value={values.location}
              onChange={e => set('location', e.target.value)}
              placeholder="e.g. Chicago, IL or 60601"
              style={s.input}
            />
          )}
          {current.id === 'adminPin' && (
            <input
              autoFocus
              type="password"
              inputMode="numeric"
              maxLength={8}
              value={values.adminPin}
              onChange={e => set('adminPin', e.target.value.replace(/\D/g, ''))}
              placeholder="4–8 digits (leave blank to skip)"
              style={s.input}
            />
          )}
          {current.id === 'jeanPin' && (
            <input
              autoFocus
              type="password"
              inputMode="numeric"
              maxLength={8}
              value={values.jeanPin}
              onChange={e => set('jeanPin', e.target.value.replace(/\D/g, ''))}
              placeholder="4 digits (leave blank to skip)"
              style={s.input}
            />
          )}
          {current.id === 'help' && (
            <textarea
              autoFocus
              value={values.help}
              onChange={e => set('help', e.target.value)}
              rows={3}
              style={{ ...s.input, resize: 'vertical' }}
            />
          )}
        </div>

        <div style={{ display: 'flex', gap: 10, justifyContent: 'space-between', alignItems: 'center' }}>
          <button
            className="btn btn-ghost"
            onClick={() => step === 0 ? onClose() : setStep(s => s - 1)}
          >
            {step === 0 ? 'Cancel' : '← Back'}
          </button>

          {step < STEPS.length - 1 ? (
            <button
              className="btn btn-primary"
              disabled={!canAdvance()}
              onClick={() => setStep(s => s + 1)}
            >
              Next →
            </button>
          ) : (
            <button
              className="btn btn-primary"
              disabled={saving}
              onClick={finish}
            >
              {saving ? 'Saving…' : 'Done ✓'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

const s = {
  backdrop: {
    position: 'fixed', inset: 0,
    background: 'rgba(0,0,0,0.7)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 1000,
  },
  modal: {
    background: 'var(--bg-card)',
    border: '1px solid var(--border)',
    borderRadius: 16,
    padding: '32px 36px',
    width: 480,
    maxWidth: '90vw',
  },
  dots: { display: 'flex', gap: 8, marginBottom: 20 },
  dot: { width: 10, height: 10, borderRadius: '50%', transition: 'background 0.2s' },
  stepNum: { fontSize: '0.8em', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 },
  title: { fontSize: '1.25em', fontWeight: 700, color: 'var(--accent)', marginBottom: 8 },
  desc: { fontSize: '0.9em', color: 'var(--text-dim)', lineHeight: 1.5 },
  input: { width: '100%', fontSize: '1em' },
}
