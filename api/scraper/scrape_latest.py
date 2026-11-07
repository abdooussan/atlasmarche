#!/usr/bin/env python3
"""
marchespublics.gov.ma — fetch the latest published tenders and save them in PostgreSQL.
Version 8: v7 + dce_download_url, a direct download link served by dce_service.py.

Each run searches one publication day at a time (N days ago -> today, Morocco time),
reads every result page and upserts into the `tenders` table (never deletes, and an
empty value never erases a known one).

The caution provisoire and the DCE link are not on the result cards, only on the
tender's detail page. After the search, the script opens the detail page of each tender
it has not fully read yet and stores:
    caution_provisoire_dh   "220 000,00 MAD"            -> 220000.00
    dce_url                 link of "Pièces de la consultation" (the DCE request page,
                            index.php?page=entreprise.EntrepriseDemandeTelechargementDce&...)
    dce_taille              "1,89 Mo"
    dce_download_url        DCE_PUBLIC_URL + "/dce/<org>/<ref>" (only when DCE_PUBLIC_URL is set)
The site has no permanent direct link to the ZIP: the final download is a form post tied
to the session, so dce_url is the page where the download starts. dce_download_url points
to dce_service.py, which fills that form when someone asks for the file and returns the ZIP.
MAX_DETAILS caps how many detail pages are read per run, the rest are picked up by the next run.

Usage:
    python scrape_latest.py                 # yesterday + today (default)
    python scrape_latest.py --days 7        # catch up on the last week
    python scrape_latest.py --dry-run       # scrape and print, don't touch the database
    python scrape_latest.py --no-details    # skip the detail pages (no caution, no DCE link)
    python scrape_latest.py --save-html     # also save the first results page
    python scrape_latest.py --show          # visible browser (debugging, needs a screen)
    python scrape_latest.py --from-csv FILE # import a CSV, no browser

In a notebook:  main(["--days", "1", "--dry-run"])  (run it in a thread, see the notebook)

Settings (environment variables or a .env file): PGHOST PGPORT PGUSER PGPASSWORD PGDATABASE,
PAGE_SIZE (100; use 50 on a 1 GB server), SCRAPE_DAYS, NAV_TIMEOUT, WAIT_TIMEOUT, OUTPUT_DIR,
MAX_RUNTIME (2700 s: a run that takes longer is stopped), MAX_DETAILS (300 detail pages per run),
DCE_PUBLIC_URL (address of dce_service.py as your users reach it, e.g. https://example.ma or
http://203.0.113.5:8090; empty = no dce_download_url).
"""
import argparse
import csv
import fcntl
import html as htmllib
import logging
import os
import re
import sys
import tempfile
import time
from datetime import datetime, timedelta
from urllib.parse import urljoin
from zoneinfo import ZoneInfo

try:
    from dotenv import load_dotenv      # optional: reads a .env file next to the script (Mac / notebook)
    load_dotenv()                       # must run before the CONFIG below reads the environment
except ImportError:
    pass                                # on the server, Docker passes the variables


# ----------------------------- CONFIG -----------------------------
DB_CONFIG = {
    "host":     os.getenv("PGHOST", "localhost"),
    "port":     int(os.getenv("PGPORT", "5432")),
    "user":     os.getenv("PGUSER", "postgres"),
    "password": os.getenv("PGPASSWORD", ""),
    "dbname":   os.getenv("PGDATABASE", "marches_publics"),
}
SEARCH_URL = os.getenv(
    "SEARCH_URL",
    "https://www.marchespublics.gov.ma/index.php?page=entreprise.EntrepriseAdvancedSearch&searchAnnCons",
)

TZ = ZoneInfo("Africa/Casablanca")              # the site's dates are Morocco local time
PAGE_SIZE = os.getenv("PAGE_SIZE", "100")       # 10, 20, 50, 100 or 500 (500 crashes Chromium: too heavy)
FALLBACK_SIZES = ["50", "20"]                   # used on the retries if the browser crashes again
NAV_TIMEOUT = int(os.getenv("NAV_TIMEOUT", "120"))    # seconds for a page load (the site is slow)
WAIT_TIMEOUT = int(os.getenv("WAIT_TIMEOUT", "180"))  # seconds for a results reload (page size, next page)
DELAY = 1.5                                     # pause between result pages (be polite)
MAX_DETAILS = int(os.getenv("MAX_DETAILS", "300"))    # detail pages read per run (0 = no limit)
DETAIL_DELAY = 0.5                              # pause between detail pages
ATTEMPTS = 3                                    # retries when the site is slow / fails
LOCK_FILE = os.path.join(tempfile.gettempdir(), "marches_scraper.lock")
OUTPUT_DIR = os.getenv("OUTPUT_DIR", "output")  # debug HTML / screenshots
DCE_PUBLIC_URL = os.getenv("DCE_PUBLIC_URL", "").strip().rstrip("/")   # where dce_service.py is reachable
# ------------------------------------------------------------------

