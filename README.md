# SyncCal

A collaborative calendar application for identifying mutual free time across multiple users.

Team: AJ, April, Ben, Kevin, Diya, Yassin

## Stack
- Frontend: React + FullCalendar + Vite
- Backend: Django + Django Channels (WebSockets)
- Database: SQLite (file-based, no setup required)
- Real-time: Redis + Django Channels + Daphne (ASGI)
- Reverse proxy: Caddy (HTTPS via mkcert)

## Getting Started

# 1. Install Docker

(linux, Ubuntu/Debian):
```bash
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER
```
Log out and back in (or run `newgrp docker`) so the group takes effect.

(windows): Install Docker Desktop from https://docs.docker.com/desktop/install/windows-install/. Launch it once and wait for the whale icon to go steady before continuing.

# 2. Install mkcert

(linux):
```bash
sudo apt install -y libnss3-tools mkcert
```
If `mkcert` isn't in your distro's repos, grab the binary from https://github.com/FiloSottile/mkcert/releases. `libnss3-tools` is required either way — it provides `certutil`, which mkcert uses to install the CA into Firefox/Chromium.

(windows):
```powershell
choco install mkcert
```
Or `scoop install mkcert`, or download the exe from https://github.com/FiloSottile/mkcert/releases and put it on your `PATH`.

# 3. Free ports 80 and 443

Caddy binds both. Stop anything else using them.

(linux):
```bash
sudo systemctl stop apache2 nginx 2>/dev/null
```

(windows), elevated PowerShell:
```powershell
Get-NetTCPConnection -LocalPort 80,443 -State Listen
Stop-Service -Name W3SVC -ErrorAction SilentlyContinue
```

# 4. Clone and generate local certs

(linux):
```bash
git clone <repo-url> SyncCal
cd SyncCal
chmod +x setup-certs.sh
./setup-certs.sh
```

(windows), via Git Bash:
```bash
git clone <repo-url> SyncCal
cd SyncCal
bash setup-certs.sh
```

(windows), pure PowerShell:
```powershell
git clone <repo-url> SyncCal
cd SyncCal
mkcert -install
New-Item -ItemType Directory -Force -Path certs | Out-Null
mkcert -cert-file certs\localhost.pem -key-file certs\localhost-key.pem localhost
```

This adds the local CA to your trust store and writes `certs/localhost.pem` + `certs/localhost-key.pem`.

# 5. Bring the stack up

(linux + windows):
```bash
docker compose up --build
```
Compose starts Redis, the Django backend (auto-migrates SQLite on boot), the Vite frontend, and Caddy.

Open https://localhost.

To stop: Ctrl+C, then `docker compose down`. To wipe SQLite + Redis state: `docker compose down -v`.

## Features

# Scheduling & Calendar
- Interactive calendar — month, week, and day views powered by FullCalendar
- Create, edit, and delete events — click any date to create; drag to move, resize to adjust duration
- Event color coding — pick a color per event using swatches or a custom color picker
- Conflict detection — live amber warning when a new event overlaps an existing one
- Timezone support — events stored and displayed in your local timezone

# Real-time Collaboration
- WebSocket push updates — calendar events, friend requests, and invites sync instantly across all tabs with no page refresh
- Friend calendar overlay — toggle friends' busy blocks on your calendar to find mutual free time
- Live connection indicator — green WiFi icon shows when real-time sync is active

# Friends & Invites
- Friend search — search for users by username and send friend requests
- Friend requests — send, accept, and decline friend requests with instant push notifications
- Event invites — invite friends to events; they receive a real-time bell notification
- Invite conflict badge — incoming invites show a red "Time Conflict" badge if they overlap your calendar
- Invite response notifications — organizer gets a toast when someone accepts or declines

# Search
- Autocomplete event search — type to search your events; clicking a result navigates the calendar to that event's week

# Account & Profile
- Registration — username, email, password with confirmation field, show/hide toggle, and live match indicator
- Onboarding tour — 4-step tutorial shown automatically on first signup
- Profile page — view username and email, change timezone, change password
- Theme toggle — switch between light and dark mode

# Navigation & UX
- Navbar dropdown — avatar menu with Profile and Sign out options
- Keyboard shortcuts — N (new event), M/W/D (view switch), ? (shortcuts help), Esc (close)
- Event hover tooltip — hover over any event to see details without clicking
- Landing page — animated hero with flip words, 3D card preview, and spotlight effect
