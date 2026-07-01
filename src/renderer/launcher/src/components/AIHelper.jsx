import React, { useState, useRef, useEffect } from 'react'

const hasSpeechRecognition = !!(window.SpeechRecognition || window.webkitSpeechRecognition)
const hasTTS = !!window.speechSynthesis

export default function AIHelper({ aiAvailable, onClose }) {
  const [question, setQuestion] = useState('')
  const [answer, setAnswer] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [listening, setListening] = useState(false)
  const [speaking, setSpeaking] = useState(false)
  const inputRef = useRef(null)
  const recognitionRef = useRef(null)

  useEffect(() => {
    if (inputRef.current && !answer && !loading) inputRef.current.focus()
  }, [answer, loading])

  // Stop any ongoing speech/recognition when unmounting
  useEffect(() => {
    return () => {
      recognitionRef.current?.stop()
      window.speechSynthesis?.cancel()
    }
  }, [])

  function startListening() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SR) return
    const rec = new SR()
    rec.lang = 'en-US'
    rec.interimResults = false
    rec.maxAlternatives = 1
    rec.onresult = (e) => {
      const transcript = e.results[0][0].transcript
      setQuestion(prev => prev ? `${prev} ${transcript}` : transcript)
      setListening(false)
    }
    rec.onerror = () => setListening(false)
    rec.onend = () => setListening(false)
    recognitionRef.current = rec
    rec.start()
    setListening(true)
  }

  function stopListening() {
    recognitionRef.current?.stop()
    setListening(false)
  }

  function speak(text) {
    if (!hasTTS) return
    window.speechSynthesis.cancel()
    const utt = new SpeechSynthesisUtterance(text)
    utt.rate = 0.88
    utt.pitch = 1.05
    utt.onstart = () => setSpeaking(true)
    utt.onend = () => setSpeaking(false)
    utt.onerror = () => setSpeaking(false)
    window.speechSynthesis.speak(utt)
  }

  function stopSpeaking() {
    window.speechSynthesis?.cancel()
    setSpeaking(false)
  }

  async function ask() {
    if (!question.trim() || loading) return
    setLoading(true)
    setError(null)
    setAnswer(null)
    const result = await window.launcher.askAI(question.trim())
    setLoading(false)
    if (result.error === 'no-key') {
      setError('The AI helper is not set up yet. Ask a family member to add an OpenRouter key in the Admin Panel → Display Settings.')
    } else if (result.error) {
      setError('Sorry, I had trouble connecting. Please try again in a moment.')
    } else {
      setAnswer(result.reply)
      speak(result.reply)
    }
  }

  function reset() {
    stopSpeaking()
    setQuestion('')
    setAnswer(null)
    setError(null)
  }

  return (
    <div style={S.backdrop}>
      <div style={S.card}>
        <div style={S.robotIcon}>🤖</div>
        <div style={S.title}>Ask Your Helper</div>

        {!answer && !error && !loading && (
          <>
            <div style={S.subtitle}>What would you like to know?</div>
            <div style={S.inputRow}>
              <textarea
                ref={inputRef}
                style={S.textarea}
                value={question}
                onChange={e => setQuestion(e.target.value)}
                placeholder={listening ? 'Listening…' : 'Type your question here…'}
                onKeyDown={e => {
                  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); ask() }
                }}
                rows={3}
              />
              {hasSpeechRecognition && (
                <button
                  style={{ ...S.micBtn, ...(listening ? S.micBtnActive : {}) }}
                  onClick={listening ? stopListening : startListening}
                  title={listening ? 'Stop listening' : 'Speak your question'}
                >
                  {listening ? '⏹' : '🎤'}
                </button>
              )}
            </div>
            <button
              style={{ ...S.askBtn, opacity: question.trim() ? 1 : 0.45 }}
              onClick={ask}
              disabled={!question.trim()}
            >
              Ask ✨
            </button>
          </>
        )}

        {loading && (
          <div style={S.loadingWrap}>
            <div style={S.spinner}>⏳</div>
            <div style={S.subtitle}>Thinking…</div>
          </div>
        )}

        {(answer || error) && (
          <>
            <div style={answer ? S.answer : S.errorText}>
              {answer || error}
            </div>
            {answer && hasTTS && (
              <button
                style={{ ...S.secondaryBtn, ...(speaking ? S.speakingBtn : {}) }}
                onClick={speaking ? stopSpeaking : () => speak(answer)}
              >
                {speaking ? '⏹ Stop' : '🔊 Read it to me'}
              </button>
            )}
            <button style={S.askBtn} onClick={reset}>
              Ask Another Question
            </button>
          </>
        )}

        <button style={S.closeBtn} onClick={() => { stopSpeaking(); onClose() }}>🏠 Back to Home</button>
      </div>
    </div>
  )
}

