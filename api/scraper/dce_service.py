#!/usr/bin/env python3
"""
On-demand DCE downloads for marchespublics.gov.ma, into the folders the app reads.

The app shows a tender's documents from DCE_DIR/<id>/ (id = tenders.id), served by files-api.
When a user asks for the documents of a tender that has no folder yet, files-api calls this
service. It fills the portal's request form with Playwright, downloads the ZIP, unzips it
into DCE_DIR/<id>/ and leaves the files there for good. Downloads run in the background,
one at a time, so the app never waits on a long request and a small server never runs
several browsers at once.

Only reachable inside the Docker network (files-api calls it, Caddy does not expose it):
    POST /fetch/<id>    start the download, returns at once  -> {"status": ...}
    GET  /status/<id>   -> {"status": ..., "message"?: ...}
    GET  /health        -> ok

status:
    ready    DCE_DIR/<id>/ has files (files-api lists them)
    pending  queued or downloading
    failed   the last try failed ("message" says why); POST again after DCE_RETRY_AFTER_MIN
    none     the portal has no DCE for this tender, or the id is unknown
    idle     not downloaded yet

Settings (environment variables or a .env file, same as the scraper):
    DCE_NOM, DCE_PRENOM, DCE_EMAIL, DCE_RAISON_SOCIALE   required: written in the request form
    DCE_ICE, DCE_TELEPHONE, DCE_VILLE                    optional form fields
    DCE_DIR              tender folders (default /data/dce, mounted from /opt/marches/dce)
    DCE_PORT             port to listen on (default 8090)
    DCE_RETRY_AFTER_MIN  wait this long before trying a failed tender again (default 10)
    DCE_MAX_QUEUE        downloads waiting at most (default 20)
    DCE_MAX_UNZIPPED_MB  refuse archives bigger than this once unzipped (default 500)
    PGHOST PGPORT PGUSER PGPASSWORD PGDATABASE, NAV_TIMEOUT   as in scrape_latest.py
                         (read-only access to `tenders` is enough)

Run:  python dce_service.py
"""
import json
import logging
import os
import queue
import re
import shutil
import sys
import threading
import time
import urllib.parse
import zipfile
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

from scrape_latest import DB_CONFIG, NAV_TIMEOUT   # also loads the .env file

log = logging.getLogger("dce")

REQUEST_URL = ("https://www.marchespublics.gov.ma/index.php?page=entreprise.EntrepriseDemandeTelechargementDce"
               "&refConsultation={ref}&orgAcronyme={org}")
USER_AGENT = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
              "(KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36")

DCE_DIR = os.getenv("DCE_DIR", "/data/dce")
PORT = int(os.getenv("DCE_PORT", "8090"))
RETRY_AFTER = float(os.getenv("DCE_RETRY_AFTER_MIN", "10")) * 60
MAX_QUEUE = int(os.getenv("DCE_MAX_QUEUE", "20"))
MAX_UNZIPPED = int(os.getenv("DCE_MAX_UNZIPPED_MB", "500")) * 1024 * 1024

# Values typed in the request form. key -> (environment variable, form field id suffix)
FORM = {
    "nom":            ("DCE_NOM", "nom"),
    "prenom":         ("DCE_PRENOM", "prenom"),
    "email":          ("DCE_EMAIL", "email"),
    "raison_sociale": ("DCE_RAISON_SOCIALE", "raisonSocial"),
    "ice":            ("DCE_ICE", "ICE"),
    "telephone":      ("DCE_TELEPHONE", "tel"),
    "ville":          ("DCE_VILLE", "ville"),
}
REQUIRED = ("nom", "prenom", "email", "raison_sociale")
IDENT = {k: os.getenv(env, "").strip() for k, (env, _) in FORM.items()}
MISSING = [FORM[k][0] for k in REQUIRED if not IDENT[k]]

# Selectors of the request page (EntrepriseDemandeTelechargementDce)
F = "#ctl0_CONTENU_PAGE_EntrepriseFormulaireDemande_"
VALIDATE = "#ctl0_CONTENU_PAGE_validateButton"
DOWNLOAD = "#ctl0_CONTENU_PAGE_EntrepriseDownloadDce_completeDownload"
ERRORS = "#divValidationSummary"

ID_RE = re.compile(r"\d{1,12}")

# Messages shown in the app (French, like the rest of the app)
MSG_NONE = "Aucun dossier n'est disponible sur le portail pour cette consultation."
MSG_UNKNOWN = "Consultation inconnue."
MSG_FAILED = "Le dossier n'a pas pu être récupéré sur le portail. Réessayez dans quelques minutes."
MSG_BUSY = "Trop de demandes en cours. Réessayez dans quelques minutes."
MSG_DOWN = "Service momentanément indisponible, réessayez plus tard."

_jobs = {}                  # id -> {"status": "pending" | "failed", "message": str, "at": time}
_jobs_lock = threading.Lock()
_queue = queue.Queue()      # (id, ref, org), handled one at a time by worker()


class Unavailable(Exception):
    """The request can't be handled right now (database down, service not configured)."""


# ----------------------------- FILES -----------------------------
def folder_of(tid):
    return os.path.join(DCE_DIR, tid)


def has_files(tid):
    try:
        return any(not n.startswith(".") and os.path.isfile(os.path.join(folder_of(tid), n))
                   for n in os.listdir(folder_of(tid)))
    except FileNotFoundError:
        return False


def safe_name(name, fallback="document"):
    """Keeps letters (accents included), digits, spaces and . - _ ( ); at most 150 characters."""
    name = re.sub(r"[^\w.\- ()]", "_", name).strip(" ._")
    if len(name) > 150:
        stem, ext = os.path.splitext(name)
        name = stem[:150 - len(ext)] + ext
    return name or fallback


def _zip_member_name(info):
    """Real file name of a ZIP entry. Windows tools often store names in the OEM code page
    without saying so; Python then reads them as cp437, which garbles French accents."""
    name = info.filename
    if not info.flag_bits & 0x800:          # not marked as UTF-8
        raw = name.encode("cp437", errors="replace")
        for enc in ("utf-8", "cp850"):
            try:
                return raw.decode(enc)
            except UnicodeDecodeError:
                pass
    return name


def unpack(archive, dest, fallback_name):
    """Puts the files of `archive` directly in `dest` (sub-folders become "folder - file.pdf",
    because files-api only lists the top level). A download that isn't a ZIP is kept as is.
    Returns the number of files."""
    if not zipfile.is_zipfile(archive):
        shutil.move(archive, os.path.join(dest, fallback_name))
        return 1
    used = set()
    with zipfile.ZipFile(archive) as z:
        members = [i for i in z.infolist() if not i.is_dir()]
        if sum(i.file_size for i in members) > MAX_UNZIPPED:
            raise RuntimeError(f"archive larger than {MAX_UNZIPPED // 1024 // 1024} MB once unzipped")
        for info in members:
            parts = [p for p in re.split(r"[\\/]+", _zip_member_name(info)) if p not in ("", ".", "..")]
            if not parts or parts[0] == "__MACOSX" or parts[-1].startswith(".") or parts[-1] == "Thumbs.db":
                continue
            name = safe_name(" - ".join(parts))
            stem, ext = os.path.splitext(name)
            n = 2
            while name.lower() in used:     # two files with the same name in different folders
                name = f"{stem} ({n}){ext}"
                n += 1
            used.add(name.lower())
            with z.open(info) as src, open(os.path.join(dest, name), "wb") as dst:
                shutil.copyfileobj(src, dst, 1024 * 1024)
    return len(used)


# ----------------------------- DATABASE -----------------------------
def tender_info(tid):
    """(ref_consultation, organisme, has_dce) for tenders.id = tid, or None when unknown.
    has_dce is False only when the scraper read the detail page and found no DCE link."""
    import psycopg2

    try:
        conn = psycopg2.connect(connect_timeout=10, **DB_CONFIG)
    except Exception as e:
        raise Unavailable(f"database: {str(e).splitlines()[0]}")
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT ref_consultation, organisme, dce_url, details_fetched_at "
                        "FROM tenders WHERE id = %s", (int(tid),))
            row = cur.fetchone()
    finally:
        conn.close()
    if not row:
        return None
    ref, org, dce_url, details_at = row
    return ref, org, not (details_at is not None and not dce_url)


