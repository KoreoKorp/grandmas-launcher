import SmartCast from 'vizio-smart-cast'

let tv = null
let currentIp = null
let currentToken = null
let pairingRequestToken = ''
let deviceId = 'grandmas-launcher'
let deviceName = "Grandma's Launcher"

export function getTvStatus() {
  return {
    paired: !!tv && !!currentToken,
    ip: currentIp || null,
    name: 'Vizio TV',
    model: null
  }
}

export function loadCredentials(ip, token) {
  currentIp = ip
  currentToken = token
  if (ip) {
    tv = new SmartCast(ip, token || '')
    return true
  }
  return false
}

export function clearCredentials() {
  tv = null
  currentIp = null
  currentToken = null
  pairingRequestToken = ''
}

export async function discoverTVs() {
  return new Promise((resolve) => {
    const found = []
    const seen = new Set()

    try {
      SmartCast.discover(
        (device) => {
          if (device && device.ip && !seen.has(device.ip)) {
            seen.add(device.ip)
            found.push({
              ip: device.ip,
              name: device.name || 'Vizio TV',
              model: device.model || '',
              manufacturer: device.manufacturer || 'VIZIO'
            })
          }
        },
        () => {},
        4000
      )
    } catch (err) {
      console.error('[tvService] discovery error:', err.message)
    }

    setTimeout(() => resolve(found), 4500)
  })
}

export async function startPairing(ip) {
  currentIp = ip
  tv = new SmartCast(ip, '')

  const result = await tv.pairing.initiate(deviceName, deviceId)

  if (result && result.ITEM) {
    pairingRequestToken = result.ITEM.PAIRING_REQ_TOKEN || ''
    return { success: true, challengeType: result.ITEM.CHALLENGE_TYPE || 1 }
  }

  throw new Error('Pairing initiation failed')
}

export async function completePairing(pin) {
  if (!tv || !currentIp) throw new Error('No TV initialized')

  const result = await tv.pairing.pin(pin, deviceId, pairingRequestToken)

  if (result && result.ITEM && result.ITEM.AUTH_TOKEN) {
    currentToken = result.ITEM.AUTH_TOKEN
    tv.pairing.useAuthToken(currentToken)
    return { success: true, authToken: currentToken }
  }

  throw new Error('Pairing failed — check the PIN')
}

export async function powerOn() {
  await retry(() => tv.control.power.on())
  return { ok: true }
}

export async function powerOff() {
  await retry(() => tv.control.power.off())
  return { ok: true }
}

export async function volumeUp() {
  await retry(() => tv.control.volume.up())
  return { ok: true }
}

export async function volumeDown() {
  await retry(() => tv.control.volume.down())
  return { ok: true }
}

export async function mute() {
  await retry(() => tv.control.volume.toggleMute())
  return { ok: true }
}

export async function channelUp() {
  await retry(() => tv.control.channel.up())
  return { ok: true }
}

export async function channelDown() {
  await retry(() => tv.control.channel.down())
  return { ok: true }
}

export async function setInput(inputName) {
  await retry(() => tv.input.set(inputName))
  return { ok: true }
}

export async function getCurrentInput() {
  const result = await retry(() => tv.input.current())
  if (result && result.ITEMS && result.ITEMS[0]) {
    return { input: result.ITEMS[0].VALUE || result.ITEMS[0].NAME || 'Unknown' }
  }
  return { input: 'Unknown' }
}

export async function getPowerState() {
  try {
    const result = await retry(() => tv.control.power.currentMode())
    const mode = result?.ITEMS?.[0]?.VALUE
    return { power: mode === 1 || mode === 'ON' || mode === true }
  } catch {
    return { power: null }
  }
}

export async function launchApp(appId) {
  const appMap = {
    'netflix': { id: '1', message: 'https://www.netflix.com' },
    'youtube': { id: '3', message: 'https://www.youtube.com' },
    'hulu': { id: '7', message: 'https://www.hulu.com' },
    'disneyplus': { id: '101', message: 'https://www.disneyplus.com' },
    'prime': { id: '17', message: 'https://www.amazon.com/gp/video' },
    'amazon': { id: '17', message: 'https://www.amazon.com/gp/video' }
  }

  const app = appMap[appId?.toLowerCase()]
  if (!app) return { ok: false, error: 'App not supported' }

  await retry(() => tv.app.launch(app.message, app.id, 4))
  return { ok: true }
}

async function retry(fn, attempts = 3, delay = 300) {
  let lastErr
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn()
    } catch (err) {
      lastErr = err
      if (i < attempts - 1) await new Promise(r => setTimeout(r, delay))
    }
  }
  throw lastErr
}
