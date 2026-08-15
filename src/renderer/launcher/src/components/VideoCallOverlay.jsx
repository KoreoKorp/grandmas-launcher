import React, { useEffect, useRef, useState } from 'react'

const CONNECTING_HINT_MS = 12_000  // reassure her it's not frozen
const CONNECTING_TIMEOUT_MS = 30_000 // give up rather than leave her stuck forever

export default function VideoCallOverlay({ caller, localStream, remoteStream, onEndCall }) {
  const remoteVideoRef = useRef(null)
  const localVideoRef = useRef(null)
  const [connected, setConnected] = useState(false)
  const [slowHint, setSlowHint] = useState(false)

  useEffect(() => {
    const video = remoteVideoRef.current
    if (!video || !remoteStream) return
    video.srcObject = remoteStream
    // Use video element's canplay event — more reliable than MediaStream.active
    // which is non-standard and has inconsistent Chromium support
    const onCanPlay = () => setConnected(true)
    video.addEventListener('canplay', onCanPlay)
    if (video.readyState >= 3) setConnected(true)  // HAVE_FUTURE_DATA — already ready
    return () => video.removeEventListener('canplay', onCanPlay)
  }, [remoteStream])

  // App.jsx's pc.onconnectionstatechange already ends the call when WebRTC
  // reports 'failed'/'disconnected' — but NAT traversal can also just stall
  // in 'connecting'/'new' forever without ever reaching an explicit failure
  // state. Without a local timeout, she'd be left staring at "Connecting…"
  // indefinitely with only the End Call button as an escape. This gives a
  // reassuring hint first, then ends the call automatically rather than
  // leaving her stuck on what looks like a frozen screen.
  useEffect(() => {
    if (connected) { setSlowHint(false); return }
    const hintTimer = setTimeout(() => setSlowHint(true), CONNECTING_HINT_MS)
    const giveUpTimer = setTimeout(() => onEndCall(), CONNECTING_TIMEOUT_MS)
    return () => { clearTimeout(hintTimer); clearTimeout(giveUpTimer) }
  }, [connected, onEndCall])

  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream
    }
  }, [localStream])

  return (
    <div style={styles.backdrop}>
      {/* Remote stream — fullscreen */}
      <video ref={remoteVideoRef} autoPlay playsInline style={styles.remoteVideo} />

      {/* Connecting overlay — shown until remote stream is active */}
      {!connected && (
        <div style={styles.connecting}>
          Connecting…
          {slowHint && <div style={styles.connectingHint}>This is taking a little while — hang tight</div>}
        </div>
      )}

      {/* Local stream — PiP corner */}
      <video ref={localVideoRef} autoPlay playsInline muted style={styles.localPip} />

      {/* Caller name */}
      <div style={styles.callerLabel}>
        <div>{caller?.callerName || 'Family'}</div>
        {caller?.relation && <div style={{ fontSize: '0.6em', color: 'rgba(255,255,255,0.85)', marginTop: 4, fontWeight: 500 }}>This is your {caller.relation}</div>}
      </div>

      {/* End Call button */}
      <button style={styles.endBtn} onClick={onEndCall}>
        End Call
      </button>
    </div>
  )
}

const styles = {
  backdrop: { position: 'fixed', inset: 0, background: '#000', zIndex: 1050, display: 'flex', alignItems: 'center', justifyContent: 'center' },
  remoteVideo: { width: '100%', height: '100%', objectFit: 'cover', position: 'absolute', inset: 0 },
  connecting: { position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', color: '#fff', fontSize: 28, fontWeight: 600, zIndex: 11, textShadow: '0 2px 8px rgba(0,0,0,0.8)', textAlign: 'center' },
  connectingHint: { fontSize: '0.5em', fontWeight: 500, marginTop: 10, color: 'rgba(255,255,255,0.85)' },
  localPip: { position: 'absolute', bottom: 120, right: 24, width: 160, height: 120, objectFit: 'cover', borderRadius: 12, border: '2px solid rgba(255,255,255,0.4)', zIndex: 10 },
  callerLabel: { position: 'absolute', top: 32, left: '50%', transform: 'translateX(-50%)', color: '#fff', fontSize: 28, fontWeight: 700, textShadow: '0 2px 8px rgba(0,0,0,0.7)', zIndex: 10 },
  endBtn: { position: 'absolute', bottom: 40, left: '50%', transform: 'translateX(-50%)', background: '#d32f2f', color: '#fff', border: 'none', borderRadius: 48, padding: '24px 64px', fontSize: 28, fontWeight: 700, cursor: 'pointer', zIndex: 10, boxShadow: '0 4px 20px rgba(0,0,0,0.5)' }
}
