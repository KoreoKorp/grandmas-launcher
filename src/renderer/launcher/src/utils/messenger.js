// Shared by MessagesView (contact grid) and the home-screen "Call {name}"
// tiles — both need to open the same contact's chat through the embedded
// messenger the same validated way, so the URL-building and slug
// sanitization live here once instead of twice.

/**
 * Open `contact`'s chat in the embedded browser.
 * @param {{ name: string, slug?: string }} contact
 * @param {string} messengerBase - the embedded server URL (http://localhost:<port>)
 * @param {(type: string, detail?: string) => void} [logActivity] - defaults to window.launcher.logActivity
 */
export function openContactChat(contact, messengerBase, logActivity = window.launcher.logActivity) {
  const slug = contact.slug?.trim()

  // Security: only allow [a-z0-9_-] slugs, even if store data is unexpected
  const safeSlug = slug ? slug.replace(/[^a-z0-9_-]/g, '') : ''

  // messengerBase is the embedded server URL. If it's absent the server
  // isn't up — bail rather than opening the live site.
  let base = (messengerBase || '').trim()
  if (!base) {
    logActivity('messenger-unavailable', contact.name)
    return false
  }
  if (!base.startsWith('http://') && !base.startsWith('https://')) {
    base = `https://${base}`
  }
  base = base.replace(/\/+$/, '')

  const url = safeSlug ? `${base}/?room=${safeSlug}` : base

  window.launcher.openUrl(url, false, 'persist:launcher')
  logActivity('messenger-opened', contact.name)
  // No view change needed — openUrl triggers launcher:browser-opened
  // which App.jsx handles by switching to 'browser' view
  return true
}
