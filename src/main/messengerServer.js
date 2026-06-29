import express    from 'express'
import http       from 'http'
import { Server } from 'socket.io'
import path       from 'path'
import fs         from 'fs'
import crypto     from 'crypto'

// ── Helpers ───────────────────────────────────────────────────

function makeDataHelpers(dataDir) {
  const MESSAGES_DIR  = path.join(dataDir, 'messages')
  const CONTACTS_FILE = path.join(dataDir, 'contacts.json')
  const ALERTS_FILE   = path.join(dataDir, 'alerts.json')

  fs.mkdirSync(MESSAGES_DIR, { recursive: true })
  if (!fs.existsSync(CONTACTS_FILE)) fs.writeFileSync(CONTACTS_FILE, '[]')
  if (!fs.existsSync(ALERTS_FILE))   fs.writeFileSync(ALERTS_FILE,   '[]')

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

  return { getContacts, saveContacts, findContact, getMessages, saveMessage, markRoomAsRead, getAlerts, saveAlerts, addAlert }
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
    jeanPin         = '',
    adminPassword   = '',
    launcherAuthToken = '',
    discordWebhookUrl = '',
    turn   = {},
    twilio = {}
  } = config

  if (!jeanPin)       console.warn('[messenger] jeanPin not set — Jean auth disabled')
  if (!adminPassword) console.warn('[messenger] adminPassword not set — admin auth disabled')

  const db = makeDataHelpers(dataDir)

  // ── Discord webhook ────────────────────────────────────────
  async function sendDiscordAlert(contactName, knownIP, newIP) {
    if (!discordWebhookUrl) return
    try {
      await fetch(discordWebhookUrl, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          embeds: [{
            title:       "⚠️ Security Alert — Jean's Messenger",
            description: `**${contactName}** connected from a new IP address.\n\n` +
                         `**Known IP:** \`${knownIP}\`\n**New IP:** \`${newIP}\`\n\n` +
                         `They have been **allowed through**. If this wasn't ${contactName}, open the admin panel → find their contact → click **Clear IP**.`,
            color:     0xFF4444,
            timestamp: new Date().toISOString()
          }]
        })
      })
    } catch (e) { console.error('[messenger] Discord webhook failed:', e.message) }
  }

  // ── PIN rate limiting ──────────────────────────────────────
  const pinAttempts = new Map()
  function checkPinRateLimit(ip) {
    const now    = Date.now()
    const record = pinAttempts.get(ip) || { count: 0, since: now }
    if (now - record.since > 15 * 60 * 1000) { pinAttempts.set(ip, { count: 1, since: now }); return true }
    if (record.count >= 10) return false
    record.count++
    pinAttempts.set(ip, record)
    return true
  }

  // ── Express + Socket.IO ────────────────────────────────────
  const expressApp = express()
  const httpServer = http.createServer(expressApp)
  const io         = new Server(httpServer, { cors: { origin: '*' } })

  expressApp.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-admin-key, x-jean-pin, x-session-token')
    if (req.method === 'OPTIONS') return res.sendStatus(204)
    next()
  })
  expressApp.use(express.json())
  expressApp.use(express.static(publicDir))

  function requireAdmin(req, res, next) {
    const key = req.headers['x-admin-key']
    if (!key || key !== adminPassword) return res.status(401).json({ error: 'Unauthorized' })
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

  // ── TURN credentials ───────────────────────────────────────
  expressApp.get('/api/turn', requireAdmin, (req, res) => {
    if (!turn.url && !turn.username && !turn.credential) return res.json({ iceServers: [] })
    res.json({
      turnUrl: turn.url, turnUsername: turn.username, turnCredential: turn.credential,
      iceServers: [{ urls: `turn:${turn.url}`, username: turn.username, credential: turn.credential }]
    })
  })

  // ── SMS system report ──────────────────────────────────────
  expressApp.post('/send-sys-report', requireAdmin, async (req, res) => {
    const { accountSid, authToken: twilioAuth, from, caregiverPhone } = twilio
    if (!accountSid || !twilioAuth || !from || !caregiverPhone) {
      return res.json({ ok: false, reason: 'Twilio not configured' })
    }
    const { message } = req.body
    try {
      const r = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
        method: 'POST',
        headers: {
          'Authorization':  'Basic ' + Buffer.from(`${accountSid}:${twilioAuth}`).toString('base64'),
          'Content-Type':   'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({ To: caregiverPhone, From: from, Body: message }).toString()
      })
      if (!r.ok) { const e = await r.json(); return res.json({ ok: false, reason: e.message || r.statusText }) }
      res.json({ ok: true })
    } catch (e) { res.json({ ok: false, reason: e.message }) }
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
    const isAdmin  = req.headers['x-admin-key']      === adminPassword
    const isFamily = req.headers['x-session-token']  === contact.sessionToken
    const isJean   = req.headers['x-jean-pin']       === jeanPin
    if (!isAdmin && !isFamily && !isJean) return res.status(401).json({ error: 'Unauthorized' })
    res.json(db.getMessages(contact.roomId))
  })

  expressApp.get('/api/jean/rooms', (req, res) => {
    if (req.headers['x-jean-pin'] !== jeanPin) return res.status(401).json({ error: 'Unauthorized' })
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
      if (pin !== jeanPin) { socket.emit('auth-error', 'Wrong PIN. Please try again.'); return }
      if (jeanSocket && jeanSocket.id !== socket.id)
        jeanSocket.emit('session-replaced', "You opened Jean's chat in another window.")
      jeanSocket = socket; socket.isJean = true
      socket.emit('jean-authenticated')
      io.emit('jean-status', { online: true })
    })

    socket.on('family-connect', async ({ roomId, pin, token }) => {
      const contact  = db.findContact(roomId)
      if (!contact) { socket.emit('auth-error', 'This chat link is not valid or has been removed.'); return }
      const clientIP = ((socket.handshake.headers['x-forwarded-for'] || '').split(',')[0].trim())
        || socket.handshake.address

      if (contact.pin) {
        if (token) {
          if (token !== contact.sessionToken) { socket.emit('auth-error', 'Your session has expired. Please enter your PIN again.'); return }
        } else if (pin) {
          if (!checkPinRateLimit(clientIP)) { socket.emit('auth-error', 'Too many attempts. Please wait 15 minutes and try again.'); return }
          if (pin !== contact.pin) { socket.emit('auth-error', 'Incorrect PIN. Please try again.'); return }
          socket.emit('auth-token', { token: contact.sessionToken })
        } else {
          socket.emit('pin-required'); return
        }
      }

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
      if (jeanSocket) jeanSocket.emit('contact-online', { roomId: contact.roomId, name: contact.name })
    })

    socket.on('admin-connect', ({ password }) => {
      if (password !== adminPassword) return
      adminSocket = socket; socket.isAdmin = true
      socket.emit('alerts-update', db.getAlerts())
    })

    // Launcher registers using the same authToken stored in electron-store.
    // Since server and launcher share a process, the token always matches — TOFU is bypassed.
    socket.on('register', ({ deviceId, authToken }) => {
      if (launcherAuthToken && authToken !== launcherAuthToken) {
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
    }
  }
}