log = logging.getLogger("scraper")


# ----------------------------- SELECTORS -----------------------------
ID = "#ctl0_CONTENU_PAGE_AdvancedSearch_"
RES = "#ctl0_CONTENU_PAGE_resultSearch_"
TOTAL_SEL = RES + "nombreElement"

# A result is a clickable card: <div class="contentColumn" onclick="location.href='...refConsultation=...'">
CARD_SEL = "div.contentColumn"

PAGE_SIZE_SELECTS = [RES + "listePageSizeTop", "select[id*='listePageSize']"]
NEXT_LINKS = [
    RES + "PagerTop a:has(img[title*='suivante' i])",
    RES + "PagerBottom a:has(img[title*='suivante' i])",
    "a:has(img[title*='suivante' i])",
    "a[title*='suivante' i]",
]

# Detail page (EntrepriseDetailsConsultation): ids of the summary fields
SUMMARY = "ctl0_CONTENU_PAGE_idEntrepriseConsultationSummary_"
DETAIL_CAUTION = SUMMARY + "cautionProvisoire"      # "20 000,00 MAD"
DETAIL_CATEGORIE = SUMMARY + "categoriePrincipale"  # "Travaux"
DETAIL_CHECK = SUMMARY + "objet"                    # present on every real detail page
DETAIL_DCE = "ctl0_CONTENU_PAGE_linkDownloadDce"    # <a href="...DemandeTelechargementDce...">Dossier de consultation - 1,89 Mo</a>

# Reads every card on the page. Works with an onclick card or a link inside it.
EXTRACT_JS = r"""
(cardSel) => {
  const clean = s => (s || '').replace(/[\s\u00a0\u202f]+/g, ' ').trim();
  const out = [];
  for (const card of document.querySelectorAll(cardSel)) {
    const q = s => card.querySelector(s);
    const t = el => el ? clean(el.textContent) : '';

    let href = null;
    const m = (card.getAttribute('onclick') || '').match(/location\.href\s*=\s*["']([^"']+)["']/);
    if (m) href = m[1];
    if (!href) { const a = q("a[href*='refConsultation']"); if (a) href = a.getAttribute('href'); }
    if (!href || !/refConsultation=/.test(href)) continue;
    const u = new URL(href, location.href);

    const proc = q('.verticalText span[title]');
    const estimTxt = t(q('.estim-mad'));
    const estim = estimTxt ? parseFloat(estimTxt.replace(/[^\d,.-]/g, '').replace(',', '.')) : null;
    const limita = [...card.querySelectorAll('.leftColumn .limita strong span')].map(t).filter(Boolean);
    const lieuxFull = q('[id$=infosLieuExecution] div');
    const lieuxVisible = q('[id$=panelBlocLieuxExec] .limita strong div') || q('[id$=panelBlocLieuxExec]');
    const cat = q('[id$=panelBlocCategorie]') || q('[id*=ategorie]');
    const certif = q('img.certificat[src*="themes/images"]');

    out.push({
      ref_consultation: u.searchParams.get('refConsultation'),
      organisme: u.searchParams.get('orgAcronyme'),
      procedure_code: proc ? t(proc) : '',
      procedure: proc ? clean(proc.getAttribute('title')) : '',
      categorie: cat ? t(cat).replace(/^Cat[ée]gorie\s*:\s*/i, '') : '',
      reference: t(q('[id$=_referencem]')),
      objet: t(q('.p-objet')).replace(/^Objet\s*:\s*/i, ''),
      estimation_ttc_dh: isNaN(estim) ? null : estim,
      acheteur: t(q('.title .a-card')).replace(/^Acheteur public\s*:\s*/i, ''),
      lieux: lieuxFull ? t(lieuxFull) : t(lieuxVisible).replace(/\.\.\.$/, '').trim(),
      date_limite: limita.join(' '),
      reponse_electronique: certif ? clean(certif.getAttribute('title') || certif.getAttribute('alt')) : '',
      url: u.href.replace(/&echanges$/, ''),
    });
  }
  return out;
}
"""

