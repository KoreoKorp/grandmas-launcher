import React, { useState, useEffect, useCallback } from 'react'
import SpeakButton from '../components/SpeakButton'

const SLIDESHOW_INTERVAL_MS = 5000

export default function PhotosView({ photosConfig, onBack }) {
  const [localPhotos, setLocalPhotos] = useState([])
  const [thumbs, setThumbs] = useState({})   // path → thumbnail dataURL
  const [loadError, setLoadError] = useState(false)
  const [albumLoaded, setAlbumLoaded] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(null)
  const [slideshow, setSlideshow] = useState(false)

  const albumUrl = photosConfig?.albumUrl || ''
  const hasAlbum = !!albumUrl

  useEffect(() => {
    window.launcher.getLocalPhotos().then(photos => {
      setLocalPhotos(photos)
      // Fetch thumbnails one at a time and paint each as it arrives, rather than
      // waiting on every photo before showing any — with hundreds of photos,
      // batching them all into one Promise.all left the grid blank for a long
      // stretch and then popped every image in at once, which is what produced
      // the "overlapping" glitch during that mass-mount reflow.
      photos.forEach(p => {
        window.launcher.getPhotoThumbnail(p.path).then(url => {
          if (url) setThumbs(prev => ({ ...prev, [p.path]: url }))
        })
      })
    })
  }, [])

  // If album fails to load, fall through to local
  function handleAlbumError() {
    setLoadError(true)
  }

  const closeLightbox = useCallback(() => {
    setSelectedIndex(null)
    setSlideshow(false)
  }, [])

  const showPrev = useCallback((e) => {
    e?.stopPropagation()
    setSelectedIndex(i =>
      i === null ? i : (i - 1 + localPhotos.length) % localPhotos.length
    )
  }, [localPhotos.length])

  const showNext = useCallback((e) => {
    e?.stopPropagation()
    setSelectedIndex(i =>
      i === null ? i : (i + 1) % localPhotos.length
    )
  }, [localPhotos.length])

  // Keyboard navigation (arrows to move, Esc to close)
  useEffect(() => {
    if (selectedIndex === null) return
    const onKey = (e) => {
      if (e.key === 'ArrowLeft') showPrev()
      else if (e.key === 'ArrowRight') showNext()
      else if (e.key === 'Escape') closeLightbox()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [selectedIndex, showPrev, showNext, closeLightbox])

  // Slideshow auto-advance
  useEffect(() => {
    if (!slideshow || selectedIndex === null) return
    const t = setInterval(() => showNext(), SLIDESHOW_INTERVAL_MS)
    return () => clearInterval(t)
  }, [slideshow, selectedIndex, showNext])

  const showLocal = !hasAlbum || loadError
  const hasLocalPhotos = localPhotos.length > 0
  const selectedPhoto = selectedIndex !== null ? localPhotos[selectedIndex] : null

  return (
    <div style={S.wrap} className="view-slide-up">
      {/* Header */}
      <div style={S.header}>
        <button style={S.backBtn} onClick={onBack}>← Back</button>
        <h2 style={S.title}>📸 Photos</h2>
        <div style={S.headerSpacer} />
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
                    onClick={() => setSelectedIndex(i)}
                  >
                    <div style={S.thumbFrame}>
                      {thumbs[photo.path] ? (
                        <img
                          src={thumbs[photo.path]}
                          alt={photo.name}
                          style={S.thumb}
                          loading="lazy"
                          decoding="async"
                        />
                      ) : (
                        <div style={S.thumbPending} />
                      )}
                    </div>
                    {photo.caption && (
                      <div style={S.thumbCaption}>{photo.caption}</div>
                    )}
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
        <div style={S.lightbox} onClick={closeLightbox}>
          {localPhotos.length > 1 && (
            <div style={{ ...S.navGroup, ...S.navGroupLeft }} onClick={e => e.stopPropagation()}>
              <span style={S.navLabel}>PREVIOUS PICTURE</span>
              <button style={S.navArrow} onClick={showPrev} aria-label="Previous photo">‹</button>
            </div>
          )}

          <img
            src={selectedPhoto.url}
            alt={selectedPhoto.name}
            style={S.lightboxImg}
            onClick={e => e.stopPropagation()}
          />

          {localPhotos.length > 1 && (
            <div style={{ ...S.navGroup, ...S.navGroupRight }} onClick={e => e.stopPropagation()}>
              <span style={S.navLabel}>NEXT PICTURE</span>
              <button style={S.navArrow} onClick={showNext} aria-label="Next photo">›</button>
            </div>
          )}

          {/* Top-right controls */}
          <div style={S.controls} onClick={e => e.stopPropagation()}>
            {localPhotos.length > 1 && (
              <button
                style={{ ...S.controlBtn, ...(slideshow ? S.controlBtnActive : {}) }}
                onClick={() => setSlideshow(s => !s)}
              >
                {slideshow ? '⏸ Pause' : '▶ Slideshow'}
              </button>
            )}
            <button style={S.closeBtn} onClick={closeLightbox} aria-label="Close">✕</button>
          </div>

          {selectedPhoto.caption && (
            <div
              style={{ ...S.captionBanner, bottom: localPhotos.length > 1 ? 76 : 24 }}
              onClick={e => e.stopPropagation()}
            >
              <span style={S.captionText}>{selectedPhoto.caption}</span>
              <SpeakButton text={selectedPhoto.caption} size="md" />
            </div>
          )}

          {localPhotos.length > 1 && (
            <div style={S.counter}>{selectedIndex + 1} / {localPhotos.length}</div>
          )}
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
    display: 'flex',
    flexDirection: 'column',
    border: '2px solid var(--border)',
    borderRadius: 'var(--radius-sm)',
    overflow: 'hidden',
    cursor: 'pointer',
    background: 'var(--bg-card)',
    padding: 0,
    transition: 'transform var(--transition-bounce), border-color var(--transition-fast), box-shadow var(--transition-smooth)'
  },
  thumbFrame: {
    width: '100%',
    aspectRatio: '1',
    flexShrink: 0
  },
  thumb: {
    width: '100%',
    height: '100%',
    objectFit: 'contain',
    display: 'block'
  },
  thumbPending: {
    width: '100%',
    height: '100%',
    background: 'var(--bg-card)'
  },
  thumbCaption: {
    width: '100%',
    padding: '6px 10px',
    fontSize: 'calc(0.8em * var(--font-scale, 1))',
    fontWeight: 600,
    color: 'var(--text-secondary)',
    background: 'var(--bg-card)',
    borderTop: '1px solid var(--border-subtle)',
    textAlign: 'left',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis'
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
  controls: {
    position: 'absolute',
    top: 20,
    right: 24,
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    zIndex: 2
  },
  controlBtn: {
    height: 48,
    padding: '0 20px',
    borderRadius: 24,
    background: 'rgba(255,255,255,0.15)',
    border: '1px solid rgba(255,255,255,0.3)',
    color: '#fff',
    fontSize: '1.05em',
    fontWeight: 700,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center'
  },
  controlBtnActive: {
    background: 'var(--accent)',
    borderColor: 'var(--accent)',
    color: 'var(--text-on-card)'
  },
  closeBtn: {
    width: 48,
    height: 48,
    borderRadius: '50%',
    background: 'rgba(255,255,255,0.15)',
    border: '1px solid rgba(255,255,255,0.3)',
    color: '#fff',
    fontSize: '1.3em',
    fontWeight: 700,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0
  },
  navGroup: {
    position: 'absolute',
    top: '50%',
    transform: 'translateY(-50%)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 12,
    zIndex: 2
  },
  navGroupLeft: { left: 24 },
  navGroupRight: { right: 24 },
  navLabel: {
    color: '#fff',
    fontSize: '1.05em',
    fontWeight: 800,
    letterSpacing: '0.05em',
    textShadow: '0 2px 6px rgba(0,0,0,0.7)',
    whiteSpace: 'nowrap'
  },
  navArrow: {
    width: 100,
    height: 100,
    borderRadius: '50%',
    background: 'rgba(255,255,255,0.15)',
    border: '1px solid rgba(255,255,255,0.3)',
    color: '#fff',
    fontSize: '3.6em',
    fontWeight: 700,
    lineHeight: 1,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 8
  },
  captionBanner: {
    position: 'absolute',
    left: '50%',
    transform: 'translateX(-50%)',
    maxWidth: '80%',
    display: 'flex',
    alignItems: 'center',
    gap: 14,
    padding: '10px 20px',
    borderRadius: 20,
    background: 'rgba(0,0,0,0.6)',
    border: '1px solid rgba(255,255,255,0.2)',
    zIndex: 2
  },
  captionText: {
    color: '#fff',
    fontSize: 'calc(1.15em * var(--font-scale, 1))',
    fontWeight: 700,
    lineHeight: 1.4
  },
  counter: {
    position: 'absolute',
    bottom: 24,
    left: '50%',
    transform: 'translateX(-50%)',
    padding: '8px 18px',
    borderRadius: 20,
    background: 'rgba(0,0,0,0.5)',
    border: '1px solid rgba(255,255,255,0.2)',
    color: '#fff',
    fontSize: '1.05em',
    fontWeight: 700,
    zIndex: 2
  },
  headerSpacer: {
    width: 90,
    flexShrink: 0
  }
}
