import React, { useState, useEffect, useRef, useCallback } from 'react'
import HomeView from './views/HomeView'
import HelpOverlay from './components/HelpOverlay'
import ConfusionOverlay from './components/ConfusionOverlay'
import WeatherOverlay from './components/WeatherOverlay'
import NavBar from './components/NavBar'

export default function App() {
  const [config, setConfig] = useState(null)
  const [weather, setWeather] = useState(null)
  const [view, setView] = useState('home') // 'home' | 'browser' | 'messages' | 'messenger'
  const [browserUrl, setBrowserUrl] = useState('')
  const [showHelp, setShowHelp] = useState(false)
  const [showConfusion, setShowConfusion] = useState(false)
  const [showWeather, setShowWeather] = useState(false)

  const inactivityTimer = useRef(null)
  const tapTimes = useRef([])

  // Load config on mount
  useEffect(() => {
    window.launcher.getConfig().then(setConfig)
    window.launcher.getWeather().then(setWeather)
  }, [])

  // Re-fetch weather every 30 min
  useEffect(() => {
    const id = setInterval(() => {
      window.launcher.getWeather().then(setWeather)
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
    const cleanup = window.launcher.onWeatherUpdated(setWeather)
    return cleanup
  }, [])

  // Listen for go-home signal from main (e.g. Back pressed with no browser history)
  useEffect(() => {
    const cleanup = window.launcher.onGoHome(() => goHome())
    return cleanup
  }, [])

  // Listen for browser open/close signals from main process
  useEffect(() => {
    const cleanupOpen = window.launcher.onBrowserOpened(({ url }) => {
      setBrowserUrl(url)
      setView('browser')
    })
    const cleanupClose = window.launcher.onBrowserClosed(() => {
      setView('home')
      setBrowserUrl('')
    })
    return () => { cleanupOpen(); cleanupClose() }
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

  function goHome() {
    window.launcher.closeBrowser() // no-op in main process if no browser is open
    setView('home')
    setShowHelp(false)
    setShowConfusion(false)
  }

  function handleTileOpen(tile) {
    resetInactivity()
    if (tile.type === 'web') {
      window.launcher.openUrl(tile.target, tile.kiosk)
      if (!tile.kiosk) setView('browser')
    } else if (tile.type === 'app') {
      window.launcher.launchApp(tile.target)
    } else if (tile.type === 'built-in') {
      if (tile.target === 'messages') {
        const messengerUrl = config.messenger?.url || 'http://34.132.145.35:3000/jean.html'
        window.launcher.openUrl(messengerUrl, false)
        // view will be set to 'browser' by the onBrowserOpened listener
      }
      if (tile.target === 'weather') setShowWeather(true)
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

  const fontClass = `font-${config?.display?.fontScale ?? 'medium'}`

  if (!config) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
        <span style={{ fontSize: 28, color: 'var(--text-secondary)' }}>Loading…</span>
      </div>
    )
  }

  return (
    <div
      className={fontClass}
      style={{ width: '100%', height: '100%', position: 'relative' }}
      onClick={trackTap}
      onMouseMove={resetInactivity}
    >
      {view === 'home' && (
        <HomeView
          config={config}
          weather={weather}
          onTileOpen={handleTileOpen}
          onHelpPress={handleHelpPress}
        />
      )}

      {view === 'browser' && (
        <NavBar
          url={browserUrl}
          weather={weather}
          onHome={goHome}
          onBack={() => window.launcher.browserBack()}
          onHelp={handleHelpPress}
        />
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
          weather={weather}
          onClose={() => setShowWeather(false)}
        />
      )}
    </div>
  )
}
