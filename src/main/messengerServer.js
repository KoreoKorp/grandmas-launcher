import express    from 'express'
import http       from 'http'
import { Server } from 'socket.io'
import path       from 'path'
import fs         from 'fs'
import crypto     from 'crypto'
import { isFamilyRadioEnabled } from './store.js'

// ── Helpers ───────────────────────────────────────────────────

// Plain !== / === on secrets (PINs, passwords, session tokens) leaks timing
// information — JS string comparison short-circuits at the first mismatched
// character, so how long a comparison takes can reveal how many leading
// characters an attacker guessed correctly. crypto.timingSafeEqual runs in
// constant time for equal-length inputs; lengths differing is treated as an
// immediate mismatch (length itself isn't the sensitive part here — PIN/
// token lengths are fixed and effectively public).
function safeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false
  const bufA = Buffer.from(a)
  const bufB = Buffer.from(b)
  if (bufA.length !== bufB.length) return false
  return crypto.timingSafeEqual(bufA, bufB)
}

function makeDataHelpers(dataDir) {
  const MESSAGES_DIR  = path.join(dataDir, 'messages')
  const CONTACTS_FILE = path.join(dataDir, 'contacts.json')
  const ALERTS_FILE   = path.join(dataDir, 'alerts.json')
  const RADIO_DIR      = path.join(dataDir, 'family-radio')
  const RADIO_FILE     = path.join(dataDir, 'family-radio.json')

  fs.mkdirSync(MESSAGES_DIR, { recursive: true })
  fs.mkdirSync(RADIO_DIR, { recursive: true })
  if (!fs.existsSync(CONTACTS_FILE)) fs.writeFileSync(CONTACTS_FILE, '[]')
  if (!fs.existsSync(ALERTS_FILE))   fs.writeFileSync(ALERTS_FILE,   '[]')
  if (!fs.existsSync(RADIO_FILE))    fs.writeFileSync(RADIO_FILE,    '[]')

  function getContacts() {
    try { return JSON.parse(fs.readFileSync(CONTACTS_FILE, 'utf8')) } catch { return [] }
  }
  function saveContacts(c) { fs.writeFileSync(CONTACTS_FILE, JSON.stringify(c, null, 2)) }
  function findContact(id) {
    return getContacts().find(c => (c.slug && c.slug === id) || c.roomId === id) || null
  }

  function getMessages(roomId) {
    const safe = roomId.replace(/[^a-f0-9]/gi, '')
    const file = path.join(MESSAGES_DIR, `${safe}.json`)
    if (!fs.existsSync(file)) return []
    try { return JSON.parse(fs.readFileSync(file, 'utf8')) } catch { return [] }
  }
  function saveMessage(roomId, message) {
    const safe     = roomId.replace(/[^a-f0-9]/gi, '')
    const file     = path.join(MESSAGES_DIR, `${safe}.json`)
    const messages = getMessages(roomId)
    messages.push(message)
    fs.writeFileSync(file, JSON.stringify(messages.slice(-500), null, 2))
    return message
  }
  function markRoomAsRead(roomId) {
    const safe = roomId.replace(/[^a-f0-9]/gi, '')
    const file = path.join(MESSAGES_DIR, `${safe}.json`)
    if (!fs.existsSync(file)) return
    fs.writeFileSync(file, JSON.stringify(getMessages(roomId).map(m => ({ ...m, readByJean: true })), null, 2))
  }

  function getAlerts() {
    try { return JSON.parse(fs.readFileSync(ALERTS_FILE, 'utf8')) } catch { return [] }
  }
  function saveAlerts(a) { fs.writeFileSync(ALERTS_FILE, JSON.stringify(a, null, 2)) }
  function addAlert(data) {
    const alert  = { id: crypto.randomBytes(4).toString('hex'), ...data, timestamp: new Date().toISOString() }
    const alerts = getAlerts()
    alerts.unshift(alert)
    saveAlerts(alerts.slice(0, 100))
    return alert
  }

  function getRadioClips() {
    try { return JSON.parse(fs.readFileSync(RADIO_FILE, 'utf8')) } catch { return [] }
  }
  function saveRadioClips(clips) { fs.writeFileSync(RADIO_FILE, JSON.stringify(clips, null, 2)) }
  // Best-effort delete of a clip's media files. Never throws — a failed cleanup
  // must not break the upload/played paths. ENOENT (already gone) is silent.
  function unlinkClipFiles(clip) {
    if (!clip) return
    for (const file of [clip.audioFile, clip.photoFile]) {
      if (!file) continue
      fs.unlink(path.join(RADIO_DIR, file), err => {
        if (err && err.code !== 'ENOENT') console.error('[messenger] Failed to delete radio media:', err.message)
      })
    }
  }
  const MAX_RADIO_CLIPS = 50
  function addRadioClip(data) {
    const clip = { id: crypto.randomBytes(6).toString('hex'), createdAt: new Date().toISOString(), playedAt: null, ...data }
    const clips = getRadioClips()
    clips.push(clip)
    // Ambient stream, not an archive — cap stored clips. But never silently drop
    // a clip the senior hasn't seen: keep ALL unplayed clips, plus the most
    // recent played ones up to the cap. Delete media files of anything dropped
    // so RADIO_DIR (up to ~8MB per part) can't grow unbounded.
    let kept = clips
    if (clips.length > MAX_RADIO_CLIPS) {
      const unplayed = clips.filter(c => !c.playedAt)
      const played   = clips.filter(c => c.playedAt)
      const keepPlayedCount = Math.max(0, MAX_RADIO_CLIPS - unplayed.length)
      const keepPlayed = keepPlayedCount > 0 ? played.slice(-keepPlayedCount) : []
      const keptIds = new Set([...unplayed, ...keepPlayed].map(c => c.id))
      kept = clips.filter(c => keptIds.has(c.id))              // preserve chronological order
      clips.filter(c => !keptIds.has(c.id)).forEach(unlinkClipFiles)
    }
    saveRadioClips(kept)
    return clip
  }
  function markRadioClipPlayed(id) {
    const clips = getRadioClips()
    const clip  = clips.find(c => c.id === id)
    // Once played the clip never re-enters the queue, so its media is dead
    // weight — reclaim the disk immediately.
    if (clip && !clip.playedAt) unlinkClipFiles(clip)
    saveRadioClips(clips.map(c => c.id === id ? { ...c, playedAt: new Date().toISOString() } : c))
  }

  return {
    getContacts, saveContacts, findContact, getMessages, saveMessage, markRoomAsRead, getAlerts, saveAlerts, addAlert,
    getRadioClips, saveRadioClips, addRadioClip, markRadioClipPlayed, RADIO_DIR
  }
}

