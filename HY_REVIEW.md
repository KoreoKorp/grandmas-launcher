# Grandma's Launcher — Code Review

A dementia-friendly Windows Electron kiosk. The architecture (contextIsolation, separate main/preload/renderer, hardened `BrowserView` for embedded web) is largely sound, but there are **serious security flaws** and several **reliability bugs that soft-lock the UI** for a non-technical user.

Review performed by 10 parallel review agents covering: main process core, main process services, preload bridges, launcher views, launcher components (A & B), admin views, admin settings, static resources + build config, and a cross-cutting security audit.

---

## Critical

### 1. Messenger server binds `0.0.0.0` with an empty-default admin password — open to the LAN/tunnel
`messengerServer.js:267, 291-295, 552` + `store.js:51`. `requireAdmin` does `if (!key || key !== adminPassword) → 401`, but with the default `adminPassword: ''`, an empty `x-admin-key` *passes*. So `/api/contacts`, `/api/alerts`, TURN creds, `send-sys-report`, and socket `admin-connect` are all reachable by anyone on the network or via the Cloudflare tunnel. Family contacts with no PIN are also readable/writable by anyone who knows the slug (`messengerServer.js:507`).

**Fix:** Force a setup PIN before starting; treat empty password as "deny"; bind to `127.0.0.1` (expose only through the tunnel).

### 2. Kiosk breakout via the Games `<webview>`
`GamesView.jsx:73-79` + `windows.js:52`. The online-games tab loads `games.onlineUrl` in a `<webview>` with `allowpopups="true"` and **no** `will-navigate`/`will-redirect`/`new-window` guard — unlike `openEmbeddedBrowser`, which rigorously blocks non-http(s) protocols. This lets embedded ad content spawn a normal window or navigate to `file://`/OS protocols.

**Fix:** Route games through `openEmbeddedBrowser`, or attach the same protocol guards; remove `allowpopups`.

### 3. Remote config can push RCE-capable tiles
`index.js:153-202` + `ipc.js:191-238`. `syncRemoteConfig` fetches an unauthenticated remote JSON every 5 min and validates only that each tile has string `id`/`label`. A tile `{type:'app', target:'C:\\...\\evil.exe'}` passes and `launchApp` will `spawn` it (and the app runs elevated).

**Fix:** Reject `app`/`call` types and non-http(s) targets from remote sync; pin/verify the remote source.

### 4. Secrets sprayed to the kiosk renderer
`ipc.js:115` spreads the whole `messenger` object (admin password, Twilio token, caregiver phone, TURN creds) into `launcher:get-config`; `ipc.js:513/529` ship the *entire* `store.store` to the launcher via `launcher:config-updated`. The launcher embeds untrusted web content (Pinterest, news, YouTube). `admin:get-config` (`ipc.js:470`) also returns all secrets.

**Fix:** Send only non-secret fields to the launcher; mirror the redaction done in `launcher:get-config`.

---

## High

