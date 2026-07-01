import React, { useState } from 'react'

export default function AIDailyDigest({ aiKeySet }) {
  const [digest, setDigest] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [meta, setMeta] = useState(null)

  async function generate() {
    setLoading(true)
    setError(null)
    setDigest(null)
    setMeta(null)
    const result = await window.admin.generateDigest()
    setLoading(false)
    if (result.error === 'no-key') {
      setError('OpenRouter key not configured. Add it in Display Settings → AI Helper.')
    } else if (result.error) {
      setError(`Could not generate digest: ${result.error}`)
    } else {
      setDigest(result.digest)
      setMeta({ generatedAt: result.generatedAt, entryCount: result.entryCount })
    }
  }

  return (
    <div>
      <h2>AI Daily Digest</h2>
      <div className="card">
        <p style={{ color: 'var(--text-dim)', fontSize: '0.9em', marginBottom: 16 }}>
          Generates a plain-English summary of the past 7 days of activity — what Jean has been
          doing, any patterns, and anything worth a caregiver's attention.
        </p>

        {!aiKeySet && (
          <div style={{ padding: '10px 14px', background: 'rgba(194,85,63,0.08)', border: '1px solid rgba(194,85,63,0.3)', borderRadius: 8, fontSize: '0.85em', color: 'var(--danger)', marginBottom: 14 }}>
            OpenRouter key not set — go to Display Settings to add one.
          </div>
        )}

        <div className="row">
          <button className="btn btn-primary" onClick={generate} disabled={loading || !aiKeySet}>
            {loading ? 'Generating…' : '✨ Generate Digest'}
          </button>
        </div>

        {loading && (
          <div style={{ marginTop: 20, color: 'var(--text-dim)', fontSize: '0.9em', textAlign: 'center' }}>
            Summarizing the last 7 days of activity…
          </div>
        )}

        {error && (
          <div style={{ marginTop: 16, padding: '12px 16px', background: 'rgba(194,85,63,0.08)', border: '1px solid rgba(194,85,63,0.3)', borderRadius: 8, color: 'var(--danger)', fontSize: '0.9em' }}>
            {error}
          </div>
        )}

        {digest && (
          <div style={{ marginTop: 20 }}>
            {meta && (
              <div style={{ fontSize: '0.78em', color: 'var(--text-dim)', marginBottom: 10 }}>
                Generated {new Date(meta.generatedAt).toLocaleString()} · {meta.entryCount} activity entries analysed
              </div>
            )}
            <div style={{ padding: '18px 20px', background: 'rgba(235,181,82,0.06)', border: '1px solid rgba(235,181,82,0.2)', borderRadius: 10, lineHeight: 1.7, fontSize: '0.95em', color: 'var(--text)' }}>
              {digest}
            </div>
            <div className="row" style={{ marginTop: 12 }}>
              <button className="btn btn-ghost" onClick={generate} disabled={loading}>
                Regenerate
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
