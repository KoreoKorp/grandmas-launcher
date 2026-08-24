import React, { useState, useRef, useEffect, useCallback } from 'react'
import headUrl from '../assets/buddy/layer-head.png'
import torsoUrl from '../assets/buddy/layer-torso.png'
import legsUrl from '../assets/buddy/layer-legs.png'
import tailUrl from '../assets/buddy/layer-tail.png'

const hasSpeechRecognition = !!(window.SpeechRecognition || window.webkitSpeechRecognition)
const hasTTS = !!window.speechSynthesis

const rand = (a, b) => a + Math.random() * (b - a)
const pick = arr => arr[Math.floor(Math.random() * arr.length)]

const LINES = {
  morning: [
    "Rise and shine! Want the morning news?",
    "Coffee o'clock. Need anything looked up?",
    "Fresh new day! Check today's note up top.",
  ],
  afternoon: [
    "Looks sunny today! Want me to read the forecast?",
    "Perfect porch weather, if you ask me.",
    "Bored? We could browse the photos together!",
    "Want me to find something good on Pinterest?",
  ],
  evening: [
    "Evening already! Time flies, huh?",
    "Family Radio has some nice tunes tonight.",
    "Want tomorrow's weather before bed?",
  ],
  night: [
    "Getting late — sleep tight soon, okay?",
    "Cozy night! I'll be right here if you need me.",
    "Sweet dreams are made of naps. Trust me, I'm a cat.",
  ],
}

const PET_LINES = ['Hehe, that tickles!', 'Purrrrfect.', 'More scratches, please!', 'You always know just the spot.']
const HEART_EMOJI = ['💛', '🧡', '💕']
const HEAD_GESTURES = ['bc-g-glance-l', 'bc-g-glance-r', 'bc-g-double-take', 'bc-g-perk']

function moodFor(h) {
  return h < 5 ? '😴 Sleepy' : h < 12 ? '☀️ Bright-eyed' : h < 17 ? '😊 Cheerful' : h < 21 ? '🌇 Content' : '🌙 Cozy'
}

function linePool() {
  const h = new Date().getHours()
  if (h < 5) return LINES.night
  if (h < 12) return LINES.morning
  if (h < 17) return LINES.afternoon
  if (h < 21) return LINES.evening
  return LINES.night
}

/**
 * Buddy the cat — lives inline in the sidebar. A 4-layer puppet
 * (head/torso/legs/tail) with idle loops, randomized gestures, strolls,
 * petting reactions and proactive commentary; tapping "Let's chat" swaps
 * to a compact inline chat backed by the same OpenRouter pipeline as the
 * old full-screen AIBuddy modal.
 */
