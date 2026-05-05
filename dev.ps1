# dev.ps1 — start the full SyncCal dev stack
$ErrorActionPreference = "Stop"
$root = $PSScriptRoot

# 1. Postgres + Redis (idempotent — no-op if already running)
docker-compose -f "$root\docker-compose.yml" up -d

# 2. Backend in its own window
Start-Process powershell -ArgumentList "-NoExit", "-Command", @"
cd '$root\backend'
.\venv\Scripts\Activate.ps1
`$env:DJANGO_SETTINGS_MODULE='synccal.settings'
daphne -e "ssl:8000:privateKey=cert.key:certKey=cert.crt" synccal.asgi:application
"@

# 3. Frontend in its own window
Start-Process powershell -ArgumentList "-NoExit", "-Command", @"
cd '$root\frontend'
npm run dev
"@