- **Plaintext secret storage** (`store.js` everywhere): OpenRouter key, Twilio token, admin password, TURN credential, `authToken` all sit unencrypted in electron-store. Encrypt at rest (electron `safeStorage`/DPAPI) and hash the admin PIN.
- **No renderer sandbox** (`windows.js:47-53, 89-94`; `ipc.js:804-809`): untrusted web content renders with the Chromium sandbox disabled. Set `sandbox: true` (preloads use only `contextBridge`/`ipcRenderer`).
- **`admin.html` XSS** (`resources/messenger-public/admin.html:370, 542, 560-566`): contact names are interpolated *unescaped* into inline `onclick=` attributes (and `escHtml` doesn't escape single quotes). Runs in the admin's authenticated session. Also **no CSP** on any served page (`jean.html`/`family.html`/`admin.html`).
- **Online Games tab permanently stuck on "Loading…"** (`GamesView.jsx:29-35, 66-80`): the `did-finish-load` listener effect runs once while the default `local` tab is active, so the webview listener never attaches when the user switches to Online.
- **WebRTC ICE candidates dropped before `setRemoteDescription`** (`App.jsx:107-115`): candidates arriving between peer creation and remote-description setup are added to a not-yet-ready `RTCPeerConnection` and silently lost → calls may never connect.
- **No CSP on the launcher/admin `index.html`** while embedding `<iframe>`/`<webview>`/BrowserView tiles (`launcher/index.html`).
- **Plaintext credential export** (`CaregiverHandoff.jsx:8-18`): a caregiver handoff file serializes `adminPin`, contact PINs, Twilio, and OpenRouter key in clear text.

---

## Medium

- **GamesView launcher: `launch-app` spawns arbitrary paths** with no allow-list (`ipc.js:191-238`); the `^[a-z0-9-]+\.(com|org|net|io|co)` heuristic also misclassifies `update.com` as a website (`ipc.js:193`).
- **VideoCallOverlay "Connecting…" can hang forever** with no timeout/error path (`VideoCallOverlay.jsx:8-34`); ensure camera/mic `track.stop()` on hang-up.
- **IncomingCallOverlay: "Not Now" still auto-connects** (`IncomingCallOverlay.jsx:67-72`) — decline doesn't set `answered.current`, so the 3s auto-answer timer still fires. Also a side effect inside a `setCountdown` updater (`IncomingCallOverlay.jsx:40-52`) can double-fire.
- **Sidebar reminder re-pops every 60s** after dismiss (`Sidebar.jsx:29-43`) — dismissals aren't persisted, blocking the sidebar for a confused user.
- **`speech.js` `cancel()`→`speak()` race** (`speech.js:20,27-28`): interrupting TTS can silently drop the next utterance (Chromium bug) — "Read aloud" feels broken.
- **Admin PIN gated client-side only** (`admin/App.jsx:82-90`) — the real PIN is returned to the renderer; DevTools bypasses the gate. Verify in main process.
- **`admin.html`/messenger clients store PIN/token in `localStorage`** (plaintext, XSS-readable).
- **`MessengerSettings` ships Twilio/TURN/Discord secrets into renderer state** (`MessengerSettings.jsx:8-10,27,32-43`) and Discord webhook is rendered as plain text. Use boolean "configured" flags (like `DisplaySettings`).
- **`MessengerSettings` silent data loss** (`saveTurn`/`saveHelpAlerts` each rewrite the whole `messenger` object from stale props).
- **`admin:set` / `config:restore` accept arbitrary keys** (`ipc.js:490`, `CaregiverHandoff.jsx:41-44`) — no allow-list.
- **Elevated `requestedExecutionLevel: highestAvailable`** (`package.json:64`) widens blast radius; prefer `asInvoker` under a locked-down kiosk account.
- **No code signing** configured (`package.json`) → SmartScreen warnings, no integrity guarantee.
- **Watchdog kills by process *name* (wildcard) + uptime-only grace** (`watchdog.ps1:47-53, 32-38`): can kill unrelated processes and can kill a healthy kiosk right after sleep/resume (the resume race the comments acknowledge is not actually handled). Match by exact executable path/PID from the heartbeat.
- **No signature/TLS pinning** on the remote config JSON (`index.js:153-202`).

---

## Low (sample)

- `BuddyMascot.jsx:22-32` re-renders the SVG ~60×/sec via `setState` — move bob to CSS.
- `FamilyRadioOverlay.jsx:33-37` autoplay likely blocked by Electron autoplay policy.
- `Tile.jsx`/`BuddyFloat.jsx` untracked `setTimeout`s after unmount.
- `index.js` PowerShell auto-start quoting fragility (`index.js:327-345`) — use `-EncodedCommand`.
- `adBlocker.js` filter engine never refreshed; `tvService.js` UDP discovery socket may leak.
- `messengerServer.js` uses `!==` for secret compare (use `timingSafeEqual`); `express.json()` has no explicit body limit.
- Various `Date.now()` used as entity IDs (collisions), stale `target` on tile-type switch, unmounted-setState in Photos/Games.
- `admin.html` family slug is the primary room identifier with no revocation/rotation support (C3) — document trust model.
- `watchdog.ps1` relaunch is fire-and-forget with no backoff/retry cap (D4).

---

## Top priorities to fix first

1. Lock down the messenger server (bind loopback, require a setup password) — Critical #1.
2. Remove/kill the unguarded Games `<webview>` escape — Critical #2.
3. Stop sending secrets to the launcher renderer and encrypt secrets at rest — Critical #4 / High.
4. Harden remote-config validation (block `app` tiles + non-http targets) — Critical #3.
5. Patch the Games loading bug, ICE-candidate queue, and IncomingCall auto-answer — High/Medium reliability.

---

## Strengths

- `contextIsolation: true` + `nodeIntegration: false` everywhere; `BrowserView` preload exposes no IPC to embedded pages.
- `openEmbeddedBrowser` correctly blocks non-http(s) protocols and denies new windows.
- `isSafeNavigationProtocol` escape-recovery routes to the familiar ConfusionOverlay.
- No `dangerouslySetInnerHTML`; dynamic data is React-escaped across renderers.
- Volume enforcement uses `-EncodedCommand` with clamped numeric input (no injection).
- AmbientBackground / ConfusionOverlay / HelpOverlay clean up their listeners and timers.

**Overall:** the codebase is well-commented and thoughtfully designed for its audience, but the security gaps (open LAN server, kiosk breakout, secret exposure) are severe enough to warrant immediate attention before any networked deployment.
