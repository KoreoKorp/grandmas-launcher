import React, { useState, useEffect, useRef } from 'react'

export default function AudioPlayer({ onBack, onHelp }) {
  const [tracks, setTracks] = useState([])
  const [currentTrackIndex, setCurrentTrackIndex] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [error, setError] = useState('')
  const audioRef = useRef(null)

  useEffect(() => {
    // get-music resolves the desktop Media/Music folder using ipcMain
    window.launcher.getMusic().then(data => {
      setTracks(data || [])
    }).catch(err => {
      console.error('Failed to load music', err)
      setError('Could not load your music.')
    })
  }, [])

  useEffect(() => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.play().catch(e => {
          console.error(e)
          setIsPlaying(false)
        })
      } else {
        audioRef.current.pause()
      }
    }
  }, [isPlaying, currentTrackIndex])

  function togglePlay() {
    setIsPlaying(!isPlaying)
  }

  function nextTrack() {
    setCurrentTrackIndex(prev => (prev + 1) % tracks.length)
    setIsPlaying(true)
  }

  function prevTrack() {
    setCurrentTrackIndex(prev => prev === 0 ? tracks.length - 1 : prev - 1)
    setIsPlaying(true)
  }

  const currentTrack = tracks[currentTrackIndex]

  return (
    <div style={styles.root}>
      <div style={styles.header}>
        <button style={styles.backBtn} onClick={onBack}>← Back</button>
        <div style={styles.title}>Music Player</div>
        <button style={styles.helpBtn} onClick={onHelp}>💙 Help</button>
      </div>
      <div style={styles.body}>
        {error ? (
          <div style={styles.empty}>{error}</div>
        ) : tracks.length === 0 ? (
          <div style={styles.empty}>No music found. Ask your family to add music files (.mp3) to your Music folder.</div>
        ) : (
          <div style={styles.playerCard}>
            <div style={styles.disc}>🎵</div>
            <div style={styles.trackName}>{currentTrack.name}</div>
            
            <audio 
              ref={audioRef} 
              src={currentTrack.path} 
              onEnded={nextTrack}
            />

            <div style={styles.controls}>
              <button style={styles.controlBtn} onClick={prevTrack}>⏮️ Previous</button>
              <button style={styles.playBtn} onClick={togglePlay}>
                {isPlaying ? '⏸️ Pause' : '▶️ Play'}
              </button>
              <button style={styles.controlBtn} onClick={nextTrack}>Next ⏭️</button>
            </div>

            <div style={styles.trackList}>
               {tracks.map((track, i) => (
                 <button 
                   key={i} 
                   style={{
                     ...styles.trackListItem, 
                     background: i === currentTrackIndex ? 'var(--accent)' : 'var(--bg-card)',
                     color: i === currentTrackIndex ? '#fff' : 'var(--text-primary)'
                   }}
                   onClick={() => {
                     setCurrentTrackIndex(i)
                     setIsPlaying(true)
                   }}
                 >
                   {track.name}
                 </button>
               ))}
            </div>
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
  title: { fontFamily: 'var(--font-display)', fontSize: 'calc(1.4em * var(--font-scale, 1))', fontWeight: 700, color: 'var(--accent)', textAlign: 'center', flex: 1 },
  helpBtn: { padding: '12px 20px', background: 'var(--help-bg)', border: '1.5px solid var(--help-border)', borderRadius: 'var(--radius-sm)', color: '#fff', fontSize: 'calc(1em * var(--font-scale, 1))', fontWeight: 600, cursor: 'pointer', flexShrink: 0 },
  body: { flex: 1, overflowY: 'auto', padding: 32, display: 'flex', justifyContent: 'center' },
  empty: { textAlign: 'center', color: 'var(--text-secondary)', fontSize: 'calc(1.2em * var(--font-scale, 1))', padding: 48, maxWidth: 600 },
  playerCard: { background: 'var(--bg-card)', border: '2px solid var(--border)', borderRadius: 'var(--radius)', padding: 40, display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', maxWidth: 700, gap: 24, boxShadow: '0 8px 32px rgba(0,0,0,0.1)' },
  disc: { fontSize: 80, background: 'var(--bg-main)', width: 140, height: 140, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '4px solid var(--border)' },
  trackName: { fontSize: 'calc(1.5em * var(--font-scale, 1))', fontWeight: 700, color: 'var(--text-primary)', textAlign: 'center' },
  controls: { display: 'flex', gap: 20, alignItems: 'center', marginTop: 12 },
  controlBtn: { background: 'var(--bg-main)', padding: '16px 24px', borderRadius: 40, border: '2px solid var(--border)', fontSize: 'calc(1.1em * var(--font-scale, 1))', fontWeight: 600, color: 'var(--text-primary)', cursor: 'pointer' },
  playBtn: { background: 'var(--accent)', padding: '20px 48px', borderRadius: 60, border: 'none', fontSize: 'calc(1.3em * var(--font-scale, 1))', fontWeight: 700, color: '#fff', cursor: 'pointer', boxShadow: '0 4px 16px rgba(0,0,0,0.2)' },
  trackList: { display: 'flex', flexDirection: 'column', gap: 8, width: '100%', marginTop: 24, maxHeight: 200, overflowY: 'auto', padding: 8, background: 'var(--bg-main)', borderRadius: 12, border: '1px solid var(--border)' },
  trackListItem: { padding: '16px 20px', borderRadius: 8, border: 'none', fontSize: 'calc(1.1em * var(--font-scale, 1))', fontWeight: 600, cursor: 'pointer', textAlign: 'left', transition: 'background 0.1s' }
}
