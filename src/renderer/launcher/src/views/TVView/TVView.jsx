import React, { useState, useEffect, useCallback, useRef } from 'react'
import './TVView.css'

const APPS = [
  { id: 'netflix', name: 'Netflix', icon: '🎬', color: '#E50914' },
  { id: 'youtube', name: 'YouTube', icon: '▶️', color: '#FF0000' },
  { id: 'disneyplus', name: 'Disney+', icon: '✨', color: '#113CCF' },
  { id: 'hulu', name: 'Hulu', icon: '📺', color: '#1CE783' },
]

const INPUTS = [
  { id: 'hdmi1', name: 'HDMI 1', icon: '🔌' },
  { id: 'hdmi2', name: 'HDMI 2', icon: '🔌' },
  { id: 'hdmi3', name: 'HDMI 3', icon: '🔌' },
  { id: 'tuner', name: 'TV', icon: '📡' },
]

export default function TVView({ onBack, onHelp }) {
  const [tvStatus, setTvStatus] = useState({ paired: false, ip: null, name: 'TV' })
  const [powerOn, setPowerOn] = useState(null)
  const [currentInput, setCurrentInput] = useState('TV')
  const [volumeLevel, setVolumeLevel] = useState(50)
  const [showApps, setShowApps] = useState(false)
  const [showInputs, setShowInputs] = useState(false)
  const [feedback, setFeedback] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const feedbackTimer = useRef(null)

  useEffect(() => {
    window.launcher.tvGetStatus().then(setTvStatus)
    checkPowerState()
  }, [])

  const checkPowerState = async () => {
    try {
      const { power } = await window.launcher.tvGetPower()
      setPowerOn(power)
      if (power) {
        const { input } = await window.launcher.tvGetInput()
        setCurrentInput(input || 'TV')
      }
    } catch {
      setPowerOn(false)
    }
  }

  const showFeedback = useCallback((msg) => {
    setFeedback(msg)
    clearTimeout(feedbackTimer.current)
    feedbackTimer.current = setTimeout(() => setFeedback(''), 2000)
  }, [])

  const withFeedback = useCallback(async (action, successMsg) => {
    setIsLoading(true)
    try {
      await action()
      showFeedback(successMsg)
      setTimeout(checkPowerState, 500)
    } catch (err) {
      showFeedback('Try again in a moment')
    }
    setIsLoading(false)
  }, [showFeedback])

  const handlePowerToggle = () => {
    if (powerOn) {
      withFeedback(() => window.launcher.tvPowerOff(), 'TV turning off...')
      setPowerOn(false)
    } else {
      withFeedback(() => window.launcher.tvPowerOn(), 'TV turning on...')
      setPowerOn(true)
    }
  }

  const handleVolumeUp = () => {
    setVolumeLevel(v => Math.min(100, v + 10))
    withFeedback(() => window.launcher.tvVolumeUp(), 'Volume up')
  }

  const handleVolumeDown = () => {
    setVolumeLevel(v => Math.max(0, v - 10))
    withFeedback(() => window.launcher.tvVolumeDown(), 'Volume down')
  }

  const handleMute = () => {
    withFeedback(() => window.launcher.tvMute(), 'Mute toggled')
  }

  const handleChannelUp = () => {
    withFeedback(() => window.launcher.tvChannelUp(), 'Channel up')
  }

  const handleChannelDown = () => {
    withFeedback(() => window.launcher.tvChannelDown(), 'Channel down')
  }

  const handleInput = (input) => {
    withFeedback(() => window.launcher.tvSetInput(input.id), `Switched to ${input.name}`)
    setShowInputs(false)
    setCurrentInput(input.name)
  }

  const handleApp = (app) => {
    withFeedback(() => window.launcher.tvLaunchApp(app.id), `Opening ${app.name}...`)
    setShowApps(false)
  }

  const fontScale = 'large'

  return (
    <div className={`tv-view ${fontScale}`} onClick={() => { setShowApps(false); setShowInputs(false) }}>
      <div className="tv-header">
        <button className="tv-back-btn" onClick={(e) => { e.stopPropagation(); onBack() }}>
          ← Back
        </button>
        <div className="tv-title">
          <span className="tv-title-icon">📺</span>
          <span>TV Remote</span>
        </div>
        <div className={`tv-status-dot ${tvStatus.paired ? 'online' : 'offline'}`}
             title={tvStatus.paired ? `Connected to ${tvStatus.ip}` : 'Not paired'} />
      </div>

      {feedback && <div className="tv-feedback">{feedback}</div>}

      <div className="tv-body">
        {tvStatus.paired ? (
          <>
            <div className="tv-row tv-top-row">
              <button
                className={`tv-btn tv-power ${powerOn ? 'on' : 'off'}`}
                onClick={(e) => { e.stopPropagation(); handlePowerToggle() }}
                disabled={isLoading}
              >
                <span className="tv-btn-icon">⏻</span>
                <span className="tv-btn-label">{powerOn ? 'Turn Off' : 'Turn On'}</span>
              </button>

              <button
                className="tv-btn tv-input-btn"
                onClick={(e) => { e.stopPropagation(); setShowInputs(!showInputs); setShowApps(false) }}
              >
                <span className="tv-btn-icon">{INPUTS.find(i => i.name === currentInput)?.icon || '📡'}</span>
                <span className="tv-btn-label">{currentInput}</span>
              </button>

              <button
                className="tv-btn tv-apps-btn"
                onClick={(e) => { e.stopPropagation(); setShowApps(!showApps); setShowInputs(false) }}
              >
                <span className="tv-btn-icon">🎬</span>
                <span className="tv-btn-label">Apps</span>
              </button>
            </div>

            <div className="tv-row tv-volume-row">
              <button
                className="tv-btn tv-volume-down"
                onClick={(e) => { e.stopPropagation(); handleVolumeDown() }}
                disabled={isLoading}
              >
                <span className="tv-btn-icon">🔉</span>
                <span className="tv-btn-label">Vol Down</span>
              </button>

              <button
                className="tv-btn tv-mute"
                onClick={(e) => { e.stopPropagation(); handleMute() }}
                disabled={isLoading}
              >
                <span className="tv-btn-icon">🔇</span>
                <span className="tv-btn-label">Mute</span>
              </button>

              <button
                className="tv-btn tv-volume-up"
                onClick={(e) => { e.stopPropagation(); handleVolumeUp() }}
                disabled={isLoading}
              >
                <span className="tv-btn-icon">🔊</span>
                <span className="tv-btn-label">Vol Up</span>
              </button>
            </div>

            <div className="tv-row tv-channel-row">
              <button
                className="tv-btn tv-channel-down"
                onClick={(e) => { e.stopPropagation(); handleChannelDown() }}
                disabled={isLoading}
              >
                <span className="tv-btn-icon">⬇️</span>
                <span className="tv-btn-label">Channel Down</span>
              </button>

              <div className="tv-channel-label">Channel</div>

              <button
                className="tv-btn tv-channel-up"
                onClick={(e) => { e.stopPropagation(); handleChannelUp() }}
                disabled={isLoading}
              >
                <span className="tv-btn-icon">⬆️</span>
                <span className="tv-btn-label">Channel Up</span>
              </button>
            </div>

            {showApps && (
              <div className="tv-apps-panel" onClick={e => e.stopPropagation()}>
                <div className="tv-panel-title">Open App</div>
                <div className="tv-apps-grid">
                  {APPS.map(app => (
                    <button
                      key={app.id}
                      className="tv-btn tv-app-btn"
                      style={{ '--app-color': app.color }}
                      onClick={(e) => { e.stopPropagation(); handleApp(app) }}
                      disabled={isLoading}
                    >
                      <span className="tv-btn-icon">{app.icon}</span>
                      <span className="tv-btn-label">{app.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {showInputs && (
              <div className="tv-inputs-panel" onClick={e => e.stopPropagation()}>
                <div className="tv-panel-title">Select Input</div>
                <div className="tv-inputs-grid">
                  {INPUTS.map(input => (
                    <button
                      key={input.id}
                      className={`tv-btn tv-input-option ${currentInput === input.name ? 'active' : ''}`}
                      onClick={(e) => { e.stopPropagation(); handleInput(input) }}
                      disabled={isLoading}
                    >
                      <span className="tv-btn-icon">{input.icon}</span>
                      <span className="tv-btn-label">{input.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="tv-not-paired">
            <div className="tv-not-paired-icon">📺</div>
            <div className="tv-not-paired-text">TV not connected yet</div>
            <div className="tv-not-paired-sub">Ask your family to set up the TV remote</div>
          </div>
        )}
      </div>
    </div>
  )
}
