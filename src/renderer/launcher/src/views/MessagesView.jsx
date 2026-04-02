import React, { useState, useEffect } from 'react'

const DEFAULT_MESSAGES = [
  'Hi, thinking of you!',
  'Call me when you can 📞',
  'I love you ❤️',
  'Good morning!',
  'Good night!',
  'Hope you are well!'
]

export default function MessagesView({ contacts, onBack, onHelp }) {
  const [selectedContact, setSelectedContact] = useState(null)
  const [step, setStep] = useState('contacts') // 'contacts' | 'messages' | 'custom' | 'confirm'
  const [customText, setCustomText] = useState('')
  const [pendingMessage, setPendingMessage] = useState('')
  const [sent, setSent] = useState(false)

  function selectContact(contact) {
    setSelectedContact(contact)
    setStep('messages')
    setSent(false)
  }

  function selectMessage(msg) {
    setPendingMessage(msg)
    setStep('confirm')
  }

  async function confirmSend() {
    const phone = selectedContact.phone?.replace(/\D/g, '')
    if (phone) {
      const waUrl = `https://wa.me/${phone}?text=${encodeURIComponent(pendingMessage)}`
      // Open WhatsApp Web in an embedded BrowserView with a persistent session
      // so she only needs to scan the QR code once ever
      window.launcher.openUrl(waUrl, false, 'persist:whatsapp')
    }
    window.launcher.logActivity('message-sent', `${selectedContact.name}: ${pendingMessage}`)
    setSent(true)
    setStep('sent')
  }

  function goBack() {
    if (step === 'contacts') return onBack()
    if (step === 'messages') return setStep('contacts')
    if (step === 'custom') return setStep('messages')
    if (step === 'confirm') return setStep('messages')
    if (step === 'sent') { setStep('contacts'); setSelectedContact(null) }
  }

  // Auto-return to contacts 4s after sending
  useEffect(() => {
    if (step !== 'sent') return
    const id = setTimeout(() => {
      setStep('contacts')
      setSelectedContact(null)
      setCustomText('')
    }, 4000)
    return () => clearTimeout(id)
  }, [step])

  const messages = selectedContact?.messages ?? DEFAULT_MESSAGES

  return (
    <div style={styles.root}>
      {/* Header */}
      <div style={styles.header}>
        <button style={styles.backBtn} onClick={goBack}>← Back</button>
        <div style={styles.title}>
          {step === 'contacts' && 'Talk to Family'}
          {step === 'messages' && `Message ${selectedContact?.name}`}
          {step === 'custom' && `Write to ${selectedContact?.name}`}
          {step === 'confirm' && 'Send this message?'}
          {step === 'sent' && '✓ Sent!'}
        </div>
        <button style={styles.helpBtn} onClick={onHelp}>💙 Help</button>
      </div>

      <div style={styles.body}>
        {/* Contact list */}
        {step === 'contacts' && (
          <div style={styles.contactGrid}>
            {contacts?.length > 0 ? contacts.map((c, i) => (
              <button key={i} style={styles.contactCard} onClick={() => selectContact(c)}>
                <div style={styles.contactAvatar}>
                  {c.photo
                    ? <img src={c.photo} alt={c.name} style={styles.contactPhoto} />
                    : <span style={styles.contactInitial}>{c.name[0]}</span>
                  }
                </div>
                <div style={styles.contactName}>{c.name}</div>
              </button>
            )) : (
              <div style={styles.empty}>
                No contacts yet. Ask a family member to add some in the admin panel.
              </div>
            )}
          </div>
        )}

        {/* Pre-made messages */}
        {step === 'messages' && (
          <div style={styles.messageList}>
            {messages.map((msg, i) => (
              <button key={i} style={styles.messageBtn} onClick={() => selectMessage(msg)}>
                {msg}
              </button>
            ))}
            <button style={styles.customBtn} onClick={() => setStep('custom')}>
              ✏️ Write my own message
            </button>
          </div>
        )}

        {/* Custom message input */}
        {step === 'custom' && (
          <div style={styles.customInput}>
            <textarea
              style={styles.textarea}
              placeholder="Type your message here..."
              value={customText}
              onChange={e => setCustomText(e.target.value)}
              maxLength={500}
              autoFocus
            />
            <div style={styles.charCount}>{customText.length}/500</div>
            <button
              style={{ ...styles.sendBtn, opacity: customText.trim() ? 1 : 0.4 }}
              disabled={!customText.trim()}
              onClick={() => selectMessage(customText)}
            >
              Preview message
            </button>
          </div>
        )}

        {/* Confirmation */}
        {step === 'confirm' && (
          <div style={styles.confirm}>
            <div style={styles.confirmLabel}>Send this to {selectedContact?.name}?</div>
            <div style={styles.confirmMessage}>"{pendingMessage}"</div>
            <div style={styles.confirmActions}>
              <button style={styles.sendBtn} onClick={confirmSend}>Send ✓</button>
              <button style={styles.cancelBtn} onClick={() => setStep('messages')}>Go Back</button>
            </div>
          </div>
        )}

        {/* Sent confirmation */}
        {step === 'sent' && (
          <div style={styles.sentScreen}>
            <div style={{ fontSize: 72 }}>💙</div>
            <div style={styles.sentText}>
              Message sent to {selectedContact?.name}!
            </div>
            <button style={styles.sendBtn} onClick={goBack}>
              🏠 Back to messages
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

const styles = {
  root: {
    width: '100%',
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    background: 'var(--bg-main)'
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '20px 28px',
    borderBottom: '1px solid var(--border)',
    background: 'var(--bg-card)',
    gap: 16
  },
  backBtn: {
    padding: '12px 20px',
    background: 'var(--bg-main)',
    border: '1.5px solid var(--border)',
    borderRadius: 'var(--radius-sm)',
    color: 'var(--text-primary)',
    fontSize: 'calc(1em * var(--font-scale, 1))',
    fontWeight: 600,
    cursor: 'pointer',
    flexShrink: 0
  },
  title: {
    fontSize: 'calc(1.4em * var(--font-scale, 1))',
    fontWeight: 700,
    color: 'var(--accent)',
    textAlign: 'center'
  },
  helpBtn: {
    padding: '12px 20px',
    background: 'var(--help-bg)',
    border: '1.5px solid var(--help-border)',
    borderRadius: 'var(--radius-sm)',
    color: '#fff',
    fontSize: 'calc(1em * var(--font-scale, 1))',
    fontWeight: 600,
    cursor: 'pointer',
    flexShrink: 0
  },
  body: {
    flex: 1,
    overflowY: 'auto',
    padding: 32
  },
  contactGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
    gap: 20
  },
  contactCard: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 12,
    padding: '28px 16px',
    background: 'var(--bg-card)',
    border: '1.5px solid var(--border)',
    borderRadius: 'var(--radius)',
    cursor: 'pointer',
    transition: 'background 0.12s, border-color 0.12s'
  },
  contactAvatar: {
    width: 80,
    height: 80,
    borderRadius: '50%',
    background: 'var(--bg-main)',
    border: '2px solid var(--border)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden'
  },
  contactPhoto: { width: '100%', height: '100%', objectFit: 'cover' },
  contactInitial: {
    fontSize: 32,
    fontWeight: 700,
    color: 'var(--accent)'
  },
  contactName: {
    fontSize: 'calc(1.1em * var(--font-scale, 1))',
    fontWeight: 600,
    color: 'var(--text-primary)'
  },
  messageList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 14,
    maxWidth: 600,
    margin: '0 auto'
  },
  messageBtn: {
    padding: '22px 28px',
    background: 'var(--bg-card)',
    border: '1.5px solid var(--border)',
    borderRadius: 'var(--radius)',
    color: 'var(--text-primary)',
    fontSize: 'calc(1.1em * var(--font-scale, 1))',
    fontWeight: 600,
    cursor: 'pointer',
    textAlign: 'left',
    transition: 'background 0.12s, border-color 0.12s'
  },
  customBtn: {
    padding: '22px 28px',
    background: 'transparent',
    border: '1.5px dashed var(--border)',
    borderRadius: 'var(--radius)',
    color: 'var(--text-secondary)',
    fontSize: 'calc(1em * var(--font-scale, 1))',
    fontWeight: 600,
    cursor: 'pointer',
    textAlign: 'left'
  },
  customInput: {
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
    maxWidth: 600,
    margin: '0 auto'
  },
  textarea: {
    width: '100%',
    minHeight: 160,
    padding: '16px 20px',
    background: 'var(--bg-card)',
    border: '1.5px solid var(--border)',
    borderRadius: 'var(--radius)',
    color: 'var(--text-primary)',
    fontSize: 'calc(1.1em * var(--font-scale, 1))',
    fontFamily: 'inherit',
    resize: 'vertical',
    outline: 'none'
  },
  charCount: {
    textAlign: 'right',
    color: 'var(--text-secondary)',
    fontSize: 'calc(0.85em * var(--font-scale, 1))'
  },
  confirm: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 24,
    maxWidth: 560,
    margin: '0 auto',
    textAlign: 'center'
  },
  confirmLabel: {
    fontSize: 'calc(1.3em * var(--font-scale, 1))',
    fontWeight: 700,
    color: 'var(--text-primary)'
  },
  confirmMessage: {
    fontSize: 'calc(1.1em * var(--font-scale, 1))',
    color: 'var(--text-secondary)',
    fontStyle: 'italic',
    background: 'var(--bg-card)',
    border: '1.5px solid var(--border)',
    borderRadius: 'var(--radius)',
    padding: '20px 28px',
    width: '100%'
  },
  confirmActions: {
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
    width: '100%'
  },
  sendBtn: {
    padding: '20px 0',
    background: 'var(--accent)',
    color: '#2a2a3c',
    border: 'none',
    borderRadius: 'var(--radius)',
    fontSize: 'calc(1.15em * var(--font-scale, 1))',
    fontWeight: 700,
    cursor: 'pointer',
    width: '100%',
    transition: 'filter 0.12s'
  },
  cancelBtn: {
    padding: '16px 0',
    background: 'transparent',
    color: 'var(--text-secondary)',
    border: '1.5px solid var(--border)',
    borderRadius: 'var(--radius)',
    fontSize: 'calc(1em * var(--font-scale, 1))',
    fontWeight: 600,
    cursor: 'pointer',
    width: '100%'
  },
  sentScreen: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 28,
    height: '100%',
    textAlign: 'center'
  },
  sentText: {
    fontSize: 'calc(1.6em * var(--font-scale, 1))',
    fontWeight: 700,
    color: 'var(--text-primary)'
  },
  empty: {
    gridColumn: '1 / -1',
    textAlign: 'center',
    color: 'var(--text-secondary)',
    fontSize: 'calc(1.1em * var(--font-scale, 1))',
    padding: 48
  }
}
