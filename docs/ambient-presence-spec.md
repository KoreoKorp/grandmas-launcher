# Ambient Presence & Comfort — Feature Spec

Status: **Draft / approved for build**
Source: multi-model brainstorm (Claude, Hy3, opencode), curated by owner.

This spec covers five features that extend grandma's launcher toward two goals:
**presence** (family feels close without asking anything of her) and **comfort**
(the interface adapts to her state and the time of day). One feature — Shadow
Boot — is explicitly **parked** and documented at the end for later exploration.

All five respect the product's core rules: zero-navigation, no error/crash/dead-end
ever visible to grandma, caregiver-managed from afar, LAN-based, runs unattended
for months on cheap hardware.

---

## 0. Architecture foundation (read first)

Three of the five features — **Phantom Knock**, **Magic Photo Frame**, and
**Remote Nudge** — are the same shape: *a family/caregiver device pushes
something that appears transiently or ambiently on grandma's idle home screen.*
They should share one mechanism rather than three parallel ones.

That mechanism already exists in embryo as **Family Radio**:

- `src/main/messengerServer.js` — in-process express + socket.io server bound on
  the LAN; senders load `resources/messenger-public/family.html`; the launcher
  registers as `launcherSocket` and receives pushes (`family-radio-new`).
- `src/main/store.js` — config/settings (default-on pattern: `x !== false`).
- `src/preload/launcher.js` + `src/main/ipc.js` — bridge main → renderer.
- `src/renderer/launcher/src/components/FamilyRadioOverlay.jsx` — the idle-screen
  overlay that renders pushed clips; mounted from `HomeView.jsx`.

**Design decision:** generalize the Family Radio push into a single
**"idle presence event"** channel. Each event has a `kind`
(`radio` | `knock` | `photo` | `nudge`), a payload, and a display policy
(transient vs persistent, priority, dwell time). The server emits one
`presence-event` to `launcherSocket`; the renderer routes by `kind` to the right
presentation. This means Knock, Photo Frame, and Nudge are mostly *new payload
types + new presentation branches*, not new transport, auth, or wiring.

Reuse the existing `requireLauncher` token gate and the loopback-only media
rule already established for radio media.

---

## 1. Phantom Knock  🚪

**What:** A family member taps "Knock" on their sender page. Grandma's idle
screen briefly shows a warm animated front door with "**[Name] was thinking of
you**" and fades after ~10s. No call, no reply expected.

**Why for her:** Loneliness is often about *feeling* forgotten, not needing a
conversation. A knock is lower-pressure than a voice note and less intrusive than
a call — presence without obligation.

**UX:**
- Transient overlay, ~10s, gentle fade in/out, soft chime (respects volume
  enforcement / quiet hours — see Sundowning).
- Shows sender's name + optional avatar. No buttons. Auto-dismisses.
- If she's mid-interaction (not idle), queue it and show when she returns to home.

**Sender side (`family.html`):** one large "Knock 🚪" button. Rate-limited
per sender (e.g. max 1 knock / 15 min) so it stays meaningful.

**Data/privacy:** event carries only `{ from, timestamp }`. No media, nothing
persisted beyond a short caregiver-visible log ("Sarah knocked 3:04pm").

**Server:** `presence-event { kind: 'knock', from }` → `launcherSocket`.

**Tradeoff:** the family must understand a knock is *not* a notification she'll
answer. Cover this in the caregiver handoff wizard copy.

---

## 2. Magic Photo Frame  🖼️

**What:** Caregiver drops photos into a watched LAN folder (or sends from
`family.html`). The launcher detects new files, downscales them, and injects them
into the idle slideshow rotation. No upload button ever appears on grandma's side.

**Why for her:** Delight comes from novelty appearing "by itself" — a
great-grandchild's photo shows up like a gift, not a task.

**UX:**
- New photos join the ambient idle rotation (alongside Family Radio media).
  Optional soft "New photo from [Name]" caption on first appearance.
- Fully passive; she never manages it.

**Ingestion:**
- Watch a folder under the messenger server's media root (chokidar or a poll on
  cheap hardware — poll is fine, low frequency).
- On new file: validate type, downscale/re-encode to a low-res cap, store in the
  radio/presence media dir, register a `photo` presence item.

**Data/privacy & disk:** family media is PII. Serve via the existing
loopback-only media rule. **Enforce a retention cap** (e.g. purge photos older
than 90 days OR keep newest N) — this is the same unbounded-growth risk already
identified for radio clips; reuse/extend that cleanup path so cheap disks don't
fill.

**Tradeoff:** storage bloat if unbounded — retention policy is mandatory, not
optional.

---

## 3. Remote Nudge  🌞

