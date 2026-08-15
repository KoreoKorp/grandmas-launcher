import React, { useState } from 'react'

const DEFAULT_MESSAGES = ['Hi, thinking of you!', 'Call me when you can 📞', 'I love you ❤️', 'Good morning!']

function emptyContact() {
  return {
    id: Date.now().toString(),
    name: '',
    relation: '',
    phone: '',
    photo: '',
    slug: '',
    autoAnswer: false,
    homeTile: false,
    messages: [...DEFAULT_MESSAGES]
  }
}

export default function ContactsManager({ contacts, onSave }) {
  const [list, setList] = useState(contacts)
  const [expanded, setExpanded] = useState(null)
  const [saved, setSaved] = useState(false)

  function update(id, field, value) {
    setList(prev => prev.map(c => c.id === id ? { ...c, [field]: value } : c))
  }

  function updateMessage(contactId, index, value) {
    setList(prev => prev.map(c => {
      if (c.id !== contactId) return c
      const msgs = [...c.messages]
      msgs[index] = value
      return { ...c, messages: msgs }
    }))
  }

  function addMessage(contactId) {
    setList(prev => prev.map(c =>
      c.id === contactId ? { ...c, messages: [...c.messages, ''] } : c
    ))
  }

  function removeMessage(contactId, index) {
    setList(prev => prev.map(c => {
      if (c.id !== contactId) return c
      const msgs = c.messages.filter((_, i) => i !== index)
      return { ...c, messages: msgs }
    }))
  }

  async function save() {
    await onSave(list)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div>
      <div className="row" style={{ marginBottom: 20 }}>
        <h2 style={{ margin: 0 }}>Contacts & Messages</h2>
        <button className="btn btn-ghost" onClick={() => setList(prev => [...prev, emptyContact()])}>+ Add Contact</button>
        <button className="btn btn-primary" onClick={save}>Save All</button>
        {saved && <span className="saved-notice">Saved!</span>}
      </div>

      {list.length === 0 && (
        <div style={{ color: 'var(--text-dim)', marginBottom: 16 }}>No contacts yet. Add one above.</div>
      )}

      {list.map((c, index) => (
        <div key={c.id} className="card">
          <div className="row" style={{ marginBottom: 0 }}>
            <div style={styles.avatar}>
              {c.photo
                ? <img src={c.photo} alt={c.name} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
                : <span style={{ fontSize: 22, color: 'var(--accent)' }}>{c.name[0] || '?'}</span>
              }
            </div>
            <div style={{ flex: 1 }}>
              <input
                value={c.name}
                onChange={e => update(c.id, 'name', e.target.value)}
                placeholder="Name"
                style={{ marginBottom: 6 }}
              />
              <input
                value={c.relation || ''}
                onChange={e => update(c.id, 'relation', e.target.value)}
                placeholder="Relation (e.g. Grandson)"
                style={{ marginBottom: 6 }}
              />
              <input
                value={c.phone}
                onChange={e => update(c.id, 'phone', e.target.value)}
                placeholder="WhatsApp number (+1234567890)"
              />
            </div>
            <button
              className="btn btn-ghost"
              onClick={() => setExpanded(expanded === c.id ? null : c.id)}
            >
              {expanded === c.id ? 'Hide messages ↑' : 'Edit messages ↓'}
            </button>
            <button className="btn btn-danger" onClick={() => setList(prev => prev.filter(x => x.id !== c.id))}>✕</button>
          </div>

          {expanded === c.id && (
            <div style={{ marginTop: 16 }}>
              <div className="field" style={{ marginBottom: 12 }}>
                <label>Messenger slug (e.g. <code>janetrhodes</code>)</label>
                <input
                  value={c.slug || ''}
                  onChange={e => update(c.id, 'slug', e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                  placeholder="e.g. janetrhodes"
                />
                <div style={{ fontSize: '0.8em', color: 'var(--text-dim)', marginTop: 4 }}>
                  Their chat link: <strong>chat.jeankellmansmith.com/chat/{c.slug || 'slug'}</strong>
                </div>
              </div>
              <div className="field" style={{ marginBottom: 12 }}>
                <label>Messenger PIN (optional — they enter this to open the chat)</label>
                <input
                  value={c.messengerPin || ''}
                  onChange={e => update(c.id, 'messengerPin', e.target.value.replace(/\D/g, ''))}
                  placeholder="e.g. 4321"
                  maxLength={12}
                />
              </div>
              <div className="field" style={{ marginBottom: 12 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={!!c.autoAnswer}
                    onChange={e => update(c.id, 'autoAnswer', e.target.checked)}
                    style={{ width: 'auto' }}
                  />
                  Auto-answer video calls from this contact
                </label>
                <div style={{ fontSize: '0.8em', color: 'var(--text-dim)', marginTop: 4 }}>
                  Only enable for people she'd want to see connect automatically — the call
                  still rings and chimes first, but she won't need to tap Answer.
                  Everyone else always rings until she taps Answer or Decline.
                </div>
              </div>
              <div className="field" style={{ marginBottom: 12 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={!!c.homeTile}
                    onChange={e => update(c.id, 'homeTile', e.target.checked)}
                    style={{ width: 'auto' }}
                  />
                  Add a one-tap "Call {c.name || 'them'}" tile to the home screen
                </label>
              </div>
              <label>Pre-made messages</label>
              {c.messages.map((msg, i) => (
                <div key={i} className="row" style={{ marginBottom: 6 }}>
                  <input
                    value={msg}
                    onChange={e => updateMessage(c.id, i, e.target.value)}
                    placeholder="Message..."
                  />
                  <button className="btn btn-danger" style={{ padding: '6px 10px' }} onClick={() => removeMessage(c.id, i)}>✕</button>
                </div>
              ))}
              <button className="btn btn-ghost" style={{ marginTop: 6 }} onClick={() => addMessage(c.id)}>+ Add message</button>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

const styles = {
  avatar: {
    width: 52,
    height: 52,
    borderRadius: '50%',
    background: 'var(--bg)',
    border: '1px solid var(--border)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    overflow: 'hidden'
  }
}
