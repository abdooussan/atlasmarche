# Running the backend on a VPS

What runs on the server, all started by one command (Docker Compose):

```
 Phone app ──HTTPS──▶ Caddy (ports 80/443, automatic certificate)
                         └──▶ API (Node.js, read-only database user)
                                 └──▶ PostgreSQL (your tenders data, not reachable from the internet)
```

Commands marked **Mac** run in Terminal on your Mac; **server** means after `ssh`.

---

## 1. Rent a VPS

Any provider works (Hetzner, OVH, Contabo, DigitalOcean…). Choose:

- **Ubuntu 24.04**
- **2 GB RAM** or more, 1–2 vCPU, 20 GB disk or more

Note the server's **IP address** (e.g. `51.75.12.34`) and the **root password** or SSH key the provider gives you.

## 2. Connect and install Docker  — server

**Mac:**
```bash
ssh root@51.75.12.34
```
(type `yes` the first time, then the password).

**server:**
```bash
apt update && apt upgrade -y
apt install -y unzip
curl -fsSL https://get.docker.com | sh

# Firewall: only SSH and web traffic
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443
ufw --force enable
```

Check: `docker compose version` prints a version.

## 3. Upload the project

**Mac** — from the folder where you downloaded `marches-server.zip`:
```bash
scp ~/Downloads/marches-server.zip root@51.75.12.34:/opt/
```

**server:**
```bash
cd /opt && unzip -o marches-server.zip && cd marches/deploy
ls
```
You should see `docker-compose.yml`, `Caddyfile`, `.env.example`, `import-db.sh`…

## 4. Configure  — server

Find your Mac's PostgreSQL version first. **Mac:**
```bash
psql -d marches_publics -tAc "show server_version"
```
e.g. `17.6` → the major version is **17**.

**server:**
```bash
cp .env.example .env
openssl rand -hex 24      # run twice: one value per password
nano .env
```

Set:
```
API_DOMAIN=51.75.12.34.sslip.io        # your server IP + .sslip.io
POSTGRES_PASSWORD=<first random value>
API_DB_PASSWORD=<second random value>
POSTGRES_VERSION=17                     # the major version from your Mac
```
Save with **Ctrl + O**, **Enter**, then **Ctrl + X**.

> `sslip.io` is a free service that turns `51.75.12.34.sslip.io` into your IP, so the
> server gets a real HTTPS certificate without buying a domain.

## 5. Start everything  — server

```bash
docker compose up -d --build
docker compose ps
```

All three services (`db`, `api`, `caddy`) should show **running** / **healthy** after a minute.
Logs: `docker compose logs -f api` (Ctrl + C to leave).

## 6. Copy your data from the Mac

**Mac** — create a dump of your database:
```bash
pg_dump -d marches_publics -Fc --no-owner --no-privileges -f ~/Downloads/marches.dump
scp ~/Downloads/marches.dump root@51.75.12.34:/opt/marches/deploy/backups/
```

**server:**
```bash
cd /opt/marches/deploy
sh import-db.sh backups/marches.dump
```

It ends with the number of rows in `tenders` (e.g. `2938`).

## 7. Test

In your browser:

- `https://51.75.12.34.sslip.io/health` → `{"ok":true}`
- `https://51.75.12.34.sslip.io/api/consultations?statut=en_cours` → your tenders

The first visit can take ~30 seconds while Caddy gets the certificate.

## 8. Point the app to the server

In `mobile/.env` (for development) and in `mobile/eas.json` (for builds):
```
EXPO_PUBLIC_API_URL=https://51.75.12.34.sslip.io
```
Restart Expo with `npx expo start --clear`. The app now works anywhere — no need for your Mac to be on.

---

## Keeping the tenders up to date

The scraper (`../scraper`) runs in Docker next to the database. Full details: `../scraper/README.md`.

**server:**
```bash
cd /opt/marches/deploy
docker compose --profile scraper build scraper
docker compose run --rm scraper --dry-run      # test: prints 5 tenders, saves nothing
docker compose run --rm scraper --days 14      # catch up since your import
```
Then every hour — `crontab -e` and add (one line):
```
5 * * * * cd /opt/marches/deploy && flock -n /tmp/marches-scraper.lock docker compose run --rm scraper >> /opt/marches/deploy/scraper.log 2>&1
```
Check with `tail -n 20 /opt/marches/deploy/scraper.log`.

## Nightly backups

**server:** `crontab -e` and add:
```
0 3 * * * sh /opt/marches/deploy/backup.sh >> /opt/marches/deploy/backups/backup.log 2>&1
```
Backups go to `/opt/marches/deploy/backups/` (the last 14 are kept). Download one to your Mac from time to time:
```bash
scp "root@51.75.12.34:/opt/marches/deploy/backups/*.dump" ~/Downloads/
```

## Updating the API later

Upload the new `api` folder (or a new zip) to `/opt/marches/`, then **server:**
```bash
cd /opt/marches/deploy
docker compose up -d --build
```
Your data is not touched.

## Adding a domain later

1. At your domain registrar, create an **A record**: `api.mondomaine.ma` → your server IP.
2. **server:** set `API_DOMAIN=api.mondomaine.ma` in `.env`, then `docker compose up -d`.
3. Update `EXPO_PUBLIC_API_URL` in the app to `https://api.mondomaine.ma`.

## Useful commands  — server, in /opt/marches/deploy

| What | Command |
|---|---|
| Status | `docker compose ps` |
| API logs | `docker compose logs -f api` |
| HTTPS logs | `docker compose logs -f caddy` |
| Restart all | `docker compose restart` |
| Stop all (data kept) | `docker compose down` |
| Database shell | `docker compose exec db psql -U postgres -d marches_publics` |

## Troubleshooting

| Problem | Fix |
|---|---|
| `https://…sslip.io` doesn't load | `docker compose logs caddy`. Check ports 80 and 443 are open (`ufw status`, and the provider's firewall panel if it has one). |
| Caddy log says the certificate failed / rate limited | Use `API_DOMAIN=51-75-12-34.nip.io` instead (another free service), or a real domain. |
| `pg_restore: error: unsupported version` | The server's PostgreSQL is older than your Mac's. Set `POSTGRES_VERSION` in `.env` to your Mac's major version, then: `docker compose down -v` (**deletes server data**), `docker compose up -d`, and redo step 6. |
| `/api/consultations` returns `Erreur serveur` | `docker compose logs api` shows the cause — usually the table name (`CONSULTATIONS_TABLE`) or the import not done yet. |
| `password authentication failed for user "api_reader"` | You changed `API_DB_PASSWORD` after the first start. Set it back, or update the user: `docker compose exec db psql -U postgres -c "ALTER ROLE api_reader PASSWORD 'new-value'"`. |
