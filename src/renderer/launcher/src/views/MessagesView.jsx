import React from 'react'

export default function MessagesView({ contacts, messengerBase, onBack, onHelp }) {
  function openContact(contact) {
    const slug = contact.slug?.trim()

    // Security: only allow [a-z0-9_-] slugs, even if store data is unexpected
    const safeSlug = slug ? slug.replace(/[^a-z0-9_-]/g, '') : ''

    let base = (messengerBase || 'https://jeankellmansmith.com').trim()
    if (!base.startsWith('http://') && !base.startsWith('https://')) {
      base = `https://${base}`
    }
    base = base.replace(/\/+$/, '')

    const url = safeSlug ? `${base}/chat/${safeSlug}` : base

    window.launcher.openUrl(url, false, 'persist:launcher')
    window.launcher.logActivity('messenger-opened', contact.name)
    // No view change needed — openUrl triggers launcher:browser-opened
    // which App.jsx handles by switching to 'browser' view
  }

  return (
    <div style={styles.root}>
      <div style={styles.header}>
        <button style={styles.backBtn} onClick={onBack}>← Back</button>
        <div style={styles.title}>Messages</div>
        <button style={styles.helpBtn} onClick={onHelp}>💙 Help</button>
      </div>

      <div style={styles.body}>
        {contacts?.length > 0 ? (
          <div style={styles.contactGrid}>
            {contacts.map((c, i) => (
              <button key={c.id ?? i} style={styles.contactCard} onClick={() => openContact(c)}>
                <div style={styles.contactAvatar}>
                  {c.photo
                    ? <img src={c.photo} alt={c.name} style={styles.contactPhoto} />
                    : <span style={styles.contactInitial}>{c.name?.[0] ?? '?'}</span>
                  }
                </div>
                <div style={styles.contactName}>{c.name}</div>
              </button>
            ))}
          </div>
        ) : (
          <div style={styles.empty}>
            No contacts yet. Ask a family member to add contacts in the admin panel.
          </div>
        )}
      </div>
    </div>
  )
}

const styles = {
  root: { width: '100%', height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--bg-main)' },
  header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 28px', borderBottom: '1px solid var(--border)', background: 'var(--bg-card)', gap: 16, flexShrink: 0 },
  backBtn: { padding: '12px 20px', background: 'var(--bg-main)', border: '1.5px solid var(--border)', borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)', fontSize: 'calc(1em * var(--font-scale, 1))', fontWeight: 600, cursor: 'pointer', flexShrink: 0 },
  title: { fontSize: 'calc(1.4em * var(--font-scale, 1))', fontWeight: 700, color: 'var(--accent)', textAlign: 'center', flex: 1 },
  helpBtn: { padding: '12px 20px', background: 'var(--help-bg)', border: '1.5px solid var(--help-border)', borderRadius: 'var(--radius-sm)', color: '#fff', fontSize: 'calc(1em * var(--font-scale, 1))', fontWeight: 600, cursor: 'pointer', flexShrink: 0 },
  body: { flex: 1, overflowY: 'auto', padding: 32 },
  contactGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 20 },
  contactCard: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: '28px 16px', background: 'var(--bg-card)', border: '1.5px solid var(--border)', borderRadius: 'var(--radius)', cursor: 'pointer', transition: 'background 0.12s, border-color 0.12s' },
  contactAvatar: { width: 80, height: 80, borderRadius: '50%', background: 'var(--bg-main)', border: '2px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  contactPhoto: { width: '100%', height: '100%', objectFit: 'cover' },
  contactInitial: { fontSize: 32, fontWeight: 700, color: 'var(--accent)' },
  contactName: { fontSize: 'calc(1.1em * var(--font-scale, 1))', fontWeight: 600, color: 'var(--text-primary)' },
  empty: { textAlign: 'center', color: 'var(--text-secondary)', fontSize: 'calc(1.1em * var(--font-scale, 1))', padding: 48 }
}