# Signature of the cards currently shown: changes when a new page is displayed.
SIGNATURE_JS = r"""
(cardSel) => [...document.querySelectorAll(cardSel)]
  .map(c => ((c.getAttribute('onclick') || '').match(/refConsultation=(\d+)/) ||
             ((c.querySelector("a[href*='refConsultation']") || {}).href || '').match(/refConsultation=(\d+)/) || [])[1])
  .filter(Boolean).join(',')
"""


# ----------------------------- BROWSER HELPERS -----------------------------
def safe_eval(page, js, arg=None):
    """page.evaluate that survives a reload in progress (None on failure)."""
    try:
        return page.evaluate(js, arg) if arg is not None else page.evaluate(js)
    except Exception:
        return None


def text_of(page, selector):
    return safe_eval(page, f"document.querySelector({selector!r})?.textContent.trim() || ''") or ""


def first_int(s):
    m = re.search(r"\d[\d\s\u00a0\u202f]*", s or "")
    return int(re.sub(r"\D", "", m.group())) if m else None


def signature(page):
    return safe_eval(page, SIGNATURE_JS, CARD_SEL) or ""


def wait_for_cards(page, old_sig=None, timeout=WAIT_TIMEOUT):
    """Wait until cards are on screen, different from `old_sig`, and no longer changing
    (the site draws them progressively). Returns the final signature, or None on timeout."""
    end = time.time() + timeout
    last, stable_since = None, None
    while time.time() < end:
        sig = signature(page)
        if sig and sig != old_sig:
            if sig == last:
                if time.time() - stable_since >= 2:      # unchanged for 2 s: drawing finished
                    return sig
            else:
                last, stable_since = sig, time.time()
                # some layouts draw more cards when scrolled: nudge it
                safe_eval(page, "window.scrollTo(0, document.body.scrollHeight)")
        time.sleep(0.5)
    return None


def js_click(page, selector):
    """Click through any loading overlay (a normal click can be blocked by it)."""
    return safe_eval(page, "(s) => { const el = document.querySelector(s); if (!el) return false; el.click(); return true; }",
                     selector)


def find_first(page, selectors):
    for s in selectors:
        try:
            if page.query_selector(s):
                return s
        except Exception:
            pass
    return None


def goto(page, url, wait_selector):
    """Navigate without 'networkidle' (the site never goes idle)."""
    page.goto(url, wait_until="domcontentloaded", timeout=NAV_TIMEOUT * 1000)
    page.wait_for_selector(wait_selector, timeout=NAV_TIMEOUT * 1000)


def set_field(page, selector, value):
    page.fill(selector, value)
    page.dispatch_event(selector, "change")


def save_debug(page, name):
    try:
        os.makedirs(OUTPUT_DIR, exist_ok=True)
        with open(os.path.join(OUTPUT_DIR, name + ".html"), "w", encoding="utf-8") as f:
            f.write(page.content())
        log.info("Saved %s.html in %s", name, OUTPUT_DIR)
    except Exception as e:
        log.warning("Could not save %s.html: %s", name, str(e).splitlines()[0])
    try:
        page.screenshot(path=os.path.join(OUTPUT_DIR, name + ".png"), timeout=20000)
    except Exception as e:
        log.warning("Could not save %s.png: %s", name, str(e).splitlines()[0])


# ----------------------------- SCRAPING -----------------------------
def run_search(page, day_str):
    """Search tenders published on `day_str` (dd/mm/yyyy). Returns False when there are none."""
    goto(page, SEARCH_URL, ID + "dateMiseEnLigneCalculeStart")
    set_field(page, ID + "dateMiseEnLigneCalculeStart", day_str)   # Date de mise en ligne
    set_field(page, ID + "dateMiseEnLigneCalculeEnd", day_str)
    set_field(page, ID + "dateMiseEnLigneStart", "")                # clear the default
    set_field(page, ID + "dateMiseEnLigneEnd", "")                  # deadline filter
    log.info("Searching tenders published on %s", day_str)
    page.click(ID + "lancerRecherche")
    try:
        page.wait_for_selector(TOTAL_SEL, timeout=NAV_TIMEOUT * 1000)
    except Exception:
        log.info("No results block on the page (0 tenders that day).")
        return False
    return True


def set_page_size(page, total, wanted=PAGE_SIZE):
    """Ask for `wanted` results per page. Returns True if the page really changed."""
    sel = find_first(page, PAGE_SIZE_SELECTS)
    if not sel:
        log.warning("Page-size list not found: reading 10 per page.")
        return False
    options = safe_eval(page, "(s) => [...document.querySelector(s).options].map(o => o.value)", sel) or []
    size = wanted if wanted in options else (max(options, key=lambda v: int(v) if v.isdigit() else 0)
                                             if options else wanted)
    old_sig = signature(page)
    page.select_option(sel, size)
    # The site reloads the results: wait for MORE cards than before (or at least different ones).
    end = time.time() + WAIT_TIMEOUT
    old_n = len(old_sig.split(",")) if old_sig else 0
    want = min(total or 0, int(size)) if size.isdigit() else 0
    while time.time() < end:
        sig = signature(page)
        n = len(sig.split(",")) if sig else 0
        if (want and n >= want) or (n > old_n):
            wait_for_cards(page, old_sig=None, timeout=30)   # let it finish drawing
            log.info("Page size set to %s", size)
            return True
        time.sleep(0.5)
    log.warning("Page size %s did not apply within %ds: reading the pages as they are.", size, WAIT_TIMEOUT)
    return False


def next_page(page, old_sig):
    """Go to the next result page. Returns True when new cards are shown."""
    sel = find_first(page, NEXT_LINKS)
    if not sel:
        return False
    js_click(page, sel)
    return wait_for_cards(page, old_sig=old_sig) is not None


def read_all_pages(page, day_str, save_html=False, page_size=PAGE_SIZE):
    total = first_int(text_of(page, TOTAL_SEL))
    if not total:
        log.info("0 results.")
        return []
    sig = wait_for_cards(page)
    if sig is None:
        raise RuntimeError("The results block appeared but no tender cards were drawn")
    if total > len(sig.split(",")):
        set_page_size(page, total, page_size)
    if save_html:
        save_debug(page, "results_page")

    rows, seen, n = [], set(), 0
    while True:
        n += 1
        found = safe_eval(page, EXTRACT_JS, CARD_SEL) or []
        if not found:
            raise RuntimeError(f"No cards could be read on page {n} (browser crashed?) - "
                               f"{len(rows)}/{total} tenders read")
        added = 0
        for r in found:
            key = (r.get("ref_consultation"), r.get("organisme"))
            if key not in seen:
                seen.add(key)
                r["date_publication"] = day_str
                rows.append(r)
                added += 1
        log.info("Page %d: %d cards, %d new (%d/%d)", n, len(found), added, len(rows), total)
        if len(rows) >= total or added == 0:
            break
        time.sleep(DELAY)
        if not next_page(page, signature(page)):
            raise RuntimeError(f"Timeout waiting for result page {n + 1} "
                               f"({len(rows)}/{total} tenders read)")
    if len(rows) < total:
        log.warning("Read %d of %d tenders for %s", len(rows), total, day_str)
    return rows


# ----------------------------- DETAIL PAGES -----------------------------
def _clean_html_text(s):
    txt = htmllib.unescape(re.sub(r"<[^>]+>", " ", s))
    return re.sub(r"[\s\u00a0\u202f]+", " ", txt).strip()


def span_text(doc, el_id):
    """Text of the element with this id in raw HTML (None when the id is not on the page)."""
    m = re.search(r'id="%s"[^>]*>(.*?)</span>' % re.escape(el_id), doc, re.S)
    return _clean_html_text(m.group(1)) if m else None


def link_of(doc, el_id, base_url):
    """(absolute href, text) of the <a> with this id; (None, None) when absent or without href."""
    m = re.search(r'<a\b([^>]*\bid="%s"[^>]*)>(.*?)</a>' % re.escape(el_id), doc, re.S)
    if not m:
        return None, None
    href = re.search(r'\bhref="([^"]+)"', m.group(1))
    if not href:
        return None, None
    return urljoin(base_url, htmllib.unescape(href.group(1))), _clean_html_text(m.group(2))


