# Messenger — Public Access Setup (Cloudflare Tunnel)

How remote family reaches Jean's messenger over the internet.

## Architecture

The messenger server is **embedded in the Electron app** (`src/main/messengerServer.js`,
started by `src/main/serverManager.js`). It listens on `http://localhost:3456` and only
runs while the launcher app is running.

Remote family can't reach `localhost`, so a **named Cloudflare Tunnel** exposes it at a
public HTTPS URL. The tunnel runs as an always-on Windows service, independent of the app.

```
Family browser ──HTTPS──> chat.jeankellmansmith.com ──Cloudflare edge──>
    cloudflared (Windows service) ──> http://localhost:3456 (embedded server, in the app)
```

- Jean's page:   `https://chat.jeankellmansmith.com/`
- Family chat:   `https://chat.jeankellmansmith.com/chat/<slug>`
- Admin panel:   `https://chat.jeankellmansmith.com/admin`

## Current configuration (already set up on Jean's PC)

- **Tunnel name:** `jean-messenger`
- **Tunnel UUID:** `d628ee46-2797-4c94-a2a0-7e3c8715f3e0`
- **Public hostname:** `chat.jeankellmansmith.com`
- **Origin:** `http://localhost:3456` (must match `messenger.port` in electron-store)
- **cloudflared binary:** `C:\Program Files (x86)\cloudflared\cloudflared.exe`
- **Config:** `C:\Users\jeale\.cloudflared\config.yml` (also copied to
  `C:\Windows\System32\config\systemprofile\.cloudflared\` for the LocalSystem service)

`config.yml`:
```yaml
tunnel: jean-messenger
credentials-file: C:\Users\jeale\.cloudflared\d628ee46-2797-4c94-a2a0-7e3c8715f3e0.json

ingress:
  - hostname: chat.jeankellmansmith.com
    service: http://localhost:3456
  - service: http_status:404
```

## The Windows service gotcha (important)

This cloudflared version's `service install` registers the service with **no run
arguments** (just the bare binary), so it starts and immediately exits — crash-looping.

**Fix** (already applied) — set the service command line explicitly in the registry:

```
HKLM:\SYSTEM\CurrentControlSet\Services\Cloudflared  ->  ImagePath =
"C:\Program Files (x86)\cloudflared\cloudflared.exe" --config "C:\Users\jeale\.cloudflared\config.yml" tunnel run jean-messenger
```

If the tunnel ever stops working after a cloudflared update, re-check this ImagePath first.

## Health checks

```bash
# Service running?
Get-Service cloudflared            # want: Running / Automatic

# Tunnel has active edge connections?
& 'C:\Program Files (x86)\cloudflared\cloudflared.exe' tunnel info jean-messenger

# Origin up locally (needs the launcher app running)?
curl http://127.0.0.1:3456/api/health      # want: {"ok":true}

# Public path end-to-end?
curl https://chat.jeankellmansmith.com/api/health   # want: HTTP 200 {"ok":true}
```

If the public check returns 200 but the page is blank/502, the **launcher app isn't
running** — the embedded server (origin) is only up while the app is open.

## Adding a family member

1. Open the admin panel (tray → Open Admin Panel, or `/admin` on the tunnel URL).
2. Add a contact with a **slug** (e.g. `jon`) and optional PIN.
3. Send them: `https://chat.jeankellmansmith.com/chat/jon` (+ PIN if set).

## Rebuild-from-scratch (if the tunnel is ever lost)

```
cloudflared tunnel login                                          # browser auth, pick the domain
cloudflared tunnel create jean-messenger
cloudflared tunnel route dns jean-messenger chat.jeankellmansmith.com
# write config.yml (above), then:
cloudflared service install
# then apply the ImagePath fix above and: Restart-Service cloudflared
```
