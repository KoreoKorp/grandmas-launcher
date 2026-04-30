import React, { useState, useEffect } from 'react'

export default function PhotosView({ photosConfig, onBack, onHelp }) {
  const [localPhotos, setLocalPhotos] = useState([])
  const [loadError, setLoadError] = useState(false)
  const [albumLoaded, setAlbumLoaded] = useState(false)
  const [selectedPhoto, setSelectedPhoto] = useState(null)

  const albumUrl = photosConfig?.albumUrl || ''
  const hasAlbum = !!albumUrl

  useEffect(() => {
    window.launcher.getLocalPhotos().then(photos => {
      setLocalPhotos(photos)
    })
  }, [])

  // If album fails to load, fall through to local
  function handleAlbumError() {
    setLoadError(true)
  }

  const showLocal = !hasAlbum || loadError
  const hasLocalPhotos = localPhotos.length > 0

  return (
    <div style={S.wrap} className="view-slide-up">
      {/* Header */}
      <div style={S.header}>
        <button style={S.backBtn} onClick={onBack}>← Back</button>
        <h2 style={S.title}>📸 Photos</h2>
        <button style={S.helpBtn} onClick={onHelp}>💙 Help</button>
      </div>

      <div style={S.content}>
        {/* Google Photos album iframe (primary) */}
        {hasAlbum && !loadError && (
          <div style={S.iframeWrap}>
            {!albumLoaded && (
              <div style={S.loading}>
                <span style={S.loadingText}>Loading album…</span>
              </div>
            )}
            <iframe
              src={albumUrl}
              style={{ ...S.iframe, opacity: albumLoaded ? 1 : 0 }}
              onLoad={() => setAlbumLoaded(true)}
              onError={handleAlbumError}
              title="Photo Album"
              sandbox="allow-scripts allow-popups"
            />
          </div>
        )}

        {/* Local folder fallback gallery */}
        {showLocal && (
          <>
            {hasLocalPhotos ? (
              <div style={S.gallery}>
                {localPhotos.map((photo, i) => (
                  <button
                    key={i}
                    style={S.photoCard}
                    onClick={() => setSelectedPhoto(photo)}
                  >
                    <img
                      src={photo.url}
                      alt={photo.name}
                      style={S.thumb}
                      loading="lazy"
                    />
                  </button>
                ))}
              </div>
            ) : (
              <div style={S.emptyState}>
                <div style={S.emptyIcon}>🖼️</div>
                <div style={S.emptyTitle}>No photos available</div>
                <div style={S.emptyText}>
                  Ask a family member to set up a photo album or local folder in the admin panel.
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Lightbox */}
      {selectedPhoto && (
        <div style={S.lightbox} onClick={() => setSelectedPhoto(null)}>
          <img
            src={selectedPhoto.url}
            alt={selectedPhoto.name}
            style={S.lightboxImg}
            onClick={e => e.stopPropagation()}
          />
          <button style={S.closeBtn} onClick={() => setSelectedPhoto(null)}>✕</button>
        </div>
      )}
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
    flexShrink: 0
  },
  title: {
    flex: 1,
    textAlign: 'center',
    fontSize: '1.3em',
    fontWeight: 800,
    color: 'var(--text-primary)'
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
    flexDirection: 'column',
    position: 'relative'
  },
  iframeWrap: {
    flex: 1,
    position: 'relative'
  },
  iframe: {
    width: '100%',
    height: '100%',
    border: 'none',
    transition: 'opacity 0.3s ease'
  },
  loading: {
    position: 'absolute',
    inset: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'var(--bg-main)',
    zIndex: 1
  },
  loadingText: {
    fontSize: '1.3em',
    color: 'var(--text-secondary)'
  },
  gallery: {
    flex: 1,
    overflowY: 'auto',
    padding: 20,
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
    gap: 12,
    alignContent: 'start'
  },
  photoCard: {
    border: '2px solid var(--border)',
    borderRadius: 'var(--radius-sm)',
    overflow: 'hidden',
    cursor: 'pointer',
    background: 'var(--bg-card)',
    padding: 0,
    aspectRatio: '1',
    transition: 'transform var(--transition-bounce), border-color var(--transition-fast), box-shadow var(--transition-smooth)'
  },
  thumb: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    display: 'block'
  },
  emptyState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    gap: 16,
    opacity: 0.7,
    padding: 40
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
  lightbox: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.92)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
    animation: 'fadeIn 0.2s ease',
    padding: 40
  },
  lightboxImg: {
    maxWidth: '90%',
    maxHeight: '85vh',
    objectFit: 'contain',
    borderRadius: 'var(--radius)',
    boxShadow: 'var(--shadow-lg)'
  },
  closeBtn: {
    position: 'absolute',
    top: 20,
    right: 24,
    width: 44,
    height: 44,
    borderRadius: '50%',
    background: 'rgba(255,255,255,0.15)',
    border: '1px solid rgba(255,255,255,0.3)',
    color: '#fff',
    fontSize: '1.2em',
    fontWeight: 700,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  }
}