const S = {
  backdrop: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(16, 26, 23, 0.95)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 900,
    animation: 'fadeIn 0.2s ease'
  },
  card: {
    background: 'var(--bg-card)',
    border: '1.5px solid var(--border)',
    borderRadius: 28,
    padding: '44px 56px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 20,
    maxWidth: 560,
    width: '90vw',
    textAlign: 'center',
    boxShadow: '0 24px 60px rgba(0,0,0,0.5)'
  },
  robotIcon: {
    fontSize: 'calc(5em * var(--font-scale, 1))',
    lineHeight: 1,
    filter: 'drop-shadow(0 4px 16px rgba(235,181,82,0.3))'
  },
  title: {
    fontSize: 'calc(1.8em * var(--font-scale, 1))',
    fontWeight: 800,
    color: 'var(--text-primary)',
    fontFamily: 'var(--font-display)'
  },
  subtitle: {
    fontSize: 'calc(1.1em * var(--font-scale, 1))',
    color: 'var(--text-secondary)',
    lineHeight: 1.4
  },
  inputRow: {
    display: 'flex',
    gap: 10,
    width: '100%',
    alignItems: 'flex-start'
  },
  textarea: {
    flex: 1,
    padding: '16px 20px',
    background: 'rgba(255,255,255,0.06)',
    border: '1.5px solid var(--border)',
    borderRadius: 'var(--radius-sm)',
    color: 'var(--text-primary)',
    fontSize: 'calc(1.1em * var(--font-scale, 1))',
    fontFamily: 'var(--font-body)',
    resize: 'none',
    outline: 'none',
    lineHeight: 1.5,
    transition: 'border-color 0.15s'
  },
  micBtn: {
    flexShrink: 0,
    width: 'calc(54px * var(--font-scale, 1))',
    height: 'calc(54px * var(--font-scale, 1))',
    borderRadius: '50%',
    background: 'rgba(255,255,255,0.07)',
    border: '1.5px solid var(--border)',
    fontSize: 'calc(1.3em * var(--font-scale, 1))',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'background 0.15s, border-color 0.15s, transform 0.15s',
    marginTop: 4
  },
  micBtnActive: {
    background: 'rgba(235,181,82,0.2)',
    borderColor: 'var(--accent)',
    animation: 'pulse 1.2s ease-in-out infinite'
  },
  askBtn: {
    padding: 'calc(18px * var(--font-scale, 1)) calc(48px * var(--font-scale, 1))',
    background: 'var(--accent)',
    color: '#1C322D',
    border: 'none',
    borderRadius: 'var(--radius)',
    fontSize: 'calc(1.15em * var(--font-scale, 1))',
    fontWeight: 800,
    cursor: 'pointer',
    boxShadow: '0 4px 20px rgba(235,181,82,0.35)',
    transition: 'transform 0.12s, box-shadow 0.12s'
  },
  secondaryBtn: {
    padding: 'calc(12px * var(--font-scale, 1)) calc(28px * var(--font-scale, 1))',
    background: 'rgba(255,255,255,0.07)',
    border: '1.5px solid var(--border)',
    borderRadius: 'var(--radius)',
    color: 'var(--text-secondary)',
    fontSize: 'calc(1em * var(--font-scale, 1))',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'background 0.15s, border-color 0.15s'
  },
  speakingBtn: {
    borderColor: 'var(--accent)',
    color: 'var(--accent)',
    background: 'var(--accent-dim)'
  },
  loadingWrap: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 12
  },
  spinner: {
    fontSize: 'calc(2.5em * var(--font-scale, 1))',
    animation: 'pulse 1.2s ease-in-out infinite'
  },
  answer: {
    fontSize: 'calc(1.15em * var(--font-scale, 1))',
    color: 'var(--text-primary)',
    lineHeight: 1.6,
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-sm)',
    padding: '20px 24px',
    textAlign: 'left',
    width: '100%'
  },
  errorText: {
    fontSize: 'calc(1em * var(--font-scale, 1))',
    color: 'var(--danger)',
    lineHeight: 1.5,
    padding: '16px 20px',
    background: 'rgba(194,85,63,0.08)',
    border: '1px solid rgba(194,85,63,0.3)',
    borderRadius: 'var(--radius-sm)',
    width: '100%',
    textAlign: 'left'
  },
  closeBtn: {
    padding: '14px 36px',
    background: 'transparent',
    border: '1.5px solid var(--border)',
    borderRadius: 'var(--radius)',
    color: 'var(--text-secondary)',
    fontSize: 'calc(1em * var(--font-scale, 1))',
    fontWeight: 600,
    cursor: 'pointer'
  }
}
