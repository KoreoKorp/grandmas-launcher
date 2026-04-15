# Grandma's Launcher

A custom-built, dementia-friendly kiosk application designed specifically for Windows. It replaces the traditional Windows desktop experience with a simplified, highly resilient, and locked-down environment tailored for elderly users, while giving caregivers full control over the system's configuration and health.

## Features

*   **Kiosk Launcher Window:** A fullscreen, always-on-top interface featuring large, touch-friendly tiles. Websites open in an embedded `BrowserView` to prevent popups. Blocks standard Windows escape shortcuts (Alt+F4, Windows Key, Alt+Tab) to keep the user safely within the app.
*   **Caregiver Admin Panel:** A control window allowing caregivers to configure tiles, edit reminders, view chronological activity logs, and monitor the device remotely via background screenshots.
*   **Confusion Detection & Safe Mode:** Tracks interactions to detect frustration (rapid tapping) or extended inactivity in web apps, automatically returning the user to the safe home screen.
*   **System Resilience & Self-Healing:**
    *   **Wi-Fi Healing:** Constantly monitors the internet connection. If it drops, it runs a PowerShell script to automatically restart the Windows Wi-Fi adapter.
    *   **Volume Enforcement:** Uses a compiled C# payload via PowerShell to force the system volume to a specific level every 30 seconds, preventing accidental muting.
*   **Remote Configuration:** Periodically syncs tile layouts and settings from a remote JSON file, enabling remote updates by caregivers.
*   **Video Calling & Help requests:** Built-in WebRTC capabilities integrated with the *In-House Messenger App* for instant video calling and caregiver help requests directly from the launcher.

## Tech Stack

*   **Framework:** Electron (v32) & Electron-Vite
*   **Frontend:** React (v18)
*   **Storage:** `electron-store` for local configuration and activity logging
*   **Networking:** `socket.io-client`, WebRTC, Fetch API
*   **OS Integration:** Node.js `child_process` (PowerShell automation, custom C# volume controls, NSIS installer)