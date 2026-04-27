# SyncCal

A collaborative calendar application for identifying mutual free time across multiple users.

**Team:** AJ, April, Ben, Kevin, Diya, Yassin

## Stack
- **Frontend:** React + FullCalendar + Vite
- **Backend:** Django + Django Channels (WebSockets)
- **Database:** PostgreSQL
- **Real-time:** Redis + Django Channels + Daphne (ASGI)

## Getting Started

### Prerequisites
- Docker + Docker Compose
- Python 3.11+
- Node.js 18+
- Redis

### 1. Start the database and Redis
```bash
docker-compose up -d
```

If not using Docker, start Redis manually:
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

## Features
- **Real-time push updates** — calendar events, friend requests, and invites sync instantly across all tabs via WebSocket
- **Event color coding** — pick a color for each event using a swatch picker or custom color picker
- **Conflict detection** — live warning when a new event overlaps an existing one
- **Autocomplete event search** — search bar with dropdown that navigates to the matching event
- **Friend calendar overlay** — view friends' busy blocks alongside your own calendar
- **Event invites** — invite friends to events with real-time accept/decline notifications
- **Profile page** — update timezone and change password
- **Onboarding tour** — 4-step tutorial shown on first signup
- **Keyboard shortcuts** — N (new event), M/W/D (view switch), ? (shortcuts help)