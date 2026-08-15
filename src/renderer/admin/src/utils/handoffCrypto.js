// Passphrase-based encryption for the caregiver handoff export/import.
//
// This file is explicitly meant to travel — to a new caregiver, a new
// machine, or an off-device backup — so it can't use Electron's safeStorage
// (that's tied to the encrypting machine's Windows user account and would
// make the export undecryptable anywhere else). A caregiver-chosen
// passphrase, run through PBKDF2 into an AES-GCM key, keeps the file
// portable while no longer sitting on disk as plain JSON with every
// password/PIN/API key readable in a text editor.
//
// Runs entirely via the Web Crypto API (available in the renderer, no
// main-process involvement needed for this).

const FORMAT = 'grandmas-launcher-encrypted-v1'
const PBKDF2_ITERATIONS = 250_000

function toBase64(buf) {
  return btoa(String.fromCharCode(...new Uint8Array(buf)))
}

function fromBase64(b64) {
  return Uint8Array.from(atob(b64), c => c.charCodeAt(0)).buffer
}

async function deriveKey(passphrase, salt) {
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(passphrase),
    'PBKDF2',
    false,
    ['deriveKey']
  )
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  )
}

/** Encrypt a config object into the exportable envelope shape. */
export async function encryptConfig(config, passphrase) {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const key = await deriveKey(passphrase, salt)
  const plaintext = new TextEncoder().encode(JSON.stringify(config))
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plaintext)
  return {
    format: FORMAT,
    salt: toBase64(salt),
    iv: toBase64(iv),
    ciphertext: toBase64(ciphertext)
  }
}

/** True if a parsed JSON file is one of our encrypted envelopes. */
export function isEncryptedEnvelope(parsed) {
  return !!parsed && typeof parsed === 'object' && parsed.format === FORMAT
}

/**
 * Decrypt an envelope back into the config object.
 * Throws if the passphrase is wrong (AES-GCM authentication fails) or the
 * file is corrupt — callers should catch and show a "wrong passphrase or
 * corrupt file" message rather than distinguishing the two, since AES-GCM
 * deliberately doesn't let you tell them apart.
 */
export async function decryptConfig(envelope, passphrase) {
  const salt = fromBase64(envelope.salt)
  const iv = fromBase64(envelope.iv)
  const key = await deriveKey(passphrase, salt)
  const plaintext = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: new Uint8Array(iv) },
    key,
    fromBase64(envelope.ciphertext)
  )
  return JSON.parse(new TextDecoder().decode(plaintext))
}
