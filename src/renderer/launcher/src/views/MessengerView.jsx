import React, { useState, useEffect } from 'react'

/**
 * MessengerView
 * Embeds the in-house messenger web app directly in the launcher as an iframe.
 * Provides a back button and help button while keeping the messenger experience
 * contained within the launcher window.
 *
 * messengerUrl comes from the electron-store at messenger.url and defaults to
 * https://jeankellmansmith.com in the main process. The server serves Jean's
 * page at / (no /jean.html suffix needed).
 */
export default function MessengerView({ onBack, onHelp, messengerUrl }) {
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)
  const iframeRef = React.useRef(null)

  // messengerUrl is the embedded server's live URL (http://localhost:<port>),
  // injected by the main process. No live-domain fallback: if it's missing the
  // server isn't up, so we surface the offline state rather than the live site.
  const effectiveUrl = (messengerUrl || '').replace(/\/+$/, '')

  // Test messenger connection on mount
  useEffect(() => {
    const checkConnection = async () => {
      if (!effectiveUrl) {
        setError('Messenger service is not running')
        return
      }
      try {
        // Build health-check URL from the base origin so it works regardless of path/port
        const healthUrl = new URL('/api/health', effectiveUrl).href
        const response = await fetch(healthUrl, {
          method: 'GET',
          signal: AbortSignal.timeout(5000)
        })
        if (!response.ok) {
          setError('Messenger service is offline')
        } else {
          setError(null)
        }
      } catch (err) {
        setError('Cannot connect to messenger service')
        console.error('Messenger connection error:', err)
      }
    }

    checkConnection()
  }, [effectiveUrl])

  return (
    <div style={styles.root}>
      {/* Header */}
      <div style={styles.header}>
        <button style={styles.backBtn} onClick={onBack}>
          ← Back
        </button>
        <div style={styles.title}>Messages</div>
        <button style={styles.helpBtn} onClick={onHelp}>
          💙 Help
        </button>
      </div>

      {/* Body */}
      <div style={styles.body}>
        {error ? (
          <div style={styles.errorContainer}>
            <div style={styles.errorIcon}>📡</div>
            <div style={styles.errorTitle}>Messenger Not Available</div>
            <div style={styles.errorMessage}>{error}</div>
            <div style={styles.errorHint}>
              Please check that the messenger service is running and try again.
            </div>
            <button style={styles.retryBtn} onClick={() => window.location.reload()}>
              Try Again
            </button>
          </div>
        ) : (
          <>
            {isLoading && (
              <div style={styles.loadingContainer}>
                <div style={styles.spinner}></div>
                <div style={styles.loadingText}>Loading messages...</div>
              </div>
            )}
            <iframe
              ref={iframeRef}
              src={effectiveUrl}
              style={{
                ...styles.iframe,
                display: isLoading ? 'none' : 'block'
              }}
              onLoad={() => setIsLoading(false)}
              title="In-House Messenger"
              sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-modals allow-presentation"
            />
          </>
        )}
      </div>
    </div>
  )
}

const styles = {
  root: {
    width: '100%',
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    background: 'var(--bg-main)',
    overflow: 'hidden'
  },

  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '20px 28px',
    borderBottom: '1px solid var(--border)',
    background: 'var(--bg-card)',
    gap: 16,
    flexShrink: 0
  },

  backBtn: {
    padding: '12px 20px',
    background: 'var(--bg-main)',
    border: '1.5px solid var(--border)',
    borderRadius: 'var(--radius-sm)',
    color: 'var(--text-primary)',
    fontSize: 'calc(1em * var(--font-scale, 1))',
    fontWeight: 600,
    cursor: 'pointer',
    flexShrink: 0,
    transition: 'background 0.12s, border-color 0.12s'
  },

  title: {
    fontFamily: 'var(--font-display)',
    fontSize: 'calc(1.4em * var(--font-scale, 1))',
    fontWeight: 700,
    color: 'var(--accent)',
    textAlign: 'center',
    flex: 1
  },

  helpBtn: {
    padding: '12px 20px',
    background: 'var(--help-bg)',
    border: '1.5px solid var(--help-border)',
    borderRadius: 'var(--radius-sm)',
    color: '#fff',
    fontSize: 'calc(1em * var(--font-scale, 1))',
    fontWeight: 600,
    cursor: 'pointer',
    flexShrink: 0,
    transition: 'background 0.12s, border-color 0.12s'
  },

  body: {
    flex: 1,
    position: 'relative',
    overflow: 'hidden',
    background: '#f9fafb'
  },

  iframe: {
    width: '100%',
    height: '100%',
    border: 'none',
    borderRadius: 0
  },

  loadingContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#f9fafb',
    gap: 20,
    zIndex: 1
  },

  spinner: {
    width: 48,
    height: 48,
    border: '4px solid var(--border)',
    borderTopColor: 'var(--accent)',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite'
  },

  loadingText: {
    fontSize: 'calc(1em * var(--font-scale, 1))',
    color: 'var(--text-secondary)',
    fontWeight: 500
  },

  errorContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#f9fafb',
    gap: 16,
    padding: 40,
    textAlign: 'center',
    zIndex: 1
  },

  errorIcon: {
    fontSize: 56
  },

  errorTitle: {
    fontSize: 'calc(1.3em * var(--font-scale, 1))',
    fontWeight: 700,
    color: 'var(--text-primary)'
  },

  errorMessage: {
    fontSize: 'calc(1em * var(--font-scale, 1))',
    color: 'var(--text-secondary)',
    maxWidth: 400
  },

  errorHint: {
    fontSize: 'calc(0.9em * var(--font-scale, 1))',
    color: 'var(--text-secondary)',
    maxWidth: 400,
    marginTop: 12
  },

  retryBtn: {
    marginTop: 16,
    padding: '14px 28px',
    background: 'var(--accent)',
    border: 'none',
    borderRadius: 'var(--radius-sm)',
    color: '#fff',
    fontSize: 'calc(1em * var(--font-scale, 1))',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'opacity 0.12s'
  }
}

// Add CSS animation for spinner
if (typeof document !== 'undefined') {
  const style = document.createElement('style')
  style.textContent = `
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
  `
  document.head.appendChild(style)
}