export default function BuddyCat() {
  const [mode, setMode] = useState('pet') // 'pet' | 'chat'
  const [mood, setMood] = useState(moodFor(new Date().getHours()))
  const [bubble, setBubble] = useState('')
  const [bubbleShown, setBubbleShown] = useState(false)
  const [petCount, setPetCount] = useState(0)

  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [listening, setListening] = useState(false)
  const [speaking, setSpeaking] = useState(false)
  const [autoSpeak, setAutoSpeak] = useState(true)
  const [reducedMotion, setReducedMotion] = useState(
    () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
  )

  const scrollRef = useRef(null)
  const rigRef = useRef(null)
  const headGestureRef = useRef(null)
  const tailGestureRef = useRef(null)
  const driftRef = useRef(null)
  const heartsRef = useRef(null)
  const recognitionRef = useRef(null)
  const bubbleTimerRef = useRef(null)
  const hideTimerRef = useRef(null)
  const moodTimerRef = useRef(null)
  const modeRef = useRef(mode)
  modeRef.current = mode

  /* ── Speech bubble ── */
  const say = useCallback((text, dur) => {
    if (modeRef.current !== 'pet') return
    setBubble(text)
    setBubbleShown(false)
    requestAnimationFrame(() => setBubbleShown(true))
    clearTimeout(hideTimerRef.current)
    hideTimerRef.current = setTimeout(() => setBubbleShown(false), dur || rand(5500, 7500))
  }, [])

  /* ── Moods follow the clock ── */
  useEffect(() => {
    const id = setInterval(() => setMood(moodFor(new Date().getHours())), 60_000)
    return () => clearInterval(id)
  }, [])

  /* ── Track OS reduced-motion: keep the gentle idle life, drop the flashy
     stuff (a fully frozen cat reads as broken) ── */
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const onChange = () => setReducedMotion(mq.matches)
    mq.addEventListener?.('change', onChange)
    return () => mq.removeEventListener?.('change', onChange)
  }, [])

  /* ── Proactive commentary ── */
  useEffect(() => {
    let alive = true
    let timer
    const loop = () => {
      timer = setTimeout(() => {
        if (!alive) return
        say(pick(linePool()))
        loop()
      }, rand(14_000, 26_000))
    }
    const initial = setTimeout(() => { if (alive) say(pick(linePool()), 7000) }, 2500)
    loop()
    return () => { alive = false; clearTimeout(timer); clearTimeout(initial) }
  }, [say])

  /* ── One-shot gestures layered over the idle loops ── */
  useEffect(() => {
    const clear = el => el.classList.remove(...HEAD_GESTURES, 'bc-g-nod', 'bc-g-flick')
    const onEnd = e => e.target.classList?.remove(...HEAD_GESTURES, 'bc-g-nod', 'bc-g-flick')
    const els = [headGestureRef.current, tailGestureRef.current].filter(Boolean)
    els.forEach(el => el.addEventListener('animationend', onEnd))
    let alive = true
    let headTimer, tailTimer
    const headLoop = () => {
      headTimer = setTimeout(() => {
        if (!alive || !headGestureRef.current) return
        clear(headGestureRef.current)
        void headGestureRef.current.offsetWidth
        headGestureRef.current.classList.add(pick(HEAD_GESTURES))
        headLoop()
      }, rand(3800, 8500))
    }
    const tailLoop = () => {
      tailTimer = setTimeout(() => {
        if (!alive || !tailGestureRef.current) return
        clear(tailGestureRef.current)
        void tailGestureRef.current.offsetWidth
        tailGestureRef.current.classList.add('bc-g-flick')
        tailLoop()
      }, rand(7000, 15_000))
    }
    headLoop()
    tailLoop()
    return () => {
      alive = false
      clearTimeout(headTimer); clearTimeout(tailTimer)
      els.forEach(el => el.removeEventListener('animationend', onEnd))
    }
  }, [])

  /* ── Wandering: rAF random walk, smooth starts/stops, leans into steps ── */
  useEffect(() => {
    let raf
    let wx = 0, wTarget = 0
    const tick = () => {
      if (modeRef.current === 'pet' && driftRef.current) {
        if (Math.random() < 0.007) wTarget = pick([-34, 0, 0, 34])
        wx += (wTarget - wx) * 0.02
        const lean = Math.max(-3, Math.min(3, (wTarget - wx) * 0.06))
        driftRef.current.style.transform = `translateX(${wx.toFixed(2)}px) rotate(${lean.toFixed(2)}deg)`
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])

  /* ── Chat plumbing ── */
  useEffect(() => {
    window.launcher.getAIHistory().then(history => {
      if (history && history.length > 0) {
        setMessages(history
          .filter(m => m.role !== 'system')
          .map(m => ({ role: m.role, content: m.content })))
      } else {
        setMessages([{ role: 'assistant', content: greeting() }])
      }
    })
    return () => {
      recognitionRef.current?.stop()
      window.speechSynthesis?.cancel()
      clearTimeout(hideTimerRef.current)
      clearTimeout(moodTimerRef.current)
    }
  }, [])

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight
  }, [messages, loading])

  function greeting() {
    const h = new Date().getHours()
    const t = h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'
    return `${t}! I'm Buddy. How can I help you today?`
  }

  function speak(text) {
    if (!hasTTS) return
    window.speechSynthesis.cancel()
    const utt = new SpeechSynthesisUtterance(text)
    utt.rate = 0.9
    utt.pitch = 1.05
    utt.onstart = () => setSpeaking(true)
    utt.onend = () => setSpeaking(false)
    utt.onerror = () => setSpeaking(false)
    window.speechSynthesis.speak(utt)
  }

  function startListening() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SR) return
    const rec = new SR()
    rec.lang = 'en-US'
    rec.interimResults = false
    rec.maxAlternatives = 1
    rec.onresult = e => {
      setInput(e.results[0][0].transcript)
      setListening(false)
    }
    rec.onerror = () => setListening(false)
    rec.onend = () => setListening(false)
    recognitionRef.current = rec
    rec.start()
    setListening(true)
  }

  async function sendMessage(text) {
    if (!text.trim() || loading) return
    setMessages(prev => [...prev, { role: 'user', content: text.trim() }])
    setInput('')
    setLoading(true)
    const result = await window.launcher.askAI(text.trim())
    setLoading(false)
    let reply
    if (result.error === 'no-key') {
      reply = "Oh dear, I'm not set up yet! Ask a family member to add an OpenRouter API key in the Admin Panel. Then I can help!"
    } else if (result.error) {
      reply = "I'm having trouble connecting right now. Let's try again in a moment!"
    } else {
      reply = result.reply
    }
    setMessages(prev => [...prev, { role: 'assistant', content: reply }])
    if (autoSpeak) speak(reply)
  }

  function clearChat() {
    window.launcher.clearAIHistory()
    setMessages([{ role: 'assistant', content: greeting() }])
  }

  /* ── Petting ── */
  function burstHearts(n) {
    const box = heartsRef.current
    if (!box) return
    for (let i = 0; i < n; i++) {
      setTimeout(() => {
        const h = document.createElement('span')
        h.className = 'bc-heart'
        h.textContent = pick(HEART_EMOJI)
        h.style.setProperty('--hx', rand(18, 82) + '%')
        h.style.setProperty('--hs', rand(14, 20) + 'px')
        h.addEventListener('animationend', () => h.remove())
        box.appendChild(h)
      }, i * 130)
    }
  }

  function playOnce(el, cls) {
    if (!el) return
    el.classList.remove(...HEAD_GESTURES, 'bc-g-nod', 'bc-g-flick')
    void el.offsetWidth
    el.classList.add(cls)
  }

  function petBuddy() {
    if (modeRef.current !== 'pet') return
    const next = petCount + 1
    setPetCount(next)
    burstHearts(Math.floor(rand(2, 5)))
    playOnce(headGestureRef.current, 'bc-g-nod')
    playOnce(tailGestureRef.current, 'bc-g-flick')
    const rig = rigRef.current
    if (rig) {
      rig.classList.remove('bc-purring')
      void rig.offsetWidth
      rig.classList.add('bc-purring')
    }
    setMood(next > 3 ? '😻 Overjoyed!' : '🥰 Loved')
    clearTimeout(moodTimerRef.current)
    moodTimerRef.current = setTimeout(() => setMood(moodFor(new Date().getHours())), 2200)
    say(pick(PET_LINES), 2600)
  }

  const suggestions = [
    { label: '📷 Photos', msg: 'I want to see my photos' },
    { label: '🎮 Games', msg: 'I want to play a game' },
    { label: '😄 Joke', msg: 'Tell me a funny joke' },
    { label: '☀️ Weather', msg: "What's the weather like today?" },
  ]

  return (
    <div className={reducedMotion ? 'bc-zone bc-reduced' : 'bc-zone'} style={S.zone}>
      <style>{CSS}</style>

      {/* ── Pet view ── */}
      <div className="bc-idle" style={{ ...S.idle, ...(mode === 'chat' ? S.idleHidden : {}) }}>
        <div style={S.moodChip}>{mood}</div>

        <div style={S.stage}>
          <div className={bubbleShown ? 'bc-bubble bc-show' : 'bc-bubble'}>{bubble}</div>
          <div
            style={S.buddyWrap}
            role="button"
            tabIndex={0}
            aria-label="Pet Buddy the cat"
            onClick={petBuddy}
            onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); petBuddy() } }}
          >
            <div className="bc-shadow" />
            <div ref={driftRef} className="bc-drift">
              <div ref={rigRef} className="bc-rig">
                <img className="bc-layer bc-legs" alt="" src={legsUrl} />
                <span className="bc-float">
                  <img className="bc-layer bc-torso" alt="Buddy the cat" src={torsoUrl} />
                  <span ref={tailGestureRef} className="bc-tail-gesture">
                    <span className="bc-tail-sway">
                      <img className="bc-layer bc-tail" alt="" src={tailUrl} />
                    </span>
                  </span>
                  <span ref={headGestureRef} className="bc-head-gesture">
                    <img className="bc-layer bc-head" alt="" src={headUrl} />
                  </span>
                </span>
              </div>
            </div>
            <div ref={heartsRef} className="bc-hearts" />
          </div>
        </div>

        <div style={S.hint}>Tap Buddy to say hi</div>
        <button style={S.chatBtn} onClick={() => setMode('chat')}>💬 Let's chat</button>
      </div>

      {/* ── Chat view ── */}
      <div className="bc-chat" style={{ ...S.chat, ...(mode === 'chat' ? S.chatShown : {}) }}>
        <div style={S.chatHeader}>
          <button style={S.backBtn} onClick={() => setMode('pet')} title="Back">←</button>
          <div style={S.avatar}>🐱</div>
          <div style={{ flex: 1 }}>
            <div style={S.name}>Buddy</div>
            <div style={S.status}>
              {loading ? 'Thinking...' : listening ? 'Listening...' : speaking ? 'Talking...' : 'Here to help!'}
            </div>
          </div>
          <button
            style={{ ...S.iconBtn, ...(autoSpeak ? S.iconBtnActive : {}) }}
            onClick={() => { if (autoSpeak) window.speechSynthesis?.cancel(); setAutoSpeak(!autoSpeak) }}
            title={autoSpeak ? 'Mute Buddy' : 'Unmute Buddy'}
          >
            {autoSpeak ? '🔊' : '🔇'}
          </button>
          <button style={S.iconBtn} onClick={clearChat} title="Clear conversation">🔄</button>
        </div>

        <div ref={scrollRef} style={S.messages}>
          {messages.map((msg, i) => (
            <div key={i} style={{ ...S.msgRow, justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
              {msg.role === 'assistant' && <div style={S.avatarSmall}>🐱</div>}
              <div style={msg.role === 'user' ? S.userMsg : S.botMsg}>{msg.content}</div>
            </div>
          ))}
          {loading && (
            <div style={{ ...S.msgRow, justifyContent: 'flex-start' }}>
              <div style={S.avatarSmall}>🐱</div>
              <div style={S.botMsg}><span className="bc-typing">●●●</span></div>
            </div>
          )}
        </div>

        {messages.length <= 1 && (
          <div style={S.chips}>
            {suggestions.map((s, i) => (
              <button key={i} style={S.chip} onClick={() => sendMessage(s.msg)}>{s.label}</button>
            ))}
          </div>
        )}

        <div style={S.inputRow}>
          {hasSpeechRecognition && (
            <button
              style={{ ...S.micBtn, ...(listening ? S.micActive : {}) }}
              onClick={listening ? () => recognitionRef.current?.stop() : startListening}
              title={listening ? 'Stop' : 'Speak'}
            >
              {listening ? '⏹' : '🎤'}
            </button>
          )}
          <input
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
            ➤
          </button>
        </div>
      </div>
    </div>
  )
}

