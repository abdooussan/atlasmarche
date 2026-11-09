# Public Marché

A platform that collects public procurement notices (marchés publics), stores them in a database, and serves them through an API.

The project has three parts:

| Folder | Role | Stack |
|---|---|---|
| `scraper/` | Fetches the latest procurement notices and saves them to the database | Python |
| `api/` | Exposes the stored notices through an HTTP API | Node.js |
| `deploy/` | Deployment configuration, environment template and database init scripts | Docker / PostgreSQL |

## Project structure

```
.
├── api/
│   └── src/
│       └── db.js              # Database connection
├── deploy/
│   ├── .env.example           # Environment variable template
│   ├── DEPLOY.md              # Detailed deployment guide
│   └── initdb/
│       └── 01-api-reader.sh   # Creates the read-only database user for the API
└── scraper/
    └── scrape_latest.py       # Scrapes the latest notices
```

## Getting started

### 1. Clone the repository

```bash
git clone https://github.com/abdooussan/Public_marche.git
cd Public_marche
```

### 2. Configure the environment

```bash
cp deploy/.env.example deploy/.env
nano deploy/.env
```

Fill in the database credentials and other values. Never commit `deploy/.env`; it is excluded by `.gitignore`.

### 3. Deploy

See [`deploy/DEPLOY.md`](deploy/DEPLOY.md) for the full deployment steps.

<!-- TODO: if you use Docker Compose, replace this with the actual command, e.g.:
```bash
cd deploy
docker compose up -d
```
-->

### 4. Run the scraper

```bash
cd scraper
pip install -r requirements.txt   # TODO: confirm the requirements file name
python scrape_latest.py
```

<!-- TODO: describe how the scraper is scheduled (cron, systemd timer, container) -->

### 5. Run the API locally

```bash
cd api
npm install
npm start
```

<!-- TODO: add the port the API listens on, e.g. http://localhost:3000 -->

## API endpoints

<!-- TODO: list the real routes from api/src -->

| Method | Endpoint | Description |
|---|---|---|
| GET | `/...` | TODO |

## Database

The API connects with a **read-only** database user created by `deploy/initdb/01-api-reader.sh`. Only the scraper has write access, which limits the damage if the API is compromised.

## Environment variables

See `deploy/.env.example` for the full list. Copy it to `deploy/.env` and fill in real values on each server.

## Security

- Keep secrets in `deploy/.env` only, never in source code.
- Rotate any credential that was ever committed by mistake.

## License

<!-- TODO: choose a license (e.g. MIT) or state "All rights reserved" -->

## User accounts

The mobile app opens on a login / create-account screen; tender data is only served to signed-in users.

| Route | Body | Answer |
|---|---|---|
| `POST /api/auth/register` | `{ name, email, password }` (password ≥ 8 characters) | `201 { token, user }`, `409` if the email is taken |
| `POST /api/auth/login` | `{ email, password }` | `{ token, user }`, `401` if wrong |
| `GET /api/auth/me` | — | `{ user }` |
| `POST /api/auth/logout` | — | `204` |

The app sends `Authorization: Bearer <token>` with every request. `/api/consultations`, `/api/attributions`
and `/api/meta` answer `401` without a valid token (set `AUTH_REQUIRED=false` in `deploy/.env` to keep them open
while older app versions without login are still in use). Passwords are hashed with scrypt; the database keeps
only a SHA-256 of each token. Sessions last 90 days (`SESSION_DAYS`). Login and sign-up are limited to 20 attempts
per 15 minutes per IP address.

**Phones per account.** At sign-in the app sends a random id for the phone (created on first launch, kept after
sign-out), its name and system. Each phone keeps one session per account, and every phone is recorded in `app_devices`.
To see how many phones use each email:

```bash
docker compose exec db psql -U postgres -d marches_publics \
  -c "SELECT email, phones_total, phones_signed_in, last_seen_at FROM app_user_phones ORDER BY phones_total DESC"
```

`phones_total` = every phone that has signed in with that email; `phones_signed_in` = phones signed in right now.
Details per phone: `SELECT * FROM app_devices WHERE user_id = …`.

**Existing server — run once (and again after each update of this file; it only adds what is missing)** to create the `app_users` and `app_sessions` tables (new databases get them automatically):

```bash
cd deploy
docker compose exec -T db psql -U postgres -d marches_publics < initdb/02-accounts.sql
docker compose up -d --build api
```
