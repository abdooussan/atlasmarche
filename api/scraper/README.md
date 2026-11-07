# Hourly scraper

`scrape_latest.py` searches marchespublics.gov.ma for tenders published **yesterday and today**
(by "Date de mise en ligne"), reads all result pages and saves them in the `tenders` table:

- new tenders are **added**,
- tenders whose details changed (e.g. a postponed deadline) are **updated**,
- nothing is ever deleted, and running it twice never creates duplicates.

Each run prints one summary line, e.g.
`Done in 41s: 362 found, 9 new, 1 updated, 352 unchanged.`

## On the server (Docker)

All commands in `/opt/marches/deploy`.

**1. Build and try it once** (first build takes a few minutes: it downloads Chromium):
```bash
docker compose --profile scraper build scraper
docker compose run --rm scraper --dry-run
```
`--dry-run` scrapes and prints 5 tenders without touching the database.

**2. Catch up** on the days since your data was imported:
```bash
docker compose run --rm scraper --days 14
```

**3. Run it every hour** — `crontab -e`, add this line, save:
```
5 * * * * cd /opt/marches/deploy && flock -n /tmp/marches-scraper.lock docker compose run --rm scraper >> /opt/marches/deploy/scraper.log 2>&1
```
(minute 5 of every hour; `flock` makes sure two runs never overlap.)

**4. Check it works** after the next hour:
```bash
tail -n 20 /opt/marches/deploy/scraper.log
```

## Options

| Command | What it does |
|---|---|
| `docker compose run --rm scraper` | yesterday + today (what cron runs) |
| `docker compose run --rm scraper --days 7` | last 7 days + today |
| `docker compose run --rm scraper --dry-run` | scrape and print only |
| `docker compose run --rm scraper --from-csv /output/file.csv` | import a CSV put in `deploy/scraper-output/` |

## If a run fails

- The log says `Attempt 1/3 failed: …` — the site was slow; it retries twice (30 s, 60 s later).
- After 3 failures it gives up until the next hour, and saves a picture of the page in
  `deploy/scraper-output/last_error.png`. Download it to see what the site showed:
  `scp root@85.137.56.176:/opt/marches/deploy/scraper-output/last_error.png ~/Downloads/`
- If the site changes its layout, the selectors at the top of `scrape_latest.py`
  (`ID`, `EXTRACT_JS`, …) are the only part to adjust — they are the same as in your notebook.

## On your Mac (without Docker)

```bash
cd scraper
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
.venv/bin/playwright install chromium
.venv/bin/python scrape_latest.py --dry-run
```
It uses the same `PGHOST`, `PGUSER`, `PGPASSWORD`, `PGDATABASE` variables as your notebooks.
