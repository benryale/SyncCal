# SyncCal

A collaborative calendar application for identifying mutual free time across multiple users.

**Team:** AJ, April, Ben, Kevin, Theia, Yassin

## Stack
- **Frontend:** React + FullCalendar + Vite
- **Backend:** Django + Django Channels (WebSockets)
- **Database:** PostgreSQL
- **Real-time:** Redis + Django Channels

## Getting Started

### Prerequisites
- Docker + Docker Compose
- Python 3.11+
- Node.js 18+

### 1. Start the database and Redis
```bash
docker-compose up -d
```

### 2. Set up the backend
```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
python manage.py migrate
python manage.py runserver
```

### 3. Set up the frontend
```bash
cd frontend
npm install
npm run dev
```

Frontend runs at http://localhost:3000
Backend runs at http://localhost:8000
