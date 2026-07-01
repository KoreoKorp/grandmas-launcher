# grandmas-launcher

## Overview

Electron + React kiosk app designed for elderly users. Runs fullscreen on a TV or large monitor. A separate admin panel runs on a laptop screen for caregiver configuration.

## Stack

- Electron 32 + electron-vite
- React (two renderer processes: launcher + admin)
- electron-store for persistent config
- BrowserView for embedded web content
- Open-Meteo API (free, no key) for weather
- OpenRouter API for AI helper
- WebRTC for video calling
- Web Speech API for voice input / TTS

## Features Implemented

### Original 5
1. **Local games** — auto-discovers PopCap/MumboJumbo/GameFools .exe files via existsSync; displays with real .exe icons via app.getFileIcon()
2. **Pinterest ad removal** — CSS injection on every did-finish-load in BrowserView
3. **Improved weather** — feels-like, humidity, wind, high/low, 6-hour hourly strip
4. **Font scaling** — xxlarge (1.6x) option added
5. **AI helper** — OpenRouter-backed chat overlay with voice input (Web Speech API) and TTS readback

### Brainstorm additions
6. **Voice AI** — mic button + speechSynthesis readback in AIHelper
7. **Missed-call badge** — pulsing red dot on Messages tile, clears on open
8. **Press-confirmation animation** — spring bounce (scale 0.92) + amber glow on all tiles
9. **AI daily digest** — admin Caregiver Tools tab, generates 7-day activity summary via OpenRouter

## Security Model

- `contextIsolation: true`, `nodeIntegration: false`
- OpenRouter API key stored in main process only (electron-store or env var)
- Renderer only receives `ai: { available: boolean }`
- Admin panel has broader config access (appropriate — caregiver-facing)

## Key Files

- `src/main/ipc.js` — all IPC handlers
- `src/main/store.js` — electron-store config + migrations
- `src/main/weather.js` — Open-Meteo API integration
- `src/preload/launcher.js` — contextBridge for launcher renderer
- `src/preload/admin.js` — contextBridge for admin renderer
- `src/renderer/launcher/src/` — launcher React app
- `src/renderer/admin/src/` — admin React app
