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