def dce_size(text):
    """'Dossier de consultation - 1,89 Mo' -> '1,89 Mo' (None when no size is shown)."""
    m = re.search(r"(\d[\d\s,.]*\s*[KMG]?o)\s*$", text or "", re.I)
    return m.group(1).strip() if m else None


def fetch_details(context, rows, done):
    """Read the detail page of each tender not in `done` and add caution_provisoire_dh,
    dce_url, dce_taille (and categorie when the card had none).
    Never raises: a failed page is retried next run."""
    todo = [r for r in rows if (r.get("ref_consultation"), r.get("organisme")) not in done and r.get("url")]
    if not todo:
        log.info("Detail pages: nothing new to read.")
        return
    if MAX_DETAILS and len(todo) > MAX_DETAILS:
        log.info("Detail pages: %d to read, reading %d this run (the rest next run)", len(todo), MAX_DETAILS)
        todo = todo[:MAX_DETAILS]
    log.info("Reading the detail page of %d tenders (caution provisoire, DCE link)", len(todo))

    ok = with_dce = 0
    for i, r in enumerate(todo, 1):
        ref = r["ref_consultation"]
        try:
            # Plain HTTP request with the browser's cookies: the page is server-rendered,
            # so there is no need to draw it in Chromium (much faster, almost no memory).
            resp = context.request.get(r["url"], timeout=NAV_TIMEOUT * 1000)
            doc = resp.text()
        except Exception as e:
            log.warning("Detail %s: %s", ref, str(e).splitlines()[0])
            continue
        if span_text(doc, DETAIL_CHECK) is None:
            log.warning("Detail %s: not a detail page (HTTP %s), will retry next run", ref, resp.status)
            continue
        r["caution_provisoire_dh"] = parse_amount(span_text(doc, DETAIL_CAUTION))
        if not r.get("categorie"):
            r["categorie"] = span_text(doc, DETAIL_CATEGORIE) or ""
        dce_url, dce_txt = link_of(doc, DETAIL_DCE, resp.url or r["url"])
        r["dce_url"] = dce_url
        r["dce_taille"] = dce_size(dce_txt)
        if dce_url and DCE_PUBLIC_URL:
            r["dce_download_url"] = f"{DCE_PUBLIC_URL}/dce/{r['organisme']}/{ref}"
        with_dce += bool(dce_url)
        r["details_fetched_at"] = datetime.now(TZ)
        ok += 1
        if i % 50 == 0:
            log.info("Detail pages: %d/%d", i, len(todo))
        time.sleep(DETAIL_DELAY)
    log.info("Detail pages read: %d/%d (%d with a DCE link)", ok, len(todo), with_dce)