// ── Main export ───────────────────────────────────────────────

/**
 * Start the embedded Jean's Messenger server.
 *
 * @param {object} config
 *   dataDir          - absolute path for JSON data storage
 *   publicDir        - absolute path to bundled HTML files
 *   port             - port to bind on (0.0.0.0)
 *   jeanPin          - Jean's 4-digit PIN
 *   adminPassword    - admin panel password
 *   launcherAuthToken - authToken from electron-store (skip TOFU for local launcher)
 *   discordWebhookUrl - optional
 *   turn             - { url, username, credential }
 *   twilio           - { accountSid, authToken, from, caregiverPhone }
 */
export async function startServer(config) {
  const {
    dataDir, publicDir, port,
    launcherAuthToken = '',
    turn   = {},
    twilio = {}
  } = config

  // Credentials that the admin can change at runtime. Kept in `let` bindings
  // (not consts captured in closures) so updateConfig() can swap them live —
  // otherwise a new PIN set in the admin panel would never reach the running
  // server and every PIN Jean types would be rejected until an app restart.
  let jeanPin           = config.jeanPin           || ''
  let adminPassword     = config.adminPassword     || ''
  let discordWebhookUrl = config.discordWebhookUrl || ''
  let turnConfig        = { url: turn.url || '', username: turn.username || '', credential: turn.credential || '' }
  let twilioConfig       = {
    accountSid:     twilio.accountSid     || '',
    authToken:      twilio.authToken      || '',
    from:           twilio.from           || '',
    caregiverPhone: twilio.caregiverPhone || ''
  }

  // ICE servers handed to family browsers over the socket after they
  // authenticate. Family connects through the Cloudflare tunnel, so without a
  // TURN relay most calls can't traverse NAT — STUN alone is only a fallback.
  function buildIceServers() {
    const servers = [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] }]
    if (turnConfig.url) {
      // Match the scheme, not the hostname — 'turn.example.com' must still get the prefix
      const urls = /^turns?:/.test(turnConfig.url) ? turnConfig.url : `turn:${turnConfig.url}`
      servers.push({ urls, username: turnConfig.username, credential: turnConfig.credential })
    }
    return servers
  }

  if (!jeanPin)       console.warn('[messenger] jeanPin not set — Jean auth disabled')
  if (!adminPassword) console.warn('[messenger] adminPassword not set — admin auth disabled')

  const db = makeDataHelpers(dataDir)

  // ── Discord webhook ────────────────────────────────────────
  // Generic embed sender — the IP-change security alert and the Help button
  // alert both post through this so a caregiver only has to configure one
  // webhook URL to get both kinds of notification.
  async function sendDiscordEmbed(title, description, color = 0xFF4444) {
    if (!discordWebhookUrl) return false
    try {
      const res = await fetch(discordWebhookUrl, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          embeds: [{ title, description, color, timestamp: new Date().toISOString() }]
        })
      })
      return res.ok
    } catch (e) { console.error('[messenger] Discord webhook failed:', e.message); return false }
  }

  async function sendDiscordAlert(contactName, knownIP, newIP) {
    await sendDiscordEmbed(
      "⚠️ Security Alert — Jean's Messenger",
      `**${contactName}** connected from a new IP address.\n\n` +
      `**Known IP:** \`${knownIP}\`\n**New IP:** \`${newIP}\`\n\n` +
      `They have been **allowed through**. If this wasn't ${contactName}, open the admin panel → find their contact → click **Clear IP**.`
    )
  }

  // ── Twilio SMS ───────────────────────────────────────────────
  // Generic SMS sender — reused by the Help button alert and the admin
  // panel's manual "send system report" action.
  async function sendSms(body) {
    const { accountSid, authToken: authTok, from, caregiverPhone } = twilioConfig
    if (!accountSid || !authTok || !from || !caregiverPhone) {
      return { ok: false, reason: 'Twilio not configured' }
    }
    try {
      const r = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
        method: 'POST',
        headers: {
          'Authorization':  'Basic ' + Buffer.from(`${accountSid}:${authTok}`).toString('base64'),
          'Content-Type':   'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({ To: caregiverPhone, From: from, Body: body }).toString()
      })
      if (!r.ok) { const e = await r.json(); return { ok: false, reason: e.message || r.statusText } }
      return { ok: true }
    } catch (e) { return { ok: false, reason: e.message } }
  }

  // ── Help button alert ───────────────────────────────────────
  // Fired when Jean presses "Need help?" on the launcher. Reaches family over
  // every channel that's configured (both, either, or neither) — unlike the
  // local admin-window flash, this works even when nobody is sitting at her PC.
  async function sendHelpAlert() {
    const results = await Promise.all([
      sendDiscordEmbed(
        '💙 Jean needs help',
        'She just pressed the **Need help?** button on her launcher. Please check on her.',
        0xEBB552
      ),
      sendSms("Jean pressed the 'Need help?' button on her launcher. Please check on her.")
    ])
    return { discordSent: results[0], sms: results[1] }
  }

  // ── PIN rate limiting ──────────────────────────────────────
  // Only FAILED attempts count against the budget — a family member
  // reconnecting on flaky WiFi must not lock themselves out.
  const pinAttempts = new Map()
  function isPinRateLimited(ip) {
    const record = pinAttempts.get(ip)
    if (!record) return false
    if (Date.now() - record.since > 15 * 60 * 1000) { pinAttempts.delete(ip); return false }
    return record.count >= 10
  }
  function recordPinFailure(ip) {
    const now    = Date.now()
    const record = pinAttempts.get(ip) || { count: 0, since: now }
    if (now - record.since > 15 * 60 * 1000) { record.count = 0; record.since = now }
    record.count++
    pinAttempts.set(ip, record)
  }
  function socketIP(socket) {
    return ((socket.handshake.headers['x-forwarded-for'] || '').split(',')[0].trim())
      || socket.handshake.address
  }

  // ── Express + Socket.IO ────────────────────────────────────
  const expressApp = express()
  const httpServer = http.createServer(expressApp)
  // Raised from the 1MB default so a voice note + photo pair can travel over
  // the same authenticated socket used for chat, instead of a separate REST
  // upload path that would need its own auth (see family-radio-upload below).
  const io = new Server(httpServer, { cors: { origin: '*' }, maxHttpBufferSize: 20 * 1024 * 1024 })

  // jean.html/family.html/admin.html each carry one large inline <script>
  // block and (admin.html) onclick="" attributes, so script-src/style-src
  // need 'unsafe-inline' — extracting those to external files to drop it is
  // a separate, larger refactor. This still meaningfully restricts what these
  // pages can load or connect to: no remote script/frame injection, no
  // fetching arbitrary third-party domains, no plugins. api.qrserver.com is
  // allow-listed because admin.html's "QR" button loads a code image from it
  // (see showQr); everything else these pages need is same-origin.
  const CSP = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https://api.qrserver.com",
    "media-src 'self' blob:",
    "connect-src 'self' ws: wss: stun: turn: turns:",
    "frame-src 'none'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'"
  ].join('; ')

  expressApp.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-admin-key, x-jean-pin, x-session-token')
    res.setHeader('Content-Security-Policy', CSP)
    if (req.method === 'OPTIONS') return res.sendStatus(204)
    next()
  })
  // Express defaults this to 100kb already, but explicit beats implicit —
  // 1mb covers every legitimate JSON payload here (contacts, alerts) with
  // headroom, while still bounding it well below the raised 20MB socket.io
  // limit used for voice-note/photo uploads, which go over a different path.
  expressApp.use(express.json({ limit: '1mb' }))
  expressApp.use(express.static(publicDir))
  // Family Radio media is private. The launcher displays it via <img>/<audio>,
  // which cannot send an auth header, so a header-token gate would break the
  // launcher too. Instead restrict this route to loopback: the launcher fetches
  // these URLs from http://localhost:<port> (same origin as its config URL),
  // while family devices reach the server over its LAN IP and are senders, not
  // viewers — they never need to read the media back.
  const LOOPBACK_ADDRS = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1'])
  expressApp.use('/family-radio-media', (req, res, next) => {
    const ip = req.socket?.remoteAddress || ''
    if (!LOOPBACK_ADDRS.has(ip)) return res.status(403).json({ error: 'Forbidden' })
    next()
  }, express.static(db.RADIO_DIR))

  function requireAdmin(req, res, next) {
    const key = req.headers['x-admin-key']
    if (!key || !safeEqual(key, adminPassword)) return res.status(401).json({ error: 'Unauthorized' })
    next()
  }

  // Launcher runs in the same process as this server but talks to it over
  // HTTP like any other client — gate with the same authToken used for its
  // socket.io registration so no other LAN device can read/ack the queue.
  function requireLauncher(req, res, next) {
    const token = req.headers['x-launcher-token']
    if (!launcherAuthToken || token !== launcherAuthToken) return res.status(401).json({ error: 'Unauthorized' })
    next()
  }

  // ── Page routes ────────────────────────────────────────────
  expressApp.get('/api/health', (_, res) => res.json({ ok: true }))
  expressApp.get('/',          (_, res) => res.sendFile(path.join(publicDir, 'jean.html')))
  expressApp.get('/jean',      (_, res) => res.sendFile(path.join(publicDir, 'jean.html')))
  expressApp.get('/admin',     (_, res) => res.sendFile(path.join(publicDir, 'admin.html')))
  expressApp.get('/chat',      (_, res) => res.sendFile(path.join(publicDir, 'jean.html')))
  expressApp.get('/chat/:id',  (_, res) => res.sendFile(path.join(publicDir, 'family.html')))

  // ── Contacts API ───────────────────────────────────────────
  expressApp.get('/api/contacts', requireAdmin, (req, res) => res.json(db.getContacts()))

  expressApp.post('/api/contacts', requireAdmin, (req, res) => {
    const { name, phone, slug, pin } = req.body
    if (!name?.trim()) return res.status(400).json({ error: 'Name is required' })
    const contacts  = db.getContacts()
    const cleanSlug = (slug || '').trim().toLowerCase().replace(/[^a-z0-9-]/g, '')
    if (contacts.some(c => c.name.toLowerCase() === name.trim().toLowerCase()))
      return res.status(400).json({ error: 'A contact with that name already exists' })
    if (cleanSlug && contacts.some(c => c.slug === cleanSlug))
      return res.status(400).json({ error: 'That URL name is already taken' })
    const contact = {
      id:           crypto.randomBytes(4).toString('hex'),
      name:         name.trim(),
      phone:        (phone || '').replace(/[^0-9+\-() ]/g, '').trim(),
      roomId:       crypto.randomBytes(12).toString('hex'),
      slug:         cleanSlug || null,
      pin:          pin?.trim() || null,
      allowedIP:    null,
      sessionToken: crypto.randomBytes(16).toString('hex'),
      createdAt:    new Date().toISOString()
    }
    contacts.push(contact)
    db.saveContacts(contacts)
    res.json(contact)
  })

  expressApp.put('/api/contacts/:id', requireAdmin, (req, res) => {
    const contacts = db.getContacts()
    const idx      = contacts.findIndex(c => c.id === req.params.id)
    if (idx === -1) return res.status(404).json({ error: 'Contact not found' })
    const { slug, pin, clearIP } = req.body
    if (slug !== undefined) {
      const cleanSlug = slug.trim().toLowerCase().replace(/[^a-z0-9-]/g, '')
      if (cleanSlug && contacts.some((c, i) => i !== idx && c.slug === cleanSlug))
        return res.status(400).json({ error: 'That URL name is already taken' })
      contacts[idx].slug = cleanSlug || null
    }
    if (pin !== undefined) {
      contacts[idx].pin = pin.trim() || null
      contacts[idx].sessionToken = crypto.randomBytes(16).toString('hex')
    }
    if (clearIP) contacts[idx].allowedIP = null
    if (!contacts[idx].sessionToken) contacts[idx].sessionToken = crypto.randomBytes(16).toString('hex')
    db.saveContacts(contacts)
    res.json(contacts[idx])
  })

  expressApp.delete('/api/contacts/:id', requireAdmin, (req, res) => {
    const contacts = db.getContacts()
    const contact  = contacts.find(c => c.id === req.params.id)
    if (!contact) return res.status(404).json({ error: 'Contact not found' })
    db.saveContacts(contacts.filter(c => c.id !== req.params.id))
    res.json({ success: true })
  })

  // ── Alerts API ─────────────────────────────────────────────
  expressApp.get('/api/alerts',        requireAdmin, (req, res) => res.json(db.getAlerts()))
  expressApp.delete('/api/alerts',     requireAdmin, (req, res) => { db.saveAlerts([]); res.json({ success: true }) })
  expressApp.delete('/api/alerts/:id', requireAdmin, (req, res) => {
    db.saveAlerts(db.getAlerts().filter(a => a.id !== req.params.id))
    res.json({ success: true })
  })

  // ── Family Radio ───────────────────────────────────────────
  // Passive, zero-navigation ambient stream: family/Jean send a short voice
  // note and/or a photo, the launcher surfaces it on the idle home screen
  // without the senior having to open Messages and pick a contact.

  const MAX_CLIP_BYTES = 8 * 1024 * 1024 // ~8MB decoded, per audio or photo

  function decodeDataUrl(dataUrl) {
    // Accepts "data:<mime>;base64,<data>" — returns { buffer, ext } or null.
    const match = /^data:([^;]+);base64,(.+)$/.exec(dataUrl || '')
    if (!match) return null
    const buffer = Buffer.from(match[2], 'base64')
    if (buffer.length === 0 || buffer.length > MAX_CLIP_BYTES) return null
    const ext = (match[1].split('/')[1] || 'bin').replace(/[^a-z0-9]/gi, '').slice(0, 8)
    return { buffer, ext }
  }

  function saveRadioUpload(senderName, { audioDataUrl, photoDataUrl, caption }) {
    if (!audioDataUrl && !photoDataUrl) return { error: 'Include a voice note or a photo' }

    const id = crypto.randomBytes(6).toString('hex')
    let audioFile = null
    let photoFile = null

    if (audioDataUrl) {
      const decoded = decodeDataUrl(audioDataUrl)
      if (!decoded) return { error: 'Voice note is invalid or too large' }
      audioFile = `${id}-audio.${decoded.ext}`
      fs.writeFileSync(path.join(db.RADIO_DIR, audioFile), decoded.buffer)
    }
    if (photoDataUrl) {
      const decoded = decodeDataUrl(photoDataUrl)
      if (!decoded) return { error: 'Photo is invalid or too large' }
      photoFile = `${id}-photo.${decoded.ext}`
      fs.writeFileSync(path.join(db.RADIO_DIR, photoFile), decoded.buffer)
    }

    const clip = db.addRadioClip({ id, from: senderName, audioFile, photoFile, caption: (caption || '').slice(0, 280) })
    return {
      clip: {
        ...clip,
        audioUrl: audioFile ? `/family-radio-media/${audioFile}` : null,
        photoUrl: photoFile ? `/family-radio-media/${photoFile}` : null
      }
    }
  }

  expressApp.get('/api/family-radio/queue', requireLauncher, (req, res) => {
    if (!isFamilyRadioEnabled()) return res.json([])
    const unplayed = db.getRadioClips().filter(c => !c.playedAt)
    res.json(unplayed.map(c => ({
      ...c,
      audioUrl: c.audioFile ? `/family-radio-media/${c.audioFile}` : null,
      photoUrl: c.photoFile ? `/family-radio-media/${c.photoFile}` : null
    })))
  })

  expressApp.post('/api/family-radio/:id/played', requireLauncher, (req, res) => {
    db.markRadioClipPlayed(req.params.id)
    res.json({ ok: true })
  })

  // ── TURN credentials ───────────────────────────────────────
  expressApp.get('/api/turn', requireAdmin, (req, res) => {
    if (!turnConfig.url) return res.json({ iceServers: [] })
    res.json({
      turnUrl: turnConfig.url, turnUsername: turnConfig.username, turnCredential: turnConfig.credential,
      iceServers: buildIceServers()
    })
  })

  // ── SMS system report ──────────────────────────────────────
  expressApp.post('/send-sys-report', requireAdmin, async (req, res) => {
    const { message } = req.body
    res.json(await sendSms(message))
  })

  // ── Room / messages API ────────────────────────────────────
  expressApp.get('/api/room/:id', (req, res) => {
    const contact = db.findContact(req.params.id)
    if (!contact) return res.status(404).json({ error: 'This chat link is not valid or has been removed.' })
    res.json({ name: contact.name, roomId: contact.roomId, requiresPin: !!contact.pin })
  })

  expressApp.get('/api/messages/:id', (req, res) => {
    const contact = db.findContact(req.params.id)
    if (!contact) return res.status(404).json({ error: 'Invalid room' })
    // Truthiness guards: an unset credential must never match an empty header
    const isAdmin  = !!adminPassword && safeEqual(req.headers['x-admin-key'], adminPassword)
    const isFamily = safeEqual(req.headers['x-session-token'], contact.sessionToken)
    const isJean   = !!jeanPin       && safeEqual(req.headers['x-jean-pin'], jeanPin)
    if (!isAdmin && !isFamily && !isJean) return res.status(401).json({ error: 'Unauthorized' })
    res.json(db.getMessages(contact.roomId))
  })

  expressApp.get('/api/jean/rooms', (req, res) => {
    if (!jeanPin || !safeEqual(req.headers['x-jean-pin'], jeanPin)) return res.status(401).json({ error: 'Unauthorized' })
    const rooms = db.getContacts().map(contact => {
      const messages    = db.getMessages(contact.roomId)
      const lastMessage = messages[messages.length - 1] || null
      const unread      = messages.filter(m => m.from === 'family' && !m.readByJean).length
      return { ...contact, lastMessage, unread }
    })
    rooms.sort((a, b) => b.unread - a.unread)
    res.json(rooms)
  })

  // ── Socket.IO ──────────────────────────────────────────────
  let jeanSocket     = null
  let launcherSocket = null
  let adminSocket    = null

  io.on('connection', (socket) => {

    socket.on('jean-connect', ({ pin }) => {
      // No PIN configured means auth would be an empty-string match — reject
      // outright instead of letting anyone on the LAN connect as Jean.
      if (!jeanPin) { socket.emit('auth-error', 'Messages is not set up yet. Please ask your helper to set a PIN in the settings.'); return }
      const clientIP = socketIP(socket)
      if (isPinRateLimited(clientIP)) { socket.emit('auth-error', 'Too many attempts. Please wait 15 minutes and try again.'); return }
      if (!safeEqual(pin, jeanPin)) { recordPinFailure(clientIP); socket.emit('auth-error', 'Wrong PIN. Please try again.'); return }
      if (jeanSocket && jeanSocket.id !== socket.id)
        jeanSocket.emit('session-replaced', "You opened Jean's chat in another window.")
      jeanSocket = socket; socket.isJean = true
      socket.emit('jean-authenticated')
      io.emit('jean-status', { online: true })
    })

    socket.on('family-connect', async ({ roomId, pin, token }) => {
      const contact  = db.findContact(roomId)
      if (!contact) { socket.emit('auth-error', 'This chat link is not valid or has been removed.'); return }
      const clientIP = socketIP(socket)

      if (contact.pin) {
        if (token) {
          if (!safeEqual(token, contact.sessionToken)) { socket.emit('auth-error', 'Your session has expired. Please enter your PIN again.'); return }
        } else if (pin) {
          if (isPinRateLimited(clientIP)) { socket.emit('auth-error', 'Too many attempts. Please wait 15 minutes and try again.'); return }
          if (!safeEqual(pin, contact.pin)) { recordPinFailure(clientIP); socket.emit('auth-error', 'Incorrect PIN. Please try again.'); return }
        } else {
          socket.emit('pin-required'); return
        }
      }

      // Always hand over the session token (not just on the PIN path) — the
      // browser needs it as the x-session-token header to fetch /api/messages
      // history; without it PIN-less contacts and token re-auths only ever see
      // messages that arrive while their socket happens to be connected.
      socket.emit('auth-token', { token: contact.sessionToken })

      const contacts = db.getContacts()
      const idx      = contacts.findIndex(c => c.id === contact.id)
      if (idx !== -1) {
        if (!contacts[idx].allowedIP) {
          contacts[idx].allowedIP = clientIP
          db.saveContacts(contacts)
        } else if (contacts[idx].allowedIP !== clientIP) {
          const alert = db.addAlert({ type: 'ip-change', contactName: contact.name, contactId: contact.id, knownIP: contacts[idx].allowedIP, newIP: clientIP })
          sendDiscordAlert(contact.name, contacts[idx].allowedIP, clientIP).catch(() => {})
          if (adminSocket) adminSocket.emit('security-alert', alert)
        }
      }

      socket.roomId  = contact.roomId
      socket.contact = contact
      socket.join(contact.roomId)
      socket.emit('family-authenticated', { name: contact.name })
      // Hand the browser its ICE servers (STUN + TURN if configured) so video
      // calls can traverse NAT — the page has no other authenticated way to get them
      socket.emit('ice-config', { iceServers: buildIceServers() })
      if (jeanSocket) jeanSocket.emit('contact-online', { roomId: contact.roomId, name: contact.name })
    })

    socket.on('admin-connect', ({ password }) => {
      // Truthiness guard: an unset adminPassword ('') must never match an
      // empty/unset password from the client — otherwise the default,
      // pre-setup config grants admin socket access to anyone who connects.
      if (!adminPassword || !safeEqual(password, adminPassword)) return
      adminSocket = socket; socket.isAdmin = true
      socket.emit('alerts-update', db.getAlerts())
    })

    // Launcher registers using the same authToken stored in electron-store.
    // Since server and launcher share a process, the token always matches — TOFU is bypassed.
    socket.on('register', ({ deviceId, authToken }) => {
      if (launcherAuthToken && !safeEqual(authToken, launcherAuthToken)) {
        socket.emit('auth-error', 'Launcher token mismatch.')
        return
      }
      launcherSocket = socket; socket.isLauncher = true
      console.log(`[messenger] Launcher registered (device: ${deviceId})`)
    })

    socket.on('jean-message', ({ roomId, text }) => {
      if (!socket.isJean || !text?.trim()) return
      const message = { id: crypto.randomBytes(6).toString('hex'), from: 'jean', name: 'Jean', text: text.trim(), timestamp: new Date().toISOString() }
      db.saveMessage(roomId, message)
      socket.to(roomId).emit('new-message', { roomId, message })
      socket.emit('message-sent', { roomId, message })
    })

    socket.on('jean-broadcast', ({ text }) => {
      if (!socket.isJean || !text?.trim()) return
      const contacts = db.getContacts()
      contacts.forEach(contact => {
        const message = { id: crypto.randomBytes(6).toString('hex'), from: 'jean', name: 'Jean', text: text.trim(), timestamp: new Date().toISOString(), broadcast: true }
        db.saveMessage(contact.roomId, message)
        socket.to(contact.roomId).emit('new-message', { roomId: contact.roomId, message })
      })
      socket.emit('broadcast-sent', { text, count: contacts.length })
    })

    socket.on('family-message', ({ text }) => {
      if (!socket.roomId || !text?.trim()) return
      const message = { id: crypto.randomBytes(6).toString('hex'), from: 'family', name: socket.contact.name, text: text.trim(), timestamp: new Date().toISOString(), readByJean: false }
      db.saveMessage(socket.roomId, message)
      if (jeanSocket) jeanSocket.emit('new-message', { roomId: socket.roomId, message })
      socket.emit('message-sent', message)
    })

    socket.on('family-radio-upload', (payload) => {
      if (!socket.isJean && !socket.roomId) return
      if (!isFamilyRadioEnabled()) {
        socket.emit('family-radio-upload-result', { ok: false, error: 'Family Radio is turned off right now.' })
        return
      }
      const senderName = socket.isJean ? 'Jean' : socket.contact.name
      const result = saveRadioUpload(senderName, payload || {})
      if (result.error) { socket.emit('family-radio-upload-result', { ok: false, error: result.error }); return }
      if (launcherSocket) launcherSocket.emit('family-radio-new', result.clip)
      socket.emit('family-radio-upload-result', { ok: true })
    })

    socket.on('jean-open-room', ({ roomId }) => {
      if (!socket.isJean) return
      db.markRoomAsRead(roomId)
      socket.to(roomId).emit('jean-read')
    })

    socket.on('typing-start',          () => { if (!socket.isJean && socket.roomId && jeanSocket) jeanSocket.emit('contact-typing',         { roomId: socket.roomId, name: socket.contact.name }) })
    socket.on('typing-stop',           () => { if (!socket.isJean && socket.roomId && jeanSocket) jeanSocket.emit('contact-stopped-typing', { roomId: socket.roomId }) })
    socket.on('jean-typing',           ({ roomId }) => { if (socket.isJean) socket.to(roomId).emit('jean-typing') })
    socket.on('jean-stopped-typing',   ({ roomId }) => { if (socket.isJean) socket.to(roomId).emit('jean-stopped-typing') })

    socket.on('call-jean', ({ offer }) => {
      if (!socket.roomId || !socket.contact) return
      if (!launcherSocket) { socket.emit('call-failed', { reason: "Jean's device is not connected." }); return }
      launcherSocket.emit('incoming-video-call', { from: socket.id, callerName: socket.contact.name, offer })
    })
    socket.on('call-answer',    ({ to, answer })   => { if (socket.isLauncher) io.to(to).emit('call-answered', { answer }) })
    socket.on('ice-candidate',  ({ to, candidate }) => {
      if (socket.isLauncher) io.to(to).emit('ice-candidate', { from: socket.id, candidate })
      else if (launcherSocket) launcherSocket.emit('ice-candidate', { from: socket.id, candidate })
    })
    socket.on('call-ended',     ({ to }) => {
      if (socket.isLauncher && to) io.to(to).emit('call-ended', { from: socket.id })
      else if (launcherSocket) launcherSocket.emit('call-ended', { from: socket.id })
    })
    socket.on('call-declined',  ({ to }) => { io.to(to).emit('call-declined', { from: socket.id }) })

    socket.on('disconnect', () => {
      if (socket.isJean)          { jeanSocket = null;     io.emit('jean-status', { online: false }) }
      else if (socket.isLauncher) { launcherSocket = null }
      else if (socket.isAdmin)    { adminSocket = null }
      else if (socket.roomId && jeanSocket) jeanSocket.emit('contact-offline', { roomId: socket.roomId })
    })
  })

  // ── Start listening ────────────────────────────────────────
  await new Promise((resolve, reject) => {
    httpServer.listen(port, '0.0.0.0', resolve)
    httpServer.on('error', reject)
  })
  console.log(`[messenger] Running on port ${port}`)

  return {
    stop() {
      return new Promise(resolve => { io.close(); httpServer.close(resolve) })
    },
    // Apply changed credentials without restarting the server. Called when the
    // admin panel saves messenger settings (e.g. a new PIN).
    updateConfig(next = {}) {
      if (next.jeanPin           !== undefined) jeanPin           = next.jeanPin           || ''
      if (next.adminPassword     !== undefined) adminPassword     = next.adminPassword     || ''
      if (next.discordWebhookUrl !== undefined) discordWebhookUrl = next.discordWebhookUrl || ''
      if (next.turn              !== undefined) turnConfig        = {
        url:        next.turn.url        || '',
        username:   next.turn.username   || '',
        credential: next.turn.credential || ''
      }
      if (next.twilio             !== undefined) twilioConfig      = {
        accountSid:     next.twilio.accountSid     || '',
        authToken:      next.twilio.authToken      || '',
        from:           next.twilio.from           || '',
        caregiverPhone: next.twilio.caregiverPhone || ''
      }
    },
    // Reach family over every configured channel when Jean presses Help.
    // Exposed so ipc.js can call it directly (same process, no HTTP hop).
    sendHelpAlert,
    // Mirror the launcher's contact list (electron-store) into messenger
    // contacts. The Electron admin panel is the only contact UI in practice —
    // without this sync a slug typed there never exists on the server and the
    // family link 404s. Contacts created here are tagged managedBy:'launcher'
    // and removed again when their slug disappears from the launcher list;
    // contacts made via the web /admin page are left untouched.
    syncContacts(launcherContacts = []) {
      const contacts = db.getContacts()
      const seen     = new Set()
      let   changed  = false

      for (const lc of launcherContacts) {
        const slug = (lc?.slug || '').trim().toLowerCase().replace(/[^a-z0-9-]/g, '')
        if (!slug || seen.has(slug)) continue
        seen.add(slug)

        const existing = contacts.find(c => c.slug === slug)
        if (!existing) {
          contacts.push({
            id:           crypto.randomBytes(4).toString('hex'),
            name:         (lc.name || slug).trim(),
            phone:        (lc.phone || '').replace(/[^0-9+\-() ]/g, '').trim(),
            roomId:       crypto.randomBytes(12).toString('hex'),
            slug,
            pin:          (lc.messengerPin || '').trim() || null,
            allowedIP:    null,
            sessionToken: crypto.randomBytes(16).toString('hex'),
            createdAt:    new Date().toISOString(),
            managedBy:    'launcher'
          })
          changed = true
        } else {
          const name = (lc.name || '').trim()
          if (name && existing.name !== name) { existing.name = name; changed = true }
          const pin = (lc.messengerPin || '').trim() || null
          if (existing.pin !== pin) {
            existing.pin = pin
            existing.sessionToken = crypto.randomBytes(16).toString('hex') // old sessions must re-auth
            changed = true
          }
        }
      }

      const kept = contacts.filter(c => c.managedBy !== 'launcher' || seen.has(c.slug))
      if (kept.length !== contacts.length) changed = true
      if (changed) db.saveContacts(kept)
      return changed
    }
  }
}
