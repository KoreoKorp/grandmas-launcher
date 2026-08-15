import React, { useState, useRef, useEffect } from 'react'
import BuddyMascot from './BuddyMascot'
import { hasTTS, speak as speakText, stopSpeaking as stopSpeechSynthesis } from '../utils/speech'

const hasSpeechRecognition = !!(window.SpeechRecognition || window.webkitSpeechRecognition)

export default function AIBuddy({ onClose, onTileOpen, tiles = [] }) {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [buddyState, setBuddyState] = useState('idle')
  const [listening, setListening] = useState(false)
  const [speaking, setSpeaking] = useState(false)
  const [autoSpeak, setAutoSpeak] = useState(true)
  const scrollRef = useRef(null)
  const inputRef = useRef(null)
  const recognitionRef = useRef(null)
  const greetingSpokenRef = useRef(false)

  useEffect(() => {
    window.launcher.getAIHistory().then(history => {
      if (history && history.length > 0) {
        const formatted = history
          .filter(m => m.role !== 'system')
          .map(m => ({ role: m.role, content: m.content, timestamp: Date.now() }))
        setMessages(formatted)
      } else {
        const greeting = getGreeting()
        setMessages([{ role: 'assistant', content: greeting, timestamp: Date.now() }])
      }
    })
  }, [])

  useEffect(() => {
    if (messages.length === 1 && messages[0].role === 'assistant' && autoSpeak && !greetingSpokenRef.current) {
      greetingSpokenRef.current = true
      setTimeout(() => speak(messages[0].content), 500)
    }
  }, [messages, autoSpeak])

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages, loading])

  useEffect(() => {
    return () => {
      recognitionRef.current?.stop()
      stopSpeechSynthesis()
    }
  }, [])

  function getGreeting() {
    const hour = new Date().getHours()
    let timeGreeting = 'Hello'
    if (hour < 12) timeGreeting = 'Good morning'
    else if (hour < 17) timeGreeting = 'Good afternoon'
    else timeGreeting = 'Good evening'
    return `${timeGreeting}! I'm Buddy, your helper. How can I help you today? You can ask me anything or tap a topic below!`
  }

  function speak(text) {
    speakText(text, {
      rate: 0.9,
      pitch: 1.05,
      onStart: () => { setSpeaking(true); setBuddyState('talking') },
      onEnd: () => { setSpeaking(false); setBuddyState('idle') }
    })
  }

  function stopSpeaking() {
    stopSpeechSynthesis()
    setSpeaking(false)
    setBuddyState('idle')
  }

  function startListening() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SR) return
    const rec = new SR()
    rec.lang = 'en-US'
    rec.interimResults = false
    rec.maxAlternatives = 1
    rec.onresult = (e) => {
      const transcript = e.results[0][0].transcript
      setInput(transcript)
      setListening(false)
      setBuddyState('idle')
    }
    rec.onerror = () => { setListening(false); setBuddyState('idle') }
    rec.onend = () => { setListening(false); setBuddyState('idle') }
    recognitionRef.current = rec
    rec.start()
    setListening(true)
    setBuddyState('listening')
  }

  function stopListening() {
    recognitionRef.current?.stop()
    setListening(false)
    setBuddyState('idle')
  }

  async function sendMessage(text) {
    if (!text.trim() || loading) return
    const userMsg = { role: 'user', content: text.trim(), timestamp: Date.now() }
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setLoading(true)
    setBuddyState('thinking')

    const result = await window.launcher.askAI(text.trim())
    setLoading(false)

    if (result.error === 'no-key') {
      const errMsg = { role: 'assistant', content: "Oh dear, I'm not set up yet! Ask a family member to add an OpenRouter API key in the Admin Panel. Then I can help you!", timestamp: Date.now() }
      setMessages(prev => [...prev, errMsg])
      setBuddyState('idle')
      if (autoSpeak) speak(errMsg.content)
    } else if (result.error) {
      const errMsg = { role: 'assistant', content: "I'm having trouble connecting right now. Let's try again in a moment!", timestamp: Date.now() }
      setMessages(prev => [...prev, errMsg])
      setBuddyState('idle')
      if (autoSpeak) speak(errMsg.content)
    } else {
      const botMsg = { role: 'assistant', content: result.reply, timestamp: Date.now() }
      setMessages(prev => [...prev, botMsg])
      setBuddyState('idle')
      if (autoSpeak) speak(result.reply)
    }
  }

  function clearChat() {
    window.launcher.clearAIHistory()
    const greeting = getGreeting()
    setMessages([{ role: 'assistant', content: greeting, timestamp: Date.now() }])
    if (autoSpeak) speak(greeting)
  }

  const suggestions = [
    { label: 'Open Photos', msg: 'I want to see my photos' },
    { label: 'Play a Game', msg: 'I want to play a game' },
    { label: 'Tell me a Joke', msg: 'Tell me a funny joke' },
    { label: 'What\'s the Weather?', msg: 'What\'s the weather like today?' },
  ]

  return (
    <div style={S.backdrop}>
      <div style={S.card}>
        <div style={S.header}>
          <div style={S.headerLeft}>
            <BuddyMascot state={buddyState} size={52} />
            <div>
              <div style={S.buddyName}>Buddy</div>
              <div style={S.buddyStatus}>
                {loading ? 'Thinking...' : listening ? 'Listening...' : speaking ? 'Talking...' : 'Here to help!'}
              </div>
            </div>
          </div>
          <div style={S.headerActions}>
            <button
              style={{ ...S.iconBtn, ...(autoSpeak ? S.iconBtnActive : {}) }}
              onClick={() => {
                if (autoSpeak) stopSpeaking()
                setAutoSpeak(!autoSpeak)
              }}
              title={autoSpeak ? 'Mute Buddy' : 'Unmute Buddy'}
            >
              {autoSpeak ? '🔊' : '🔇'}
            </button>
            <button style={S.iconBtn} onClick={clearChat} title="Clear conversation">🔄</button>
            <button style={S.iconBtn} onClick={() => { stopSpeaking(); onClose() }} title="Close">✕</button>
          </div>
        </div>

        <div ref={scrollRef} style={S.messages}>
          {messages.map((msg, i) => (
            <div key={i} style={{ ...S.msgRow, justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
              {msg.role === 'assistant' && <BuddyMascot state={speaking && i === messages.length - 1 ? 'talking' : 'idle'} size={32} />}
              <div style={msg.role === 'user' ? S.userMsg : S.botMsg}>
                {msg.content}
              </div>
            </div>
          ))}
          {loading && (
            <div style={{ ...S.msgRow, justifyContent: 'flex-start' }}>
              <BuddyMascot state="thinking" size={32} />
              <div style={S.botMsg}>
                <span style={S.typingDots}>●●●</span>
              </div>
            </div>
          )}
        </div>

        {messages.length <= 1 && (
          <div style={S.chips}>
            {suggestions.map((s, i) => (
              <button key={i} style={S.chip} onClick={() => sendMessage(s.msg)}>
                {s.label}
              </button>
            ))}
          </div>
        )}

        <div style={S.inputRow}>
          {hasSpeechRecognition && (
            <button
              style={{ ...S.micBtn, ...(listening ? S.micBtnActive : {}) }}
              onClick={listening ? stopListening : startListening}
              title={listening ? 'Stop' : 'Speak'}
            >
              {listening ? '⏹' : '🎤'}
            </button>
          )}
          <input
            ref={inputRef}
            style={S.input}
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder={listening ? 'Listening...' : 'Type or speak your message...'}
            onKeyDown={e => { if (e.key === 'Enter') sendMessage(input) }}
            disabled={loading}
          />
          <button
            style={{ ...S.sendBtn, opacity: input.trim() && !loading ? 1 : 0.4 }}
            onClick={() => sendMessage(input)}
            disabled={!input.trim() || loading}
          >
            Send
          </button>
        </div>
      </div>
    </div>
  )
}

const S = {
  backdrop: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(16, 26, 23, 0.92)',
    backdropFilter: 'blur(8px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 950,
    animation: 'fadeIn 0.25s ease'
  },
  card: {
    background: 'var(--bg-card)',
    border: '1.5px solid var(--border)',
    borderRadius: 24,
    width: 'min(520px, 92vw)',
    height: 'min(680px, 88vh)',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    boxShadow: '0 24px 60px rgba(0,0,0,0.5)'
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '14px 18px',
    borderBottom: '1px solid var(--border-subtle)'
  },
  headerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: 10
  },
  buddyName: {
    fontSize: 'calc(1.1em * var(--font-scale, 1))',
    fontWeight: 700,
    color: 'var(--text-primary)',
    fontFamily: 'var(--font-display)'
  },
  buddyStatus: {
    fontSize: 'calc(0.8em * var(--font-scale, 1))',
    color: 'var(--text-secondary)'
  },
  headerActions: {
    display: 'flex',
    gap: 6
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: '50%',
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid var(--border)',
    fontSize: 'calc(1em * var(--font-scale, 1))',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'background 0.15s'
  },
  iconBtnActive: {
    background: 'var(--accent-dim)',
    borderColor: 'var(--accent)'
  },
  messages: {
    flex: 1,
    overflowY: 'auto',
    padding: '16px 18px',
    display: 'flex',
    flexDirection: 'column',
    gap: 12
  },
  msgRow: {
    display: 'flex',
    alignItems: 'flex-end',
    gap: 8
  },
  userMsg: {
    background: 'var(--accent)',
    color: '#1C322D',
    padding: '12px 16px',
    borderRadius: '18px 18px 4px 18px',
    maxWidth: '75%',
    fontSize: 'calc(1.05em * var(--font-scale, 1))',
    lineHeight: 1.5,
    fontWeight: 500
  },
  botMsg: {
    background: 'rgba(255,255,255,0.07)',
    border: '1px solid var(--border)',
    color: 'var(--text-primary)',
    padding: '12px 16px',
    borderRadius: '18px 18px 18px 4px',
    maxWidth: '75%',
    fontSize: 'calc(1.05em * var(--font-scale, 1))',
    lineHeight: 1.5
  },
  typingDots: {
    animation: 'pulse 1.2s ease-in-out infinite',
    color: 'var(--accent)',
    fontSize: '1.3em',
    letterSpacing: 2
  },
  chips: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 8,
    padding: '0 18px 10px'
  },
  chip: {
    padding: '8px 14px',
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid var(--border)',
    borderRadius: 20,
    color: 'var(--text-secondary)',
    fontSize: 'calc(0.9em * var(--font-scale, 1))',
    cursor: 'pointer',
    fontWeight: 500,
    transition: 'background 0.15s, border-color 0.15s'
  },
  inputRow: {
    display: 'flex',
    gap: 8,
    padding: '12px 14px',
    borderTop: '1px solid var(--border-subtle)',
    alignItems: 'center'
  },
  input: {
    flex: 1,
    padding: '12px 16px',
    background: 'rgba(255,255,255,0.06)',
    border: '1.5px solid var(--border)',
    borderRadius: 24,
    color: 'var(--text-primary)',
    fontSize: 'calc(1em * var(--font-scale, 1))',
    fontFamily: 'var(--font-body)',
    outline: 'none',
    transition: 'border-color 0.15s'
  },
  micBtn: {
    width: 'calc(44px * var(--font-scale, 1))',
    height: 'calc(44px * var(--font-scale, 1))',
    borderRadius: '50%',
    background: 'rgba(255,255,255,0.07)',
    border: '1.5px solid var(--border)',
    fontSize: 'calc(1.1em * var(--font-scale, 1))',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    transition: 'all 0.15s'
  },
  micBtnActive: {
    background: 'rgba(194,85,63,0.15)',
    borderColor: 'var(--danger)',
    animation: 'pulse 1.2s ease-in-out infinite'
  },
  sendBtn: {
    padding: '10px 20px',
    background: 'var(--accent)',
    color: '#1C322D',
    border: 'none',
    borderRadius: 24,
    fontSize: 'calc(0.95em * var(--font-scale, 1))',
    fontWeight: 700,
    cursor: 'pointer',
    flexShrink: 0,
    transition: 'opacity 0.15s, transform 0.1s'
  }
}