# ----------------------------- DOWNLOAD -----------------------------
def download(tid, ref, org):
    """Fill the request form, click "Télécharger", unzip into DCE_DIR/<tid>/. Returns the file count."""
    from playwright.sync_api import sync_playwright

    timeout = NAV_TIMEOUT * 1000
    work = os.path.join(DCE_DIR, f".tmp-{tid}")      # hidden from files-api until it's complete
    shutil.rmtree(work, ignore_errors=True)
    files_dir = os.path.join(work, "files")
    os.makedirs(files_dir)
    started = time.time()
    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(args=["--disable-dev-shm-usage", "--disable-gpu", "--disable-extensions"])
            try:
                context = browser.new_context(locale="fr-FR", timezone_id="Africa/Casablanca",
                                              user_agent=USER_AGENT, accept_downloads=True)
                context.route("**/*", lambda r: r.abort() if r.request.resource_type in ("image", "media", "font")
                              else r.continue_())
                page = context.new_page()
                page.goto(REQUEST_URL.format(ref=urllib.parse.quote(ref), org=urllib.parse.quote(org)),
                          wait_until="domcontentloaded", timeout=timeout)

                # Usually the form comes first; if the site goes straight to the download button, skip it.
                page.wait_for_selector(f"{F}nom, {DOWNLOAD}", timeout=timeout)
                if page.query_selector(F + "nom"):
                    for key, (_, field) in FORM.items():
                        if IDENT[key] and page.query_selector(F + field):
                            page.fill(F + field, IDENT[key])
                    page.check(F + "accepterConditions")
                    page.click(VALIDATE)
                    try:
                        page.wait_for_selector(DOWNLOAD, timeout=timeout)
                    except Exception:
                        _save_error_page(page, tid)
                        msg = ""
                        if page.query_selector(ERRORS) and page.is_visible(ERRORS):
                            msg = " ".join(page.inner_text(ERRORS).split())
                        raise RuntimeError("the request form was not accepted" + (f": {msg}" if msg else ""))

                with page.expect_download(timeout=timeout) as info:
                    page.click(DOWNLOAD)
                dl = info.value
                archive = os.path.join(work, "download")
                dl.save_as(archive)
                if dl.failure():
                    raise RuntimeError(f"download failed: {dl.failure()}")
                size = os.path.getsize(archive)
                if size == 0:
                    raise RuntimeError("the site sent an empty file")
                suggested = safe_name(os.path.basename(dl.suggested_filename or ""), f"DCE_{org}_{ref}.zip")
            finally:
                browser.close()

        count = unpack(archive, files_dir, suggested)
        if not count:
            raise RuntimeError("the archive has no files")

        # Readable by files-api (another container, another user), then put in place in one step.
        os.chmod(files_dir, 0o755)
        for n in os.listdir(files_dir):
            os.chmod(os.path.join(files_dir, n), 0o644)
        final = folder_of(tid)
        if has_files(tid):                  # someone put files there meanwhile: keep theirs
            return count
        if os.path.isdir(final):
            os.rmdir(final)                 # empty folder left over
        os.replace(files_dir, final)
        log.info("DCE %s (%s/%s): %d files, %.1f MB downloaded, %.0fs",
                 tid, org, ref, count, size / 1e6, time.time() - started)
        return count
    finally:
        shutil.rmtree(work, ignore_errors=True)


def _save_error_page(page, tid):
    try:
        os.makedirs(os.path.join(DCE_DIR, ".errors"), exist_ok=True)
        with open(os.path.join(DCE_DIR, ".errors", f"{tid}.html"), "w", encoding="utf-8") as f:
            f.write(page.content())
    except Exception:
        pass


