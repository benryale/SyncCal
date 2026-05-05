# SyncCal

A collaborative calendar application for identifying mutual free time across multiple users.

**Team:** AJ, April, Ben, Kevin, Diya, Yassin

## Stack
- **Frontend:** React + FullCalendar + Vite
- **Backend:** Django + Django Channels (WebSockets)
- **Database:** SQLite (file-based, no setup required)
- **Real-time:** Redis + Django Channels + Daphne (ASGI)

## Getting Started

### Prerequisites
- Python 3.11+
- Node.js 18+
- Redis (run natively, or via Docker)

### 1. Start Redis
The database is SQLite and needs no setup — Django creates
`backend/db.sqlite3` on first `migrate` (step 2 below).

With Docker:
```bash
docker-compose up -d
```

Without Docker:
```bash
redis-server
```

### 2. Set up the backend
```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
python manage.py migrate
```

> **Important:** This project uses Django Channels for WebSocket support and must be run with Daphne (ASGI), not the standard Django dev server.

```bash
DJANGO_SETTINGS_MODULE=synccal.settings daphne -p 8000 synccal.asgi:application
```

### 3. Set up the frontend
```bash
cd frontend
npm install
npm run dev
```

Frontend runs at http://localhost:3000
Backend runs at http://localhost:8000

### 4. Set up HTTPS (one-time)

We run Caddy as a reverse proxy in front of the app to handle https. The first
time you run the project, you need to generate a local cert that your browser
will trust.

```bash
brew install mkcert        # or: apt install mkcert
./setup-certs.sh
```

After that, `docker compose up` will start Caddy too, and the app is
reachable at https://localhost.

## Features

### Scheduling & Calendar
- **Interactive calendar** — month, week, and day views powered by FullCalendar
- **Create, edit, and delete events** — click any date to create; drag to move, resize to adjust duration
- **Event color coding** — pick a color per event using swatches or a custom color picker
- **Conflict detection** — live amber warning when a new event overlaps an existing one
- **Timezone support** — events stored and displayed in your local timezone

### Real-time Collaboration
- **WebSocket push updates** — calendar events, friend requests, and invites sync instantly across all tabs with no page refresh
- **Friend calendar overlay** — toggle friends' busy blocks on your calendar to find mutual free time
- **Live connection indicator** — green WiFi icon shows when real-time sync is active

### Friends & Invites
- **Friend search** — search for users by username and send friend requests
- **Friend requests** — send, accept, and decline friend requests with instant push notifications
- **Event invites** — invite friends to events; they receive a real-time bell notification
- **Invite conflict badge** — incoming invites show a red "Time Conflict" badge if they overlap your calendar
- **Invite response notifications** — organizer gets a toast when someone accepts or declines

### Search
- **Autocomplete event search** — type to search your events; clicking a result navigates the calendar to that event's week

### Account & Profile
- **Registration** — username, email, password with confirmation field, show/hide toggle, and live match indicator
- **Onboarding tour** — 4-step tutorial shown automatically on first signup
- **Profile page** — view username and email, change timezone, change password
- **Theme toggle** — switch between light and dark mode

### Navigation & UX
- **Navbar dropdown** — avatar menu with Profile and Sign out options
- **Keyboard shortcuts** — N (new event), M/W/D (view switch), ? (shortcuts help), Esc (close)
- **Event hover tooltip** — hover over any event to see details without clicking
- **Landing page** — animated hero with flip words, 3D card preview, and spotlight effect