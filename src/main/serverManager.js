import { app }      from 'electron'
import path          from 'path'
import net           from 'net'
import { store, logActivity } from './store.js'
import { startServer } from './messengerServer.js'

let serverInstance = null
let activePort     = null

function findFreePort(startPort) {
  return new Promise((resolve, reject) => {
    const srv = net.createServer()
    srv.listen(startPort, '0.0.0.0', () => {
      const port = srv.address().port
      srv.close(() => resolve(port))
    })
    srv.on('error', () => {
      if (startPort >= 65535) return reject(new Error('No free port found'))
      resolve(findFreePort(startPort + 1))
    })
  })
}

export async function initMessengerServer() {
  const dataDir   = path.join(app.getPath('userData'), 'messenger-data')
  const publicDir = app.isPackaged
    ? path.join(process.resourcesPath, 'messenger-public')
    : path.join(app.getAppPath(), 'resources', 'messenger-public')

  const preferredPort = store.get('messenger.port') || 3456
  const port = await findFreePort(preferredPort)

  const messenger = store.get('messenger') || {}

  serverInstance = await startServer({
    dataDir,
    publicDir,
    port,
    jeanPin:           store.get('messenger.jeanPin')             || '',
    adminPassword:     store.get('messenger.adminPassword')       || '',
    launcherAuthToken: store.get('authToken')                     || '',
    discordWebhookUrl: store.get('messenger.discordWebhookUrl')   || '',
    turn: {
      url:        messenger.webrtc?.turnUrl        || '',
      username:   messenger.webrtc?.turnUsername   || '',
      credential: messenger.webrtc?.turnCredential || ''
    },
    twilio: {
      accountSid:     store.get('messenger.twilioAccountSid')    || '',
      authToken:      store.get('messenger.twilioAuthToken')     || '',
      from:           store.get('messenger.twilioFrom')          || '',
      caregiverPhone: store.get('messenger.caregiverPhone')      || ''
    }
  })

  activePort = port
  if (port !== preferredPort) {
    // Do NOT persist a drifted port: the Cloudflare tunnel origin is pinned to
    // the configured port (3456), so overwriting the stored value would make
    // every future boot prefer the drifted port and permanently break remote
    // family access. Run on the fallback port for this session and log loudly.
    console.warn(`[messenger] preferred port ${preferredPort} was busy — running on ${port}. Remote (tunnel) access is broken until ${preferredPort} is free again.`)
    logActivity('messenger-port-drift', `wanted ${preferredPort}, got ${port} — tunnel access degraded`)
  } else if (!store.get('messenger.port')) {
    store.set('messenger.port', port)
  }

  return port
}

export function getMessengerPort() { return activePort }

// Push changed messenger credentials (e.g. a new PIN) to the running server
// so they take effect immediately, without an app restart.
export function updateMessengerConfig(messenger = {}) {
  if (!serverInstance || typeof serverInstance.updateConfig !== 'function') return
  serverInstance.updateConfig({
    jeanPin:           messenger.jeanPin           || '',
    adminPassword:     messenger.adminPassword     || '',
    discordWebhookUrl: messenger.discordWebhookUrl || '',
    turn: {
      url:        messenger.webrtc?.turnUrl        || '',
      username:   messenger.webrtc?.turnUsername   || '',
      credential: messenger.webrtc?.turnCredential || ''
    }
  })
}

export function getMessengerUrl() {
  return activePort ? `http://localhost:${activePort}` : null
}

export async function stopMessengerServer() {
  if (serverInstance) {
    await serverInstance.stop()
    serverInstance = null
    activePort     = null
  }
}