**What:** Caregiver, from their panel, drops a small transient tile or swaps the
ambient wallpaper for the day — e.g. "Look outside! 🌞" or a chosen family photo
as the backdrop.

**Why for her:** Cheap, high-impact presence. Small surprises fight loneliness
better than features do.

**UX:**
- Two nudge types: (a) transient note tile on the home screen (dismisses on
  timeout or next idle cycle), (b) wallpaper-for-the-day swap (resets at
  midnight or on caregiver clear).
- Zero setup for grandma; it simply appears.

**Caregiver side:** control in the admin/caregiver panel. **Rate-limit to ~3
nudges/day** so it stays special, not intrusive.

**Server:** `presence-event { kind: 'nudge', noteText? , wallpaperMediaId? }`.

**Tradeoff:** over-use kills the magic — enforce the daily cap in the server, not
just the UI.

---

## 4. Sundowning Mode  🌆  (with easy on/off toggle)

**What:** In late afternoon/evening the whole interface shifts to a calmer state:
dimmer, warmer color temperature, fewer tiles, larger text, and a reassuring
anchor message ("It's evening. Everyone's home safe."). Addresses sundowning —
the real, time-predictable rise in agitation/confusion in cognitive decline,
which strikes right when the caregiver has logged off.

**Why for her:** The hardest emotional moment of the day is *predictable by the
clock*, so pre-empt it instead of reacting.

**Controls (explicitly required):**
- **Caregiver toggle** in settings: enable/disable Sundowning entirely, plus an
  adjustable onset time (default e.g. 17:30) and end time.
- **Easy manual override** so it's never "stuck on": a simple, discoverable way
  to flip it off/on for the moment (e.g. a single gentle control on the home
  screen, or caregiver remote toggle). Requirement from owner: turning it on and
  off must be trivial.
- Store as `store` config: `{ sundowning: { enabled, onset, end } }` with the
  default-on-or-off decision set to **default OFF** (opt-in — it presumes a
  condition she may not have).

**UX:**
- Cross-fade the theme over ~10s; never a jarring flip.
- Reduce tile count to a calm subset (caregiver-curated or a sensible default).

**Tradeoff:** depends on a reliable clock — harden against clock skew (the
watchdog/heartbeat work already touches system time). Because it can presume a
diagnosis, keep it caregiver opt-in with adjustable onset, never a silent default.

---

## 5. Guided Nostalgia  🎵

**What:** Occasionally the home screen offers one gentle reminiscence prompt:
"Do you remember this song?" plays a ~10s clip from a caregiver-chosen era/genre,
with two huge buttons: **"Yes"** and **"Show me more."** "Yes" / "Show me more"
slowly reveals a simple, calm page about that era or artist. A "No"/no-response
path returns to the calm home with a warm, no-failure message ("That's okay,
dear").

**Why for her:** Gentle reminiscence therapy can lift mood and is dignifying —
it respects her history instead of infantilizing her with only bubble games.

**UX & content:**
- Frequency: infrequent, ambient — not a forced session. Never blocks the home
  screen; it's an offer she can ignore.
- Two-button max, oversized, dwell/large-tap friendly.
- Content pack: caregiver selects era/genre; ship a small curated starter set.
  Clips must be short and licensed/owned to avoid rights issues.

**Tradeoff:** risk of confusion if she doesn't recognize the clip — the "No" /
timeout path must be instant, warm, and failure-free. Never score, never "wrong."

---

## Parked for later — Shadow Boot  💾 (not in this build)

USB-stick recovery image (rotating snapshot to a labeled stick; plug-in
auto-repair pulls latest config from the LAN) for when the cheap SSD dies.
Deferred by owner; documented so it isn't lost. Key open questions before it's
worth building: partition/boot approach on target hardware, how "plug the red
stick in" is communicated physically, and how much config vs full-image to carry.

---

## Build order (suggested)

1. **Idle presence event channel** — generalize Family Radio push (unlocks 1–3).
2. **Phantom Knock** — smallest payload, proves the channel end-to-end.
3. **Remote Nudge** — adds caregiver-panel controls + rate limiting.
4. **Magic Photo Frame** — adds folder watch + downscale + retention cap.
5. **Sundowning Mode** — independent; theme system + clock + toggle.
6. **Guided Nostalgia** — independent; content pack + reminiscence UI.

## Cross-cutting requirements

- Reuse `requireLauncher` auth + loopback-only media; no new unauth surfaces.
- Every media-producing feature (Photo Frame, Nudge wallpaper, Nostalgia clips)
  must have a **retention/cleanup policy** — cheap disks fill over months.
- Nothing here may ever show grandma an error, a dialog, or a dead end.
- Server-side enforcement of rate limits and enable/disable flags (not renderer-only).
