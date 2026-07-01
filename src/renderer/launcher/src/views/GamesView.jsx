import React, { useState, useEffect, useRef } from 'react'

export default function GamesView({ gamesConfig, onBack, onHelp }) {
  const [tab, setTab] = useState('local')
  const [localGames, setLocalGames] = useState([])
  const [icons, setIcons] = useState({})   // path → dataURL
  const [browserLoaded, setBrowserLoaded] = useState(false)
  const webviewRef = useRef(null)

  const onlineUrl = gamesConfig?.onlineUrl || 'https://www.pogo.com'

  useEffect(() => {
    window.launcher.getLocalGames().then(games => {
      setLocalGames(games)
      // Load all .exe icons in parallel
      Promise.all(
        games.map(g =>
          window.launcher.getGameIcon(g.path).then(url => [g.path, url])
        )
      ).then(pairs => {
        const map = {}
        pairs.forEach(([path, url]) => { if (url) map[path] = url })
        setIcons(map)
      })
    })
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
                  <GameCard
                    key={i}
                    game={game}
                    iconUrl={icons[game.path]}
                    onClick={() => launchLocalGame(game)}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function GameCard({ game, iconUrl, onClick }) {
  const [pressed, setPressed] = useState(false)
  const [launched, setLaunched] = useState(false)

  function handleClick() {
    setLaunched(true)
    setTimeout(() => setLaunched(false), 2500)
    onClick()
  }

  return (
    <button
      style={{
        ...S.gameCard,
        transform: pressed ? 'scale(0.92)' : 'scale(1)',
        transition: 'transform 0.18s cubic-bezier(0.34,1.56,0.64,1), box-shadow 0.15s',
        ...(launched ? { boxShadow: '0 0 0 3px rgba(235,181,82,0.5), var(--shadow-glow)' } : {})
      }}
      onClick={handleClick}
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => setPressed(false)}
      onMouseLeave={() => setPressed(false)}
      onTouchStart={() => setPressed(true)}
      onTouchEnd={() => setPressed(false)}
    >
      <div style={S.iconWrap}>
        {iconUrl ? (
          <img src={iconUrl} alt={game.name} style={S.iconImg} draggable={false} />
        ) : (
          <span style={S.iconEmoji}>{game.icon || '🎮'}</span>
        )}
        {launched && <div style={S.launchRing} />}
      </div>
      <span style={S.gameName}>{game.name}</span>
    </button>
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
    gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
    gap: 20
  },
  gameCard: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 0,
    padding: 0,
    cursor: 'pointer',
    background: 'var(--bg-card)',
    border: '1.5px solid var(--border)',
    borderRadius: 'var(--radius)',
    overflow: 'hidden',
    boxShadow: 'var(--shadow-md)'
  },
  iconWrap: {
    position: 'relative',
    width: '100%',
    aspectRatio: '1 / 1',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'linear-gradient(145deg, #2a4a42, #1c3830)',
    overflow: 'hidden'
  },
  iconImg: {
    width: '72%',
    height: '72%',
    objectFit: 'contain',
    imageRendering: 'auto',
    filter: 'drop-shadow(0 4px 12px rgba(0,0,0,0.5))'
  },
  iconEmoji: {
    fontSize: 56,
    lineHeight: 1,
    filter: 'drop-shadow(0 4px 12px rgba(0,0,0,0.4))'
  },
  launchRing: {
    position: 'absolute',
    inset: 0,
    borderRadius: 'inherit',
    border: '3px solid var(--accent)',
    animation: 'pulse-glow 0.6s ease-out forwards',
    pointerEvents: 'none'
  },
  gameName: {
    width: '100%',
    padding: '10px 12px',
    fontSize: 'calc(0.88em * var(--font-scale, 1))',
    fontWeight: 700,
    textAlign: 'center',
    color: 'var(--text-primary)',
    lineHeight: 1.25,
    background: 'var(--bg-card)',
    borderTop: '1px solid var(--border-subtle)'
  }
}