const S = {
  zone: {
    position: 'relative',
    flex: 1,
    minHeight: 240,
    background: 'var(--bg-card)',
    border: '1.5px solid var(--border)',
    borderRadius: 'var(--radius)',
    overflow: 'hidden',
    boxShadow: '0 10px 30px -12px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.06)'
  },
  idle: {
    position: 'absolute',
    inset: 0,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '10px 14px 10px',
    transition: 'opacity 0.28s ease, transform 0.28s ease',
    minHeight: 0
  },
  idleHidden: { opacity: 0, pointerEvents: 'none', transform: 'translateY(-8px)' },
  moodChip: {
    alignSelf: 'flex-start',
    fontSize: 'calc(0.72em * var(--font-scale, 1))',
    fontWeight: 700,
    color: 'var(--text-secondary)',
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid var(--border-subtle)',
    borderRadius: 20,
    padding: '3px 10px'
  },
  stage: {
    position: 'relative',
    flex: 1,
    width: '100%',
    display: 'flex',
    alignItems: 'flex-end',
    justifyContent: 'center',
    paddingBottom: 4
  },
  buddyWrap: {
    position: 'relative',
    cursor: 'pointer',
    outline: 'none',
    filter: 'drop-shadow(0 8px 10px rgba(0,0,0,0.35))'
  },
  hint: {
    fontSize: 'calc(0.72em * var(--font-scale, 1))',
    color: 'var(--text-dim)',
    marginTop: 4,
    letterSpacing: 0.2
  },
  chatBtn: {
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 10,
    marginTop: 8,
    background: 'var(--accent-dim)',
    border: '1px solid rgba(235,181,82,0.3)',
    borderRadius: 14,
    color: 'var(--accent)',
    fontWeight: 700,
    fontSize: 'calc(0.9em * var(--font-scale, 1))',
    cursor: 'pointer',
    transition: 'background 0.15s'
  },
  chat: {
    position: 'absolute',
    inset: 0,
    display: 'flex',
    flexDirection: 'column',
    opacity: 0,
    pointerEvents: 'none',
    transform: 'translateY(8px)',
    transition: 'opacity 0.28s ease, transform 0.28s ease'
  },
  chatShown: { opacity: 1, pointerEvents: 'auto', transform: 'translateY(0)' },
  chatHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '10px 12px',
    borderBottom: '1px solid var(--border-subtle)',
    flexShrink: 0
  },
  backBtn: {
    width: 30,
    height: 30,
    borderRadius: '50%',
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid var(--border)',
    color: 'var(--text-secondary)',
    fontSize: 13,
    cursor: 'pointer',
    flexShrink: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  },
  avatar: {
    width: 30,
    height: 30,
    borderRadius: '50%',
    flexShrink: 0,
    background: 'radial-gradient(circle at 40% 35%, #F5D9A8, #EBB552)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 16
  },
  avatarSmall: {
    width: 22,
    height: 22,
    borderRadius: '50%',
    flexShrink: 0,
    background: 'radial-gradient(circle at 40% 35%, #F5D9A8, #EBB552)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 12
  },
  name: {
    fontWeight: 700,
    fontSize: 'calc(0.9em * var(--font-scale, 1))',
    color: 'var(--text-primary)'
  },
  status: {
    fontSize: 'calc(0.72em * var(--font-scale, 1))',
    color: 'var(--text-secondary)'
  },
  iconBtn: {
    width: 30,
    height: 30,
    borderRadius: '50%',
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid var(--border)',
    color: 'var(--text-secondary)',
    fontSize: 'calc(0.85em * var(--font-scale, 1))',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0
  },
  iconBtnActive: { background: 'var(--accent-dim)', borderColor: 'var(--accent)' },
  messages: {
    flex: 1,
    overflowY: 'auto',
    padding: '10px 12px',
    display: 'flex',
    flexDirection: 'column',
    gap: 8
  },
  msgRow: { display: 'flex', alignItems: 'flex-end', gap: 6 },
  userMsg: {
    background: 'var(--accent)',
    color: '#1C322D',
    padding: '8px 12px',
    borderRadius: '14px 14px 3px 14px',
    maxWidth: '80%',
    fontSize: 'calc(0.85em * var(--font-scale, 1))',
    lineHeight: 1.45,
    fontWeight: 500
  },
  botMsg: {
    background: 'rgba(255,255,255,0.07)',
    border: '1px solid var(--border)',
    color: 'var(--text-primary)',
    padding: '8px 12px',
    borderRadius: '14px 14px 14px 3px',
    maxWidth: '80%',
    fontSize: 'calc(0.85em * var(--font-scale, 1))',
    lineHeight: 1.45
  },
  chips: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 6,
    padding: '0 12px 8px'
  },
  chip: {
    padding: '6px 10px',
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid var(--border)',
    borderRadius: 16,
    color: 'var(--text-secondary)',
    fontSize: 'calc(0.78em * var(--font-scale, 1))',
    cursor: 'pointer',
    fontWeight: 500
  },
  inputRow: {
    display: 'flex',
    gap: 6,
    padding: '8px 10px',
    borderTop: '1px solid var(--border-subtle)',
    alignItems: 'center',
    flexShrink: 0
  },
  micBtn: {
    width: 32,
    height: 32,
    borderRadius: '50%',
    background: 'rgba(255,255,255,0.07)',
    border: '1.5px solid var(--border)',
    color: 'var(--text-primary)',
    fontSize: 'calc(0.9em * var(--font-scale, 1))',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0
  },
  micActive: {
    background: 'rgba(194,85,63,0.15)',
    borderColor: 'var(--danger)',
    animation: 'pulse 1.2s ease-in-out infinite'
  },
  input: {
    flex: 1,
    minWidth: 0,
    padding: '8px 12px',
    background: 'rgba(255,255,255,0.06)',
    border: '1.5px solid var(--border)',
    borderRadius: 18,
    color: 'var(--text-primary)',
    fontSize: 'calc(0.85em * var(--font-scale, 1))',
    fontFamily: 'var(--font-body)',
    outline: 'none'
  },
  sendBtn: {
    width: 32,
    height: 32,
    borderRadius: '50%',
    background: 'var(--accent)',
    color: '#1C322D',
    border: 'none',
    fontWeight: 700,
    fontSize: 'calc(0.9em * var(--font-scale, 1))',
    cursor: 'pointer',
    flexShrink: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  }
}