def scrape(days, show=False, save_html=False, page_size=None, details=True, details_done=None):
    """`details_done(keys)` returns the (ref, org) keys whose detail page was already read."""
    from playwright.sync_api import sync_playwright

    today = datetime.now(TZ).date()
    day_list = [(today - timedelta(days=d)).strftime("%d/%m/%Y") for d in range(days, -1, -1)]

    rows = []
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=not show, args=[
            "--disable-dev-shm-usage", "--disable-gpu", "--disable-extensions",
            "--js-flags=--max-old-space-size=1024"])
        context = browser.new_context(
            locale="fr-FR",
            timezone_id="Africa/Casablanca",
            viewport={"width": 1366, "height": 900},
            user_agent=("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                        "(KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36"),
        )
        # Images, fonts and media are not needed to read the cards: skipping them saves a lot of memory.
        context.route("**/*", lambda r: r.abort() if r.request.resource_type in ("image", "media", "font")
                      else r.continue_())
        page = context.new_page()
        page.on("crash", lambda *_: log.error("The browser page crashed (out of memory?)"))
        try:
            for i, day_str in enumerate(day_list):
                if run_search(page, day_str):
                    rows += read_all_pages(page, day_str, save_html=save_html and i == 0,
                                           page_size=page_size or PAGE_SIZE)
            if details and rows:
                keys = {(r.get("ref_consultation"), r.get("organisme")) for r in rows
                        if r.get("ref_consultation") and r.get("organisme")}
                try:
                    done = details_done(keys) if details_done else set()
                except Exception as e:
                    log.warning("Could not check which details are already known (%s): reading them all",
                                str(e).splitlines()[0])
                    done = set()
                fetch_details(context, rows, done)
        except Exception:
            save_debug(page, "last_error")
            raise
        finally:
            browser.close()
    return rows


# ----------------------------- CLEANING -----------------------------
COLUMNS = ["ref_consultation", "organisme", "reference", "procedure_code", "procedure",
           "categorie", "objet", "acheteur", "lieux", "date_publication", "date_limite", "url",
           "estimation_ttc_dh", "reponse_electronique", "caution_provisoire_dh",
           "dce_url", "dce_taille", "dce_download_url", "details_fetched_at"]

MONTHS = {
    "jan": 1, "janv": 1, "fev": 2, "fév": 2, "feb": 2, "fevr": 2, "févr": 2,
    "mar": 3, "mars": 3, "avr": 4, "apr": 4, "mai": 5, "may": 5, "juin": 6, "jun": 6,
    "juil": 7, "jul": 7, "aou": 8, "aoû": 8, "aug": 8, "sep": 9, "sept": 9,
    "oct": 10, "nov": 11, "dec": 12, "déc": 12,
}
NUM_DATE_RE = re.compile(r"(\d{1,2})/(\d{1,2})/(\d{4})(?:\D+(\d{1,2})[:hH](\d{2}))?")
TXT_DATE_RE = re.compile(r"(\d{1,2})\s+([A-Za-zéûÉÛ]+)\.?\s+(\d{4})(?:\s+(\d{1,2})[:hH](\d{2}))?")


def parse_datetime(text):
    """'Jeu 07 Jan 2027 11:00' or '07/01/2027 11:00' -> datetime (Morocco local time)."""
    text = text or ""
    try:
        m = NUM_DATE_RE.search(text)
        if m:
            d, mo, y, hh, mm = m.groups()
            return datetime(int(y), int(mo), int(d), int(hh or 0), int(mm or 0))
        m = TXT_DATE_RE.search(text)
        if m:
            d, mon, y, hh, mm = m.groups()
            mo = MONTHS.get(mon.lower())
            if mo:
                return datetime(int(y), mo, int(d), int(hh or 0), int(mm or 0))
    except ValueError:
        pass
    return None


def parse_date(text):
    dt = parse_datetime(text)
    return dt.date() if dt else None


def parse_amount(v):
    """1386563.64, '1 386 563,64' or '20 000,00 MAD' -> float ('-' or empty -> None)."""
    if v in (None, ""):
        return None
    try:
        return float(v)
    except (TypeError, ValueError):
        s = re.sub(r"[^\d,.-]", "", str(v)).replace(",", ".")
        try:
            return float(s) if s else None
        except ValueError:
            return None


def clean(rows):
    out, seen = [], set()
    for r in rows:
        ref = str(r.get("ref_consultation") or "").strip()
        org = str(r.get("organisme") or "").strip()
        if not ref or not org or (ref, org) in seen:
            continue
        seen.add((ref, org))
        rec = {c: (str(r.get(c)).strip() if r.get(c) not in (None, "") else None) for c in COLUMNS}
        rec["ref_consultation"], rec["organisme"] = ref, org
        rec["date_publication"] = parse_date(r.get("date_publication"))
        # CSVs from the notebook have the raw text in date_limite_brut
        rec["date_limite"] = parse_datetime(r.get("date_limite_brut") or r.get("date_limite"))
        rec["estimation_ttc_dh"] = parse_amount(r.get("estimation_ttc_dh"))
        rec["caution_provisoire_dh"] = parse_amount(r.get("caution_provisoire_dh"))
        rec["details_fetched_at"] = r.get("details_fetched_at") or None
        out.append(rec)
    return out


# ----------------------------- DATABASE -----------------------------
SCHEMA_SQL = """
CREATE TABLE IF NOT EXISTS tenders (
    id               BIGSERIAL PRIMARY KEY,
    ref_consultation TEXT        NOT NULL,
    organisme        TEXT        NOT NULL,
    reference        TEXT,
    procedure_code   TEXT,
    procedure        TEXT,
    categorie        TEXT,
    objet            TEXT,
    acheteur         TEXT,
    lieux            TEXT,
    date_publication DATE,
    date_limite      TIMESTAMP,
    url              TEXT,
    first_seen_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    search_vector    TSVECTOR GENERATED ALWAYS AS (
        to_tsvector('french',
            coalesce(reference,'') || ' ' || coalesce(objet,'') || ' ' || coalesce(acheteur,''))
    ) STORED,
    UNIQUE (ref_consultation, organisme)
);
-- New fields (added once, existing rows untouched).
ALTER TABLE tenders ADD COLUMN IF NOT EXISTS estimation_ttc_dh     NUMERIC(16,2);
ALTER TABLE tenders ADD COLUMN IF NOT EXISTS reponse_electronique  TEXT;
ALTER TABLE tenders ADD COLUMN IF NOT EXISTS caution_provisoire_dh NUMERIC(16,2);
ALTER TABLE tenders ADD COLUMN IF NOT EXISTS details_fetched_at    TIMESTAMPTZ;
ALTER TABLE tenders ADD COLUMN IF NOT EXISTS dce_url               TEXT;
ALTER TABLE tenders ADD COLUMN IF NOT EXISTS dce_taille            TEXT;
ALTER TABLE tenders ADD COLUMN IF NOT EXISTS dce_download_url      TEXT;
"""

UPDATABLE = [c for c in COLUMNS if c not in ("ref_consultation", "organisme")]
# COALESCE: a field the new layout doesn't show (e.g. categorie) keeps its known value.
_set = ",\n    ".join(f"{c} = COALESCE(EXCLUDED.{c}, tenders.{c})" for c in UPDATABLE)
_old = ", ".join(f"tenders.{c}" for c in UPDATABLE)
_new = ", ".join(f"COALESCE(EXCLUDED.{c}, tenders.{c})" for c in UPDATABLE)
UPSERT_SQL = f"""
INSERT INTO tenders ({", ".join(COLUMNS)})
VALUES %s
ON CONFLICT (ref_consultation, organisme) DO UPDATE SET
    {_set},
    updated_at = now()
WHERE ({_old}) IS DISTINCT FROM ({_new})
RETURNING (xmax = 0) AS inserted;
"""

# "Already read" = detail page read AND DCE link known. Tenders read by v6 (no dce_url yet)
# are read again the next time the search returns them.
KNOWN_DETAILS_SQL = """
SELECT t.ref_consultation, t.organisme
FROM tenders t
JOIN unnest(%s::text[], %s::text[]) AS k(ref, org)
  ON t.ref_consultation = k.ref AND t.organisme = k.org
WHERE t.details_fetched_at IS NOT NULL
  AND t.dce_url IS NOT NULL;
"""


def known_details(keys):
    """(ref, org) keys whose detail page is already in the database."""
    import psycopg2

    if not keys:
        return set()
    refs, orgs = zip(*keys)
    conn = psycopg2.connect(connect_timeout=15, **DB_CONFIG)
    try:
        with conn, conn.cursor() as cur:
            cur.execute(SCHEMA_SQL)            # first run: creates the new columns
            cur.execute(KNOWN_DETAILS_SQL, (list(refs), list(orgs)))
            return set(cur.fetchall())
    finally:
        conn.close()


def save(records):
    """Upsert the records. Returns (new, updated, unchanged)."""
    import psycopg2
    from psycopg2.extras import execute_values

    if not records:
        return 0, 0, 0
    values = [tuple(r[c] for c in COLUMNS) for r in records]
    conn = psycopg2.connect(connect_timeout=15, **DB_CONFIG)
    try:
        with conn, conn.cursor() as cur:
            cur.execute(SCHEMA_SQL)
            result = execute_values(cur, UPSERT_SQL, values, page_size=500, fetch=True)
    finally:
        conn.close()
    new = sum(1 for (inserted,) in result if inserted)
    updated = len(result) - new
    return new, updated, len(records) - len(result)


def read_csv(path):
    with open(path, newline="", encoding="utf-8-sig") as f:
        return list(csv.DictReader(f))


# ----------------------------- MAIN -----------------------------
def main(argv=None):
    """argv=None reads the command line; in a notebook pass a list, e.g. main(["--dry-run"])."""
    ap = argparse.ArgumentParser(description="Fetch the latest tenders into PostgreSQL.")
    ap.add_argument("--days", type=int, default=int(os.getenv("SCRAPE_DAYS", "1")), help="how many days back to search, besides today (default 1 = yesterday + today)")
    ap.add_argument("--dry-run", action="store_true", help="don't write to the database")
    ap.add_argument("--no-details", action="store_true", help="don't open the detail pages (no caution, no DCE link)")
    ap.add_argument("--show", action="store_true", help="visible browser (debugging)")
    ap.add_argument("--save-html", action="store_true", help="save the first results page for inspection")
    ap.add_argument("--from-csv", metavar="FILE", help="import this CSV instead of scraping")
    if argv is None and "ipykernel" in sys.modules:
        argv = []                 # in a notebook, sys.argv belongs to Jupyter
    args = ap.parse_args(argv)

    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s",
                        datefmt="%Y-%m-%d %H:%M:%S")

    lock = open(LOCK_FILE, "w")
    try:
        try:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            log.warning("Another run is still in progress — skipping this one.")
            return 0
        return _run(args)
    finally:
        lock.close()   # releases the lock, even after an error


def _run(args):
    started = time.time()
    if args.from_csv:
        raw = read_csv(args.from_csv)
        log.info("%s: %d rows", args.from_csv, len(raw))
    else:
        raw = None
        for attempt in range(1, ATTEMPTS + 1):
            try:
                size = ([PAGE_SIZE] + FALLBACK_SIZES)[min(attempt - 1, len(FALLBACK_SIZES))]
                if attempt > 1:
                    log.info("Retrying with %s results per page", size)
                raw = scrape(max(0, args.days), show=args.show, save_html=args.save_html, page_size=size,
                             details=not args.no_details,
                             details_done=None if args.dry_run else known_details)
                break
            except Exception as e:
                msg = str(e).splitlines()[0]
                log.error("Attempt %d/%d failed: %s", attempt, ATTEMPTS, msg)
                # Setup errors won't fix themselves by retrying: stop now.
                if "Executable doesn't exist" in msg or "asyncio loop" in msg:
                    log.error("Setup problem, not a site problem: see the message above.")
                    return 1
                if attempt < ATTEMPTS:
                    time.sleep(30 * attempt)
        if raw is None:
            log.error("Giving up: the site could not be scraped this time.")
            return 1

    records = clean(raw)
    if args.dry_run:
        for r in records[:5]:
            log.info("  %s | %s | %s | %s DH | caution %s DH | limite %s | DCE %s (%s) | download %s",
                     r["reference"], r["procedure_code"], (r["objet"] or "")[:50], r["estimation_ttc_dh"],
                     r["caution_provisoire_dh"], r["date_limite"], r["dce_url"], r["dce_taille"],
                     r["dce_download_url"])
        log.info("Dry run: %d tenders found, database not touched.", len(records))
        return 0

    try:
        new, updated, unchanged = save(records)
    except Exception as e:
        log.error("Database error: %s", e)
        return 1
    log.info("Done in %.0fs: %d found, %d new, %d updated, %d unchanged.",
             time.time() - started, len(records), new, updated, unchanged)
    return 0


MAX_RUNTIME = int(os.getenv("MAX_RUNTIME", "2700"))   # seconds (45 min): a stuck run is killed


def _kill_children():
    """Stop every process started by this one (Playwright driver + Chromium), deepest first."""
    import signal
    import subprocess

    def children(pid):
        try:
            out = subprocess.run(["pgrep", "-P", str(pid)], capture_output=True, text=True, timeout=5).stdout
        except Exception:
            return []
        kids = [int(x) for x in out.split()]
        return [d for k in kids for d in children(k)] + kids

    pids = children(os.getpid())
    for sig in (signal.SIGTERM, signal.SIGKILL):
        for pid in pids:
            try:
                os.kill(pid, sig)
            except Exception:
                pass
        time.sleep(1)


def _watchdog():
    """Kill this process if it runs too long, so stuck runs never pile up (scripts only, not notebooks)."""
    import threading

    def stop():
        log.error("Run took more than %d s: stopping it (the next hourly run will catch up).", MAX_RUNTIME)
        logging.shutdown()
        _kill_children()     # the browser processes started by this run
        os._exit(3)

    t = threading.Timer(MAX_RUNTIME, stop)
    t.daemon = True
    t.start()


if __name__ == "__main__":
    _watchdog()
    sys.exit(main())