def worker():
    while True:
        tid, ref, org = _queue.get()
        try:
            download(tid, ref, org)
            with _jobs_lock:
                _jobs.pop(tid, None)
        except Exception as e:
            log.error("DCE %s (%s/%s) failed: %s", tid, org, ref, str(e).splitlines()[0])
            with _jobs_lock:
                _jobs[tid] = {"status": "failed", "message": MSG_FAILED, "at": time.time()}
        finally:
            _queue.task_done()


# ----------------------------- STATUS / START -----------------------------
def _public(job):
    return {k: v for k, v in job.items() if k != "at"}


def status_of(tid):
    if has_files(tid):
        return {"status": "ready"}
    with _jobs_lock:
        job = _jobs.get(tid)
    if job:
        return _public(job)
    try:
        info = tender_info(tid)
    except Exception:
        return {"status": "idle"}           # can't tell: let the user try
    if info is None:
        return {"status": "none", "message": MSG_UNKNOWN}
    return {"status": "idle"} if info[2] else {"status": "none", "message": MSG_NONE}


def start(tid):
    """Queue the download of tender `tid` unless it's already there, queued or recently failed."""
    if MISSING:
        raise Unavailable("missing settings: " + ", ".join(MISSING))
    if has_files(tid):
        return {"status": "ready"}
    with _jobs_lock:
        job = _jobs.get(tid)
        if job and (job["status"] == "pending" or time.time() - job["at"] < RETRY_AFTER):
            return _public(job)
    info = tender_info(tid)
    if info is None:
        return {"status": "none", "message": MSG_UNKNOWN}
    ref, org, has_dce = info
    if not has_dce:
        return {"status": "none", "message": MSG_NONE}
    with _jobs_lock:
        if _jobs.get(tid, {}).get("status") == "pending":
            return {"status": "pending"}
        if _queue.qsize() >= MAX_QUEUE:
            return {"status": "failed", "message": MSG_BUSY}
        _jobs[tid] = {"status": "pending", "at": time.time()}
    _queue.put((tid, ref, org))
    log.info("DCE %s (%s/%s) queued (%d waiting)", tid, org, ref, _queue.qsize())
    return {"status": "pending"}


# ----------------------------- HTTP -----------------------------
class Handler(BaseHTTPRequestHandler):
    server_version = "dce-service"

    def _route(self):
        path = urllib.parse.urlparse(self.path).path
        m = re.fullmatch(r"/(fetch|status)/([^/]+)/?", path)
        return path, (m.groups() if m else (None, None))

    def do_GET(self):
        path, (action, tid) = self._route()
        if path == "/health":
            return self._json(200, {"ok": True})
        if action != "status":
            return self._json(404, {"error": "Route introuvable"})
        if not ID_RE.fullmatch(tid):
            return self._json(400, {"error": "Identifiant invalide"})
        self._json(200, status_of(tid))

    def do_POST(self):
        _, (action, tid) = self._route()
        if action != "fetch":
            return self._json(404, {"error": "Route introuvable"})
        if not ID_RE.fullmatch(tid):
            return self._json(400, {"error": "Identifiant invalide"})
        try:
            self._json(200, start(tid))
        except Unavailable as e:
            log.error("Cannot start DCE %s: %s", tid, e)
            self._json(503, {"status": "unavailable", "message": MSG_DOWN})

    def _json(self, status, data):
        body = json.dumps(data, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, fmt, *args):
        pass                                # files-api polls /status often: keep the log readable


def main():
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s",
                        datefmt="%Y-%m-%d %H:%M:%S")
    if MISSING:
        log.error("Missing settings for the request form: %s (downloads are refused until they are set)",
                  ", ".join(MISSING))
    os.makedirs(DCE_DIR, exist_ok=True)
    for n in os.listdir(DCE_DIR):           # leftovers of a run that was stopped mid-download
        if n.startswith(".tmp-"):
            shutil.rmtree(os.path.join(DCE_DIR, n), ignore_errors=True)
    threading.Thread(target=worker, daemon=True).start()
    server = ThreadingHTTPServer(("0.0.0.0", PORT), Handler)
    server.daemon_threads = True
    log.info("DCE service on port %d, tender folders in %s", PORT, DCE_DIR)
    server.serve_forever()


if __name__ == "__main__":
    sys.exit(main())