/* Scoped styles + keyframes for the puppet rig (ported from docs/ai-buddy/preview.html) */
const CSS = `
.bc-zone { --bc-cyan: #00E1FF; }
.bc-idle { opacity: 1; }
.bc-zone button { font-family: var(--font-body); }

.bc-bubble {
  position: absolute;
  top: 26px;
  left: 50%;
  background: var(--bg-card-hover, #2E4A41);
  border: 1px solid var(--border);
  border-radius: 14px 14px 14px 4px;
  padding: 8px 12px;
  font-size: calc(0.8em * var(--font-scale, 1));
  line-height: 1.4;
  max-width: 88%;
  text-align: center;
  color: var(--text-primary);
  box-shadow: 0 6px 18px -6px rgba(0,0,0,0.4);
  opacity: 0;
  visibility: hidden;
  transform: translateX(-50%) translateY(6px) scale(0.88);
  transition: opacity 0.18s ease, transform 0.18s ease, visibility 0s linear 0.18s;
  z-index: 2;
}
.bc-bubble.bc-show {
  opacity: 1;
  visibility: visible;
  transform: translateX(-50%) translateY(0) scale(1);
  transition: opacity 0.22s ease, transform 0.34s cubic-bezier(0.34,1.56,0.64,1), visibility 0s linear 0s;
}

.bc-drift { will-change: transform; position: relative; }
.bc-hearts { position: absolute; inset: -26px -34px auto; height: 0; pointer-events: none; z-index: 3; }
.bc-heart { position: absolute; top: -6px; left: var(--hx, 50%); font-size: var(--hs, 18px); opacity: 0; }
.bc-heart { animation: bc-heart-float 0.95s ease-out forwards; }

.bc-rig { position: relative; width: 175px; height: 211px; }
.bc-layer { position: absolute; display: block; pointer-events: none; }

.bc-legs { left: 8px; top: 149px; width: 148px; height: 62px; }

.bc-float {
  position: absolute; inset: 0; display: block;
  animation: bc-bob 3.6s ease-in-out infinite;
}
.bc-torso {
  left: 3px; top: 84px; width: 160px; height: 72px;
  animation: bc-breathe 3s ease-in-out infinite;
  transform-origin: 50% 100%;
}
.bc-tail-gesture {
  position: absolute; display: block;
  left: 103px; top: 48px; width: 72px; height: 75px;
  transform-origin: 23% 83%;
  pointer-events: none;
}
.bc-tail-sway {
  position: absolute; inset: 0; display: block;
  transform-origin: 23% 83%;
  animation: bc-tail-sway 5.7s ease-in-out infinite;
}
.bc-tail {
  left: 0; top: 0; width: 72px; height: 75px;
  transform-origin: 23% 83%;
  animation: bc-tail-swish 2.2s cubic-bezier(0.45, 0, 0.55, 1) infinite;
}
.bc-head-gesture {
  position: absolute; display: block;
  left: -3px; top: 0; width: 153px; height: 95px;
  transform-origin: 52% 91%;
  pointer-events: none;
}
.bc-head {
  left: 0; top: 0; width: 153px; height: 95px;
  transform-origin: 52% 91%;
  animation: bc-head-tilt 4.4s ease-in-out infinite;
}

.bc-g-glance-l { animation: bc-g-glance-l 1s ease-in-out; }
.bc-g-glance-r { animation: bc-g-glance-r 1s ease-in-out; }
.bc-g-double-take { animation: bc-g-double-take 0.9s ease-in-out; }
.bc-g-perk { animation: bc-g-perk 0.7s ease-in-out; }
.bc-g-nod { animation: bc-g-nod 0.55s ease-in-out; }
.bc-g-flick { animation: bc-g-flick 0.65s cubic-bezier(0.36, 0.07, 0.19, 0.97); }

.bc-rig.bc-purring { animation: bc-purr 0.09s linear 9; }
.bc-rig.bc-purring .bc-torso { animation: bc-breathe 3s ease-in-out infinite, bc-squash 0.52s cubic-bezier(0.36, 0.07, 0.19, 0.97); }

.bc-shadow {
  position: absolute; left: 50%; bottom: -8px;
  width: 128px; height: 15px; border-radius: 50%;
  background: radial-gradient(ellipse at center, rgba(0,0,0,0.55) 0%, transparent 70%);
  filter: blur(2px);
  animation: bc-shadow-pulse 3.6s ease-in-out infinite;
  pointer-events: none;
}

.bc-typing { animation: pulse 1.2s ease-in-out infinite; color: var(--accent); letter-spacing: 2; }

@keyframes bc-bob { 0%,100% { translate: 0 -3px; } 50% { translate: 0 3px; } }
@keyframes bc-shadow-pulse {
  0%,100% { transform: translateX(-50%) scaleX(1); opacity: 0.5; }
  50% { transform: translateX(-50%) scaleX(0.82); opacity: 0.32; }
}
@keyframes bc-breathe {
  0% { transform: scale(1, 1); }
  40% { transform: scale(1, 0.982); }
  100% { transform: scale(1, 1); }
}
@keyframes bc-head-tilt { 0%,100% { transform: rotate(-3deg); } 50% { transform: rotate(3deg); } }
@keyframes bc-tail-swish { 0%,100% { transform: rotate(-8deg); } 50% { transform: rotate(15deg); } }
@keyframes bc-tail-sway { 0%,100% { transform: rotate(0); } 33% { transform: rotate(5deg); } 66% { transform: rotate(-5deg); } }
@keyframes bc-squash {
  0% { transform: scale(1, 1); }
  35% { transform: scale(0.84, 1.16); }
  70% { transform: scale(1.07, 0.94); }
  100% { transform: scale(1, 1); }
}
@keyframes bc-purr {
  0%,100% { rotate: 0deg; } 25% { rotate: -0.6deg; } 75% { rotate: 0.6deg; }
}
@keyframes bc-g-glance-l { 0% { rotate: 0deg; } 35% { rotate: -9deg; } 70% { rotate: -8deg; } 100% { rotate: 0deg; } }
@keyframes bc-g-glance-r { 0% { rotate: 0deg; } 35% { rotate: 9deg; } 70% { rotate: 8deg; } 100% { rotate: 0deg; } }
@keyframes bc-g-double-take { 0% { rotate: 0deg; } 20% { rotate: 6deg; } 45% { rotate: -6deg; } 72% { rotate: 3deg; } 100% { rotate: 0deg; } }
@keyframes bc-g-perk { 0% { rotate: 0deg; scale: 1; } 40% { rotate: -4deg; scale: 1.03; } 100% { rotate: 0deg; scale: 1; } }
@keyframes bc-g-nod { 0% { rotate: 0deg; } 30% { rotate: -13deg; } 65% { rotate: 7deg; } 100% { rotate: 0deg; } }
@keyframes bc-g-flick { 0% { rotate: 0deg; } 30% { rotate: -24deg; } 65% { rotate: 16deg; } 100% { rotate: 0deg; } }
@keyframes bc-heart-float {
  0% { opacity: 0; transform: translateY(4px) scale(0.6); }
  18% { opacity: 1; transform: translateY(-8px) scale(1.12); }
  100% { opacity: 0; transform: translateY(-44px) scale(0.95); }
}

/* Reduced motion: drop drift, hearts, purr and gesture pops, but keep the
   gentle idle loops (slowed) — a completely frozen cat reads as broken. */
.bc-reduced .bc-drift { transform: none !important; }
.bc-reduced .bc-heart { display: none; }
.bc-reduced .bc-head-gesture, .bc-reduced .bc-tail-gesture { animation: none !important; }
.bc-reduced .bc-rig.bc-purring { animation: none; }
.bc-reduced .bc-rig.bc-purring .bc-torso { animation: bc-breathe 3s ease-in-out infinite; }
.bc-reduced .bc-float { animation-duration: 6s; }
.bc-reduced .bc-tail { animation-duration: 4.5s; }
.bc-reduced .bc-tail-sway { animation-duration: 9s; }
.bc-reduced .bc-head { animation-duration: 7s; }
`
