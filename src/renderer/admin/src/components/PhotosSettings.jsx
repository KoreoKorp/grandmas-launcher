import React, { useState, useEffect, useCallback, useRef } from 'react'

export default function PhotosSettings({ photos, onSave }) {
  const [albumUrl, setAlbumUrl] = useState(photos?.albumUrl || '')
  const [localPath, setLocalPath] = useState(photos?.localPath || '')
  const [saved, setSaved] = useState(false)

  const [localPhotos, setLocalPhotos] = useState([])
  const [thumbs, setThumbs] = useState({})
  const [captions, setCaptions] = useState(photos?.captions || {})
  const [captionsSaved, setCaptionsSaved] = useState(false)
  const [loadingPhotos, setLoadingPhotos] = useState(false)
  const [genBusy, setGenBusy] = useState({})       // filename → true while its caption is being drafted
  const [genAll, setGenAll] = useState(false)      // "suggest all" run in progress
  const [genError, setGenError] = useState(null)
  const genCancel = useRef(false)
  const loadSequence = useRef(0)

  const loadLocalPhotos = useCallback(async pathToLoad => {
    const requestedPath = (pathToLoad || '').trim()
    const sequence = ++loadSequence.current
    if (!requestedPath) {
      setLocalPhotos([])
      setThumbs({})
      setLoadingPhotos(false)
      return
    }
    setLoadingPhotos(true)
    setThumbs({})
    try {
      const list = await window.admin.getLocalPhotos(requestedPath)
      if (sequence !== loadSequence.current) return
      setLocalPhotos(list)
      setLoadingPhotos(false)
      list.forEach(p => {
        window.admin.getPhotoThumbnail(p.path).then(url => {
          if (sequence === loadSequence.current && url) {
            setThumbs(prev => ({ ...prev, [p.path]: url }))
          }
        })
      })
    } catch {
      if (sequence === loadSequence.current) {
        setLocalPhotos([])
        setLoadingPhotos(false)
      }
    }
  }, [])

  // Load the persisted folder on entry. Edits are previewed explicitly on
  // Browse, blur, or Save so typing a path does not re-thumbnail the previous
  // folder on every keystroke.
  useEffect(() => { loadLocalPhotos(photos?.localPath || '') }, [loadLocalPhotos, photos?.localPath])

  async function pickFolder() {
    const path = await window.admin.pickFolder()
    if (path) {
      setLocalPath(path)
      loadLocalPhotos(path)
    }
  }

  async function save() {
    await onSave({ albumUrl, localPath, captions })
    await loadLocalPhotos(localPath)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  function updateCaption(filename, value) {
    setCaptions(prev => ({ ...prev, [filename]: value }))
  }

  // Draft one caption with Claude vision. Fills the text box — it is NOT saved
  // until the caregiver reviews it and clicks "Save Captions". Returns the raw
  // { caption } / { error } so a batch run can decide whether to keep going.
  async function suggestCaption(p) {
    setGenBusy(prev => ({ ...prev, [p.name]: true }))
    try {
      const res = await window.admin.generateCaption(p.path)
      if (res?.caption) updateCaption(p.name, res.caption)
      return res || { error: 'unknown error' }
    } finally {
      setGenBusy(prev => { const n = { ...prev }; delete n[p.name]; return n })
    }
  }

  function describeGenError(err) {
    if (err === 'no-key') return 'Add a Claude API key in Display Settings → AI Helper first.'
    if (err === 'unreadable-image') return "That image file couldn't be opened."
    return `Could not draft a caption: ${err || 'unknown error'}`
  }

  async function suggestOne(p) {
    setGenError(null)
    const res = await suggestCaption(p)
    if (!res.caption) setGenError(describeGenError(res.error))
  }

  async function suggestAllMissing() {
    const targets = localPhotos.filter(p => !(captions[p.name] || '').trim())
    if (!targets.length) return
    genCancel.current = false
    setGenAll(true)
    setGenError(null)
    for (const p of targets) {
      if (genCancel.current) break
      const res = await suggestCaption(p)
      // Stop the whole batch on a config-level failure; skip past a single bad file.
      if (res.error === 'no-key') { setGenError(describeGenError(res.error)); break }
      if (res.error && res.error !== 'unreadable-image') { setGenError(describeGenError(res.error)); break }
    }
    setGenAll(false)
  }

  async function saveCaptions() {
    await onSave({ albumUrl, localPath, captions })
    setCaptionsSaved(true)
    setTimeout(() => setCaptionsSaved(false), 2000)
  }

  return (
    <div style={S.wrap}>
      <h2 style={S.heading}>📸 Photos Settings</h2>

      {/* Google Photos album */}
      <section style={S.section}>
        <h3 style={S.sectionTitle}>Google Photos Shared Album URL</h3>
        <p style={S.hint}>
          Open Google Photos, find a shared album, copy its link, and paste it here.
          Jean will see the album when she taps Photos. Leave blank to use only local photos.
        </p>
        <input
          style={S.input}
          type="url"
          value={albumUrl}
          onChange={e => setAlbumUrl(e.target.value)}
          placeholder="https://photos.app.goo.gl/..."
        />
      </section>

      {/* Local folder fallback */}
      <section style={S.section}>
        <h3 style={S.sectionTitle}>Local Photos Folder (Fallback)</h3>
        <p style={S.hint}>
          If the album URL is empty or fails to load, photos from this folder will be shown instead.
          Supported formats: JPG, PNG, GIF, WebP.
        </p>
        <div style={S.row}>
          <input
            style={{ ...S.input, flex: 1 }}
            value={localPath}
            onChange={e => setLocalPath(e.target.value)}
            onBlur={() => loadLocalPhotos(localPath)}
            placeholder="C:\Users\Jean\Pictures\Family"
          />
          <button style={S.pickBtn} onClick={pickFolder}>Browse…</button>
        </div>
      </section>

      {/* Priority note */}
      <div style={S.note}>
        <strong>Priority:</strong> Google Photos album is shown first. If it's not set or fails to load, the local folder is used instead.
      </div>

      {/* Local photo captions */}
      {localPath && (
        <section style={S.section}>
          <h3 style={S.sectionTitle}>Photo Captions</h3>
          <p style={S.hint}>
            Add a name and context under each local photo — e.g. "Sarah — your daughter — Bermuda, 2019".
            Recognizing faces is often one of the first things dementia affects, so a caption she can
            read (or have read aloud) helps. Captions only apply to the local folder, not the Google
            Photos album.
          </p>
          <p style={S.hint}>
            <strong>✨ Suggest</strong> asks Claude to describe a photo ("an older man and a young girl
            in a garden"). It can't know names — review every draft and add them, then click
            <strong> Save Captions</strong>. Nothing is saved until you do.
          </p>

          {loadingPhotos ? (
            <div style={S.hint}>Loading photos…</div>
          ) : localPhotos.length === 0 ? (
            <div style={S.hint}>No photos found in that folder yet.</div>
          ) : (
            <>
              <div className="row" style={{ alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                <button
                  style={{ ...S.pickBtn, opacity: genAll ? 0.6 : 1 }}
                  onClick={() => genAll ? (genCancel.current = true) : suggestAllMissing()}
                  disabled={loadingPhotos}
                >
                  {genAll ? 'Stop' : '✨ Suggest captions for blank photos'}
                </button>
                {genAll && <span style={S.hint}>Drafting… (leaves ones you've already filled in alone)</span>}
                {genError && <span style={{ ...S.hint, color: 'var(--danger, #c2553f)' }}>{genError}</span>}
              </div>

              <div style={S.captionGrid}>
                {localPhotos.map(p => (
                  <div key={p.path} style={S.captionCard}>
                    <div style={S.captionThumbWrap}>
                      {thumbs[p.path]
                        ? <img src={thumbs[p.path]} alt={p.name} style={S.captionThumb} />
                        : <div style={S.captionThumbPending} />
                      }
                    </div>
                    <input
                      style={S.input}
                      value={captions[p.name] || ''}
                      onChange={e => updateCaption(p.name, e.target.value)}
                      placeholder="Who's in this photo?"
                    />
                    <button
                      style={{ ...S.suggestBtn, opacity: genBusy[p.name] ? 0.6 : 1 }}
                      onClick={() => suggestOne(p)}
                      disabled={!!genBusy[p.name] || genAll}
                    >
                      {genBusy[p.name] ? 'Drafting…' : '✨ Suggest'}
                    </button>
                  </div>
                ))}
              </div>
            </>
          )}

          <div className="row" style={{ marginTop: 4 }}>
            <button style={{ ...S.saveBtn, ...(captionsSaved ? S.saveBtnSuccess : {}) }} onClick={saveCaptions}>
              {captionsSaved ? '✓ Captions Saved!' : 'Save Captions'}
            </button>
          </div>
        </section>
      )}

      <button style={{ ...S.saveBtn, ...(saved ? S.saveBtnSuccess : {}) }} onClick={save}>
        {saved ? '✓ Saved!' : 'Save Changes'}
      </button>
    </div>
  )
}

const S = {
  wrap: { padding: '28px 32px', maxWidth: 620, display: 'flex', flexDirection: 'column', gap: 24 },
  heading: { fontSize: '1.4em', fontWeight: 800, color: 'var(--text)', margin: 0 },
  section: { display: 'flex', flexDirection: 'column', gap: 10 },
  sectionTitle: { fontSize: '1.05em', fontWeight: 700, color: 'var(--text)', margin: 0 },
  hint: { fontSize: '0.88em', color: 'var(--text-dim)', margin: 0, lineHeight: 1.5 },
  captionGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
    gap: 14,
    maxHeight: 480,
    overflowY: 'auto',
    padding: 4
  },
  captionCard: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    background: 'var(--card)',
    border: '1px solid var(--border)',
    borderRadius: 8,
    padding: 10
  },
  captionThumbWrap: {
    width: '100%',
    aspectRatio: '1',
    borderRadius: 6,
    overflow: 'hidden',
    background: 'var(--input-bg)'
  },
  captionThumb: { width: '100%', height: '100%', objectFit: 'contain', display: 'block' },
  captionThumbPending: { width: '100%', height: '100%' },
  suggestBtn: {
    alignSelf: 'flex-start',
    padding: '6px 12px',
    background: 'var(--card)',
    border: '1px solid var(--border)',
    borderRadius: 8,
    color: 'var(--text)',
    cursor: 'pointer',
    fontSize: '0.85em',
    fontWeight: 600
  },
  input: {
    background: 'var(--input-bg)',
    border: '1px solid var(--border)',
    borderRadius: 8,
    color: 'var(--text)',
    padding: '10px 14px',
    fontSize: '1em',
    outline: 'none',
    width: '100%'
  },
  row: { display: 'flex', gap: 8, alignItems: 'center' },
  pickBtn: {
    padding: '10px 16px',
    background: 'var(--card)',
    border: '1px solid var(--border)',
    borderRadius: 8,
    color: 'var(--text)',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    fontSize: '0.95em'
  },
  note: {
    background: 'rgba(235,181,82,0.08)',
    border: '1px solid rgba(235,181,82,0.25)',
    borderRadius: 10,
    padding: '14px 18px',
    fontSize: '0.9em',
    color: 'var(--text-dim)',
    lineHeight: 1.5
  },
  saveBtn: {
    alignSelf: 'flex-start',
    padding: '12px 28px',
    background: 'var(--accent)',
    color: '#1C322D',
    borderRadius: 10,
    fontWeight: 800,
    cursor: 'pointer',
    border: 'none',
    fontSize: '1em'
  },
  saveBtnSuccess: { background: '#4caf7d', color: '#fff' }
}
