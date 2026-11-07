# files-api

A small service, separate from the main API, that serves the tender documents
saved on the server in `/opt/marches/dce/<id>` (`<id>` = the tender's `id` in the database).
It has no database access and runs in its own container, so it can't affect the main API.
If it is down, the app still shows tenders, just without the download button.

| Route | Returns |
|---|---|
| `GET /files/health` | `{ "ok": true }` |
| `GET /files/:id` | `{ id, count, zipUrl, files: [{ nom, taille, url }] }`, an empty list if the tender has no folder |
| `GET /files/:id/zip` | every file of the tender in one ZIP (`DCE-<id>.zip`) |
| `GET /files/:id/:name` | one file |
| `POST /files/:id/fetch` | asks the `dce` service to download the tender's documents from the portal into `/opt/marches/dce/<id>`: `{ status, message? }` |

When a tender has no folder yet, `GET /files/:id` also returns `status`: `idle` (can be downloaded),
`pending` (being downloaded), `failed`, `none` (the portal has no documents) or `unavailable`
(the `dce` service is down or `DCE_SERVICE_URL` is not set). The app shows a "Récupérer le dossier"
button for `idle`/`failed` and checks again every 4 s while it is `pending`. files-api itself still
only reads the folder: the `dce` service (`scraper/dce_service.py`) is the one that writes it.

Caddy sends `https://<API_DOMAIN>/files/...` to this service. Everything else still goes to the main API.

## Install on the server

1. Copy this folder to `/opt/marches/files-api` (without `node_modules`).

2. In `/opt/marches/deploy/docker-compose.yml`, add under `services:`:

   ```yaml
     files:
       build: ../files-api
       restart: unless-stopped
       environment:
         DCE_DIR: /data/dce
         PORT: 4100
         CORS_ORIGINS: ${CORS_ORIGINS:-}
       volumes:
         - /opt/marches/dce:/data/dce:ro   # read-only
       expose:
         - "4100"
   ```

3. In `/opt/marches/deploy/Caddyfile`, add this block inside `{$API_DOMAIN} { ... }`,
   **before** the final `handle { reverse_proxy api:4000 }`:

   ```
   	handle /files/* {
   		reverse_proxy files:4100
   	}
   ```

4. Start it:

   ```bash
   cd /opt/marches/deploy
   docker compose config --quiet && echo OK
   docker compose up -d --build files
   docker compose restart caddy
   chmod -R a+rX /opt/marches/dce
   curl -s https://<API_DOMAIN>/files/3144
   ```

## Update after a code change

```bash
cd /opt/marches/deploy
docker compose up -d --build files
docker compose logs --tail=20 files
```

## Run locally

```bash
cd files-api
npm install
DCE_DIR=/path/to/dce PORT=4100 CORS_ORIGINS=http://localhost:8081 npm run dev
```

In the app's `.env`, add `EXPO_PUBLIC_FILES_URL=http://localhost:4100`. Without it, the app
uses the same address as `EXPO_PUBLIC_API_URL`, which is right in production.
