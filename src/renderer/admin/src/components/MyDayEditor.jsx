import React, { useState } from 'react'

function emptyReminder() {
  const d = new Date()
  d.setMinutes(0, 0, 0)
  d.setHours(d.getHours() + 1)
  return { id: Date.now().toString(), message: '', time: d.toISOString().slice(0, 16) }
}

export default function MyDayEditor({ dailyNote, reminders, userName, help, onSaveNote, onSaveReminders, onSaveName, onSaveHelp }) {
  const [note, setNote] = useState(dailyNote)
  const [name, setName] = useState(userName)
  const [rems, setRems] = useState(reminders)
  const [caregiverName, setCaregiverName] = useState(help?.caregiverName ?? '')
  const [saved, setSaved] = useState({})

  function flash(key) {
    setSaved(prev => ({ ...prev, [key]: true }))
    setTimeout(() => setSaved(prev => ({ ...prev, [key]: false })), 2000)
  }

  function updateReminder(id, field, value) {
    setRems(prev => prev.map(r => r.id === id ? { ...r, [field]: value } : r))
  }

  function addReminder() {
    setRems(prev => [...prev, emptyReminder()])
  }

  function removeReminder(id) {
    setRems(prev => prev.filter(r => r.id !== id))
  }

  return (
    <div>
      <h2>My Day</h2>

      {/* Name */}
      <div className="card">
        <div className="field">
          <label>Her Name (shown in greeting)</label>
          <input value={name} onChange={e => setName(e.target.value)} placeholder="Grandma" />
        </div>
        <div className="row">
          <button className="btn btn-primary" onClick={async () => { await onSaveName(name); flash('name') }}>Save Name</button>
          {saved.name && <span className="saved-notice">Saved!</span>}
        </div>
      </div>

      {/* Caregiver */}
      <div className="card">
        <div className="field">
          <label>Caregiver Name (shown on Help overlay)</label>
          <input value={caregiverName} onChange={e => setCaregiverName(e.target.value)} placeholder="e.g. Sarah, Family" />
        </div>
        <div className="row">
          <button className="btn btn-primary" onClick={async () => { await onSaveHelp({ caregiverName }); flash('help') }}>Save</button>
          {saved.help && <span className="saved-notice">Saved!</span>}
        </div>
      </div>

      {/* Daily Note */}
      <div className="card">
        <div className="field">
          <label>Today's Note (shown on sidebar)</label>
          <textarea
            value={note}
            onChange={e => setNote(e.target.value)}
            rows={4}
            placeholder="Write a note for today — visits, updates, reminders..."
          />
        </div>
        <div className="row">
          <button className="btn btn-primary" onClick={async () => { await onSaveNote(note); flash('note') }}>Save Note</button>
          {saved.note && <span className="saved-notice">Saved!</span>}
          <button className="btn btn-ghost" onClick={() => { setNote(''); onSaveNote('') }}>Clear</button>
        </div>
      </div>

      {/* Reminders */}
      <div className="row" style={{ marginBottom: 12 }}>
        <h2 style={{ margin: 0 }}>Reminders</h2>
        <button className="btn btn-ghost" onClick={addReminder}>+ Add</button>
        <button className="btn btn-primary" onClick={async () => { await onSaveReminders(rems); flash('rems') }}>Save All</button>
        {saved.rems && <span className="saved-notice">Saved!</span>}
      </div>

      {rems.length === 0 && (
        <div style={{ color: 'var(--text-dim)', marginBottom: 16 }}>No reminders set.</div>
      )}

      {rems.map(r => (
        <div key={r.id} className="card">
          <div className="row">
            <div className="field" style={{ flex: 1 }}>
              <label>Message</label>
              <input
                value={r.message}
                onChange={e => updateReminder(r.id, 'message', e.target.value)}
                placeholder="Doctor's appointment at 2pm"
              />
            </div>
            <div className="field" style={{ flexShrink: 0 }}>
              <label>Date & Time</label>
              <input
                type="datetime-local"
                value={r.time}
                onChange={e => updateReminder(r.id, 'time', e.target.value)}
                style={{ width: 'auto' }}
              />
            </div>
            <button className="btn btn-danger" style={{ marginTop: 18 }} onClick={() => removeReminder(r.id)}>✕</button>
          </div>
        </div>
      ))}
    </div>
  )
}
