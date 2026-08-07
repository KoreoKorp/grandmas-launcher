import React, { useState, useEffect, useRef, useCallback } from 'react'
import HomeView from './views/HomeView'
import MessagesView from './views/MessagesView'
import MessengerView from './views/MessengerView'
import GamesView from './views/GamesView'
import PhotosView from './views/PhotosView'
import HelpOverlay from './components/HelpOverlay'
import ConfusionOverlay from './components/ConfusionOverlay'
import WeatherOverlay from './components/WeatherOverlay'
import NavBar from './components/NavBar'
import IncomingCallOverlay from './components/IncomingCallOverlay'
import VideoCallOverlay from './components/VideoCallOverlay'
import AudioPlayer from './components/AudioPlayer'
import DailyCheckin from './components/DailyCheckin'
import AIHelper from './components/AIHelper'
import AIBuddy from './components/AIBuddy'
import BuddyFloat from './components/BuddyFloat'

export default function App() {
  const [config, setConfig] = useState(null)
  const [weatherList, setWeatherList] = useState([])
  const [view, setView] = useState('home') // 'home' | 'browser' | 'messages' | 'messenger'
  const [browserUrl, setBrowserUrl] = useState('')
  const [showHelp, setShowHelp] = useState(false)
  const [showConfusion, setShowConfusion] = useState(false)
  const [showWeather, setShowWeather] = useState(false)
  const [browserLoaded, setBrowserLoaded] = useState(false)
  const [isOnline, setIsOnline] = useState(true)
  const [showCheckin, setShowCheckin] = useState(false)
  const [showAIHelper, setShowAIHelper] = useState(false)
  const [showAIBuddy, setShowAIBuddy] = useState(false)
  const [missedCalls, setMissedCalls] = useState(0)

  const [incomingCall, setIncomingCall] = useState(null)   // { from, callerName, offer }
  const [activeCall, setActiveCall] = useState(null)        // { caller, localStream, remoteStream }

  const inactivityTimer = useRef(null)
  const tapTimes = useRef([])
  const peerRef = useRef(null)
  const iceCandidateQueue = useRef([])  // Buffer candidates that arrive during 3s overlay
  const localStreamRef = useRef(null)   // Ref so hangUp always has fresh stream even in stale closures
  const activeCallRef = useRef(null)    // Mirror of activeCall state for side-effect-free access in hangUp

  // Load config on mount
  useEffect(() => {
    window.launcher.getConfig().then(setConfig)
    window.launcher.getWeather().then(r => setWeatherList(Array.isArray(r) ? r : r ? [r] : []))
  }, [])

  // Re-fetch weather every 30 min
  useEffect(() => {
    const id = setInterval(() => {
      window.launcher.getWeather().then(r => setWeatherList(Array.isArray(r) ? r : r ? [r] : []))
    }, 30 * 60 * 1000)
    return () => clearInterval(id)
  }, [])

  // Listen for config updates from admin — reload full config on any change
  useEffect(() => {
    const cleanup = window.launcher.onConfigUpdated(() => {
      window.launcher.getConfig().then(setConfig)
    })
    return cleanup
  }, [])

  // Listen for weather pushed from main (after admin force-refresh)
  useEffect(() => {
    const cleanup = window.launcher.onWeatherUpdated(r => setWeatherList(Array.isArray(r) ? r : r ? [r] : []))
    return cleanup
  }, [])

  // Listen for go-home signal from main (e.g. Back pressed with no browser history, F24)
  useEffect(() => {
    const cleanup = window.launcher.onGoHome(() => {
      if (peerRef.current) hangUp()
      goHome()
    })
    return cleanup
  }, [])

  const configRef = useRef(config)
  useEffect(() => { configRef.current = config }, [config])

  // Incoming call from signaling server
  useEffect(() => {
    const cleanup = window.launcher.onIncomingCall((data) => {
      let relation = ''
      if (configRef.current && configRef.current.contacts) {
        const c = configRef.current.contacts.find(c => c.name === data.callerName || (c.slug && c.slug === data.from))
        if (c && c.relation) relation = c.relation
      }
      setIncomingCall({ ...data, relation })
      setMissedCalls(n => n + 1)
    })
    return cleanup
  }, [])

  // ICE candidates — queue if peerRef not ready yet (arrives during 3s overlay)
  useEffect(() => {
    const cleanup = window.launcher.onIceCandidate(({ candidate }) => {
      if (peerRef.current && candidate) {
        peerRef.current.addIceCandidate(new RTCIceCandidate(candidate)).catch(() => {})
      } else if (candidate) {
        iceCandidateQueue.current.push(candidate)
      }
    })
    return cleanup
  }, [])

  // Remote hang-up
  useEffect(() => {
    const cleanup = window.launcher.onCallEnded(() => {
      hangUp()
    })
    return cleanup
  }, [])

  // Listen for browser open/close/loaded signals from main process
  useEffect(() => {
    const cleanupOpen = window.launcher.onBrowserOpened(({ url }) => {
      setBrowserUrl(url)
      setBrowserLoaded(false)  // reset — new page is loading
      setView('browser')
    })
    const cleanupClose = window.launcher.onBrowserClosed(() => {
      setView('home')
      setBrowserUrl('')
      setBrowserLoaded(false)
    })
    const cleanupLoaded = window.launcher.onBrowserLoaded(() => {
      setBrowserLoaded(true)
    })
    return () => { cleanupOpen(); cleanupClose(); cleanupLoaded() }
  }, [])

  // Network offline tile shift seamlessly
  useEffect(() => {
    const cleanup = window.launcher.onNetworkStatus(({ isOnline: networkOnline }) => {
      setIsOnline(networkOnline)
      if (!networkOnline) {
        window.launcher.closeBrowser()
        setView('home')
        setBrowserUrl('')
      }
    })
    return cleanup
  }, [])

  // Show ConfusionOverlay when BrowserView inactivity timer fires
  useEffect(() => {
    const cleanup = window.launcher.onInactivityTimeout(() => {
      setShowConfusion(true)
    })
    return cleanup
  }, [])

  // Daily Check-in auto-scheduler
  useEffect(() => {
    const checkSchedule = () => {
      const today = new Date().toDateString()
      const now = new Date()
      // Ask once a day between 8 AM and 11 AM
      if (localStorage.getItem('lastCheckinDate') !== today && now.getHours() >= 8 && now.getHours() <= 11) {
        setShowCheckin(true)
        localStorage.setItem('lastCheckinDate', today)
      }
    }
    checkSchedule()
    const id = setInterval(checkSchedule, 30 * 60 * 1000) // check every 30 mins
    return () => clearInterval(id)
  }, [])

  // Inactivity detection
  const resetInactivity = useCallback(() => {
    if (!config) return
    const minutes = config.confusion?.inactivityMinutes ?? 10
    const enabled = config.confusion?.inactivityEnabled ?? true
    if (!enabled) return

    clearTimeout(inactivityTimer.current)
    inactivityTimer.current = setTimeout(() => {
      window.launcher.logActivity('inactivity-timeout')
      goHome()
    }, minutes * 60 * 1000)
  }, [config])

  useEffect(() => {
    resetInactivity()
  }, [resetInactivity])

  // Rapid-tap detection
  const trackTap = useCallback(() => {
    if (!config?.confusion?.rapidTapEnabled) return
    const now = Date.now()
    const windowMs = config.confusion?.rapidTapWindowMs ?? 3000
    const threshold = config.confusion?.rapidTapCount ?? 15

    tapTimes.current = tapTimes.current.filter(t => now - t < windowMs)
    tapTimes.current.push(now)

    if (tapTimes.current.length >= threshold) {
      tapTimes.current = []
      window.launcher.logActivity('rapid-tap')
      setShowConfusion(true)
    }
  }, [config])

  async function answerCall() {
    if (!incomingCall || peerRef.current) return  // peerRef guard prevents double-answer
    const { from, callerName, offer } = incomingCall

    // Spread to copy — never mutate config state directly
    const iceServers = [...(config?.messenger?.webrtc?.iceServers ??
      [{ urls: 'stun:stun.l.google.com:19302' }])]
    const { turnUrl, turnUsername, turnCredential } = config?.messenger?.webrtc ?? {}
    if (turnUrl) iceServers.push({ urls: turnUrl, username: turnUsername, credential: turnCredential })

    const pc = new RTCPeerConnection({ iceServers })
    peerRef.current = pc

    let localStream
    try {
      localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true })
    } catch (videoErr) {
      console.error('[call] video+audio failed:', videoErr.name, videoErr.message)
      try {
        localStream = await navigator.mediaDevices.getUserMedia({ video: false, audio: true })
      } catch (audioErr) {
        console.error('[call] audio-only failed:', audioErr.name, audioErr.message)
        window.launcher.declineCall(from)
        window.launcher.logActivity('call-failed-no-media', `${audioErr.name}: ${audioErr.message}`)
        setIncomingCall(null)
        peerRef.current = null
        pc.close()
        return
      }
    }
    localStreamRef.current = localStream
    localStream.getTracks().forEach(track => pc.addTrack(track, localStream))

    const remoteStream = new MediaStream()
    pc.ontrack = (e) => { remoteStream.addTrack(e.track) }

    pc.onicecandidate = (e) => {
      if (e.candidate) window.launcher.sendIceCandidate(from, e.candidate.toJSON())
    }

    // Auto-hangup on connection failure or unexpected disconnect
    pc.onconnectionstatechange = () => {
      console.log('[call] connection state:', pc.connectionState)
      if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
        window.launcher.logActivity('call-connection-lost', pc.connectionState)
        hangUp()
      }
    }

    try {
      // Basic SDP validation before trusting remote data
      if (!offer || typeof offer.sdp !== 'string' || offer.sdp.length > 65536) {
        throw new Error('Invalid SDP offer')
      }
      await pc.setRemoteDescription(new RTCSessionDescription(offer))
    } catch (err) {
      window.launcher.logActivity('call-sdp-invalid', err.message)
      window.launcher.declineCall(from)  // notify caller so they don't ring forever
      setIncomingCall(null)
      localStream.getTracks().forEach(t => t.stop())
      localStreamRef.current = null
      pc.close()
      peerRef.current = null
      return
    }

    // Flush queued ICE candidates AFTER setRemoteDescription — Chromium requires this order
    while (iceCandidateQueue.current.length > 0) {
      const queued = iceCandidateQueue.current.shift()
      pc.addIceCandidate(new RTCIceCandidate(queued)).catch(() => {})
    }

    const answer = await pc.createAnswer()
    await pc.setLocalDescription(answer)
    window.launcher.sendAnswer(from, answer)
    window.launcher.logActivity('call-answered', callerName)

    setIncomingCall(null)
    const callData = { caller: { callerName, from, relation: incomingCall.relation }, localStream, remoteStream }
    activeCallRef.current = callData
    setActiveCall(callData)
  }

  function hangUp() {
    // Stop tracks first to release camera LED immediately
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(t => t.stop())
      localStreamRef.current = null
    }
    // Then close peer connection
    if (peerRef.current) {
      peerRef.current.close()
      peerRef.current = null
    }
    iceCandidateQueue.current = []

    // Use ref (not state) so this is always fresh even in stale IPC closures,
    // and to keep the side effect out of the React state updater
    const currentCall = activeCallRef.current
    activeCallRef.current = null
    if (currentCall) window.launcher.endCall(currentCall.caller.from)
    setActiveCall(null)
    window.launcher.logActivity('call-ended')
  }

  function goHome() {
    window.launcher.closeBrowser() // no-op in main process if no browser is open
    setView('home')
    setShowHelp(false)
    setShowConfusion(false)
  }

  function handleTileOpen(tile) {
    resetInactivity()
    if (tile.type === 'web') {
      // Use a persistent session so Jean stays logged in to Google, YouTube, etc.
      window.launcher.openUrl(tile.target, tile.kiosk, 'persist:launcher')
      if (!tile.kiosk) setView('browser')
    } else if (tile.type === 'app') {
      window.launcher.launchApp(tile.target)
    } else if (tile.type === 'built-in') {
      if (tile.target === 'messages') {
        setView('messages')
        setMissedCalls(0)
        return
      }
      if (tile.target === 'music') {
        setView('music')
        return
      }
      if (tile.target === 'games') {
        setView('games')
        return
      }
      if (tile.target === 'photos') {
        setView('photos')
        return
      }
      if (tile.target === 'weather') setShowWeather(true)
      if (tile.target === 'ai-helper') { setShowAIBuddy(true); return }
    }
    window.launcher.logActivity('tile-open', tile.target)
  }

  function handleHelpPress() {
    window.launcher.helpPressed()
    // Close the embedded browser first so the NavBar doesn't go grey underneath the overlay
    if (view === 'browser') {
      window.launcher.closeBrowser()
      setView('home')
    }
    setShowHelp(true)
  }

  // Single-item shorthand used by most components (first location in list)
  const weather = weatherList[0] ?? null

  // Night mode derived from weather sunset
  const [isNight, setIsNight] = useState(false)
  useEffect(() => {
    if (!weather?.sunset) return
    const checkSunset = () => {
      setIsNight(Date.now() > new Date(weather.sunset).getTime())
    }
    checkSunset()
    const id = setInterval(checkSunset, 60000)
    return () => clearInterval(id)
  }, [weather])

  const fontClass = `font-${config?.display?.fontScale ?? 'medium'}`
  const themeClass = isNight ? 'theme-night' : 'theme-day'

  if (!config) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
        <span style={{ fontSize: 28, color: 'var(--text-secondary)' }}>Loading…</span>
      </div>
    )
  }

  const effectiveConfig = {
    ...config,
    tiles: isOnline ? config.tiles : config.tiles.filter(t => t.type !== 'web')
  }

  return (
    <div
      className={`${fontClass} ${themeClass}`}
      style={{ width: '100%', height: '100%', position: 'relative' }}
      onClick={trackTap}
      onMouseMove={resetInactivity}
    >
      {view === 'home' && (
        <HomeView
          config={effectiveConfig}
          weather={weather}
          onTileOpen={handleTileOpen}
          onHelpPress={handleHelpPress}
          badges={{ messages: missedCalls }}
        />
      )}

      {view === 'messages' && (
        <MessagesView
          contacts={config.contacts ?? []}
          messengerBase={config.messenger?.url}
          onBack={goHome}
          onHelp={handleHelpPress}
        />
      )}

      {view === 'messenger' && (
        <MessengerView
          messengerUrl={config.messenger?.url}
          onBack={goHome}
          onHelp={handleHelpPress}
        />
      )}

      {view === 'music' && (
        <AudioPlayer
          onBack={goHome}
          onHelp={handleHelpPress}
        />
      )}

      {view === 'games' && (
        <GamesView
          gamesConfig={config.games}
          onBack={goHome}
          onHelp={handleHelpPress}
        />
      )}

      {view === 'photos' && (
        <PhotosView
          photosConfig={config.photos}
          onBack={goHome}
          onHelp={handleHelpPress}
        />
      )}

      {view === 'browser' && (
        <>
          <NavBar
            url={browserUrl}
            weather={weather}
            onHome={goHome}
            onBack={() => window.launcher.browserBack()}
            onHelp={handleHelpPress}
          />
          {!browserLoaded && (
            <div style={{
              position: 'absolute', left: 300, right: 0, top: 0, bottom: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'var(--bg-main)', zIndex: 10, pointerEvents: 'none'
            }}>
              <span style={{ fontSize: '1.3em', color: 'var(--text-secondary)' }}>Loading…</span>
            </div>
          )}
        </>
      )}

      {showHelp && (
        <HelpOverlay
          caregiverName={config.help?.caregiverName ?? 'Family'}
          onGoHome={() => { goHome(); setShowHelp(false) }}
          onDismiss={() => setShowHelp(false)}
          onCallCaregiver={() => {
            window.launcher.sendHelpNotification()
            setShowHelp(false)
          }}
        />
      )}

      {showConfusion && (
        <ConfusionOverlay
          onGoHome={() => { goHome(); setShowConfusion(false) }}
          onDismiss={() => setShowConfusion(false)}
        />
      )}

      {showWeather && (
        <WeatherOverlay
          weathers={weatherList}
          onClose={() => setShowWeather(false)}
        />
      )}

      {showCheckin && (
        <DailyCheckin
          onComplete={() => setShowCheckin(false)}
        />
      )}

      {/* AI Buddy - persistent floating button + chat panel */}
      {!showAIBuddy && (
        <BuddyFloat
          onClick={() => setShowAIBuddy(true)}
          hasUnread={false}
        />
      )}

      {showAIBuddy && (
        <AIBuddy
          onClose={() => setShowAIBuddy(false)}
          onTileOpen={(target) => {
            setShowAIBuddy(false)
            // Small delay so chat closes first
            setTimeout(() => {
              const tile = (config?.tiles || []).find(t => t.target === target || t.label?.toLowerCase() === target?.toLowerCase())
              if (tile) handleTileOpen(tile)
            }, 200)
          }}
          tiles={config?.tiles || []}
        />
      )}

      {incomingCall && (
        <IncomingCallOverlay
          caller={incomingCall}
          onAnswer={answerCall}
          onDecline={() => {
            window.launcher.declineCall(incomingCall.from)
            window.launcher.logActivity('call-declined', incomingCall.callerName)
            iceCandidateQueue.current = []
            setIncomingCall(null)
          }}
        />
      )}

      {activeCall && (
        <VideoCallOverlay
          caller={activeCall.caller}
          localStream={activeCall.localStream}
          remoteStream={activeCall.remoteStream}
          onEndCall={hangUp}
        />
      )}
    </div>
  )
}
