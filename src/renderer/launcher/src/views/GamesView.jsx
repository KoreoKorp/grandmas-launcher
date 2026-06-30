import React, { useState, useEffect, useRef } from 'react'

export default function GamesView({ gamesConfig, onBack, onHelp }) {
  const [tab, setTab] = useState('online')
  const [localGames, setLocalGames] = useState([])
  const [browserLoaded, setBrowserLoaded] = useState(false)
  const webviewRef = useRef(null)

  const onlineUrl = gamesConfig?.onlineUrl || 'https://www.pogo.com'

  useEffect(() => {
    window.launcher.getLocalGames().then(setLocalGames)
  }, [])

  // Electron webview fires custom DOM events — React JSX props can't wire them up
  useEffect(() => {
    const wv = webviewRef.current
    if (!wv) return
    const onLoad = () => setBrowserLoaded(true)
    wv.addEventListener('did-finish-load', onLoad)
    return () => wv.removeEventListener('did-finish-load', onLoad)
  }, [])

  function launchLocalGame(game) {
    window.launcher.launchApp(game.path)
    window.launcher.logActivity('local-game-launch', game.name)
  }

  return (
    <div style={S.wrap} className="view-slide-up">
      {/* Header bar */}
      <div style={S.header}>
        <button style={S.backBtn} onClick={onBack}>← Back</button>
        <div style={S.tabs}>
          <button
            style={{ ...S.tab, ...(tab === 'online' ? S.tabActive : {}) }}
            onClick={() => setTab('online')}
          >
            🌐 Online Games
          </button>
          <button
            style={{ ...S.tab, ...(tab === 'local' ? S.tabActive : {}) }}
            onClick={() => setTab('local')}
          >
            💾 My Games
          </button>
        </div>
        <button style={S.helpBtn} onClick={onHelp}>💙 Help</button>
      </div>

      {/* Content */}
      <div style={S.content}>
        {tab === 'online' && (
          <div style={S.webviewWrap}>
            {!browserLoaded && (
              <div style={S.loading}>
                <span style={S.loadingText}>Loading games…</span>
              </div>
            )}
            <webview
              ref={webviewRef}
              src={onlineUrl}
              style={{ ...S.webview, display: browserLoaded ? 'flex' : 'none' }}
              partition="persist:games"
              allowpopups="true"
            />
          </div>
        )}

        {tab === 'local' && (
          <div style={S.localWrap}>
            {localGames.length === 0 ? (
              <div style={S.emptyState}>
                <div style={S.emptyIcon}>🎮</div>
                <div style={S.emptyTitle}>No local games yet</div>
                <div style={S.emptyText}>
                  Ask a family member to add games in the admin panel.
                </div>
              </div>
            ) : (
              <div style={S.gameGrid}>
                {localGames.map((game, i) => (
                  <button
                    key={i}
                    style={S.gameCard}
                    className="tile-btn"
                    onClick={() => launchLocalGame(game)}
                  >
                    <span style={S.gameIcon}>{game.icon || '🎮'}</span>
                    <span style={S.gameName}>{game.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

const S = {
  wrap: {
    display: 'flex',
    flexDirection: 'column',
    width: '100%',
    height: '100%',
    background: 'var(--bg-main)'
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '14px 20px',
    background: 'linear-gradient(180deg, var(--bg-card) 0%, transparent 100%)',
    borderBottom: '1px solid var(--border-subtle)',
    flexShrink: 0
  },
  backBtn: {
    padding: '10px 18px',
    background: 'var(--bg-card)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-sm)',
    color: 'var(--text-primary)',
    fontWeight: 700,
    fontSize: '1em',
    cursor: 'pointer',
    transition: 'background var(--transition-fast), transform var(--transition-bounce)',
    flexShrink: 0
  },
  tabs: {
    display: 'flex',
    gap: 8,
    flex: 1,
    justifyContent: 'center'
  },
  tab: {
    padding: '10px 24px',
    background: 'var(--bg-card)',
    border: '1.5px solid var(--border)',
    borderRadius: 'var(--radius-sm)',
    color: 'var(--text-secondary)',
    fontWeight: 600,
    fontSize: '1em',
    cursor: 'pointer',
    transition: 'all var(--transition-smooth)'
  },
  tabActive: {
    background: 'var(--accent-dim)',
    borderColor: 'var(--accent)',
    color: 'var(--accent)',
    boxShadow: '0 0 12px rgba(235,181,82,0.15)'
  },
  helpBtn: {
    padding: '10px 18px',
    background: 'var(--help-bg)',
    border: '1px solid var(--help-border)',
    borderRadius: 'var(--radius-sm)',
    color: '#fff',
    fontWeight: 700,
    fontSize: '1em',
    cursor: 'pointer',
    flexShrink: 0
  },
  content: {
    flex: 1,
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column'
  },
  webviewWrap: {
    flex: 1,
    position: 'relative'
  },
  webview: {
    width: '100%',
    height: '100%'
  },
  loading: {
    position: 'absolute',
    inset: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'var(--bg-main)'
  },
  loadingText: {
    fontSize: '1.3em',
    color: 'var(--text-secondary)'
  },
  localWrap: {
    flex: 1,
    overflowY: 'auto',
    padding: 28
  },
  emptyState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    gap: 16,
    opacity: 0.7
  },
  emptyIcon: { fontSize: '4em' },
  emptyTitle: {
    fontSize: '1.4em',
    fontWeight: 700,
    color: 'var(--text-primary)'
  },
  emptyText: {
    fontSize: '1em',
    color: 'var(--text-secondary)',
    textAlign: 'center',
    maxWidth: 320,
    lineHeight: 1.5
  },
  gameGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
    gap: 20
  },
  gameCard: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    minHeight: 150,
    padding: '20px 16px',
    cursor: 'pointer'
  },
  gameIcon: {
    fontSize: '2.8em',
    lineHeight: 1,
    filter: 'drop-shadow(0 2px 8px rgba(0,0,0,0.3))'
  },
  gameName: {
    fontSize: '1em',
    fontWeight: 700,
    textAlign: 'center',
    color: 'var(--text-primary)',
    lineHeight: 1.2
  }
}
