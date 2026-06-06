"""
scrape_rbi.py — ScamShield RBI DLA Dataset Ingestion Script
============================================================

Purpose
-------
Fetches the Reserve Bank of India's Digital Lending App (DLA) directory and
produces a structured JSON file consumed by the ScamShield backend's scoring
engine. The JSON is written to ../backend/data/rbi_dla_dataset.json by default.

Why this matters
----------------
The RBI DLA list is the authoritative source of apps that are legitimately
associated with RBI-regulated entities (banks, NBFCs). ScamShield uses this
to instantly clear apps that appear in the list, and to flag finance apps
that claim to be registered lenders but are absent from it.

The list is self-reported by Regulated Entities (REs) via the RBI's CIMS
portal — inclusion is NOT a conduct endorsement. We surface this disclaimer
in the output JSON and in every UI verdict that references it.

Usage
-----
  python3 scrape_rbi.py                   # live fetch, write to default path
  python3 scrape_rbi.py --test            # use local fixture, no network
  python3 scrape_rbi.py --output /tmp/x   # override output path
  python3 scrape_rbi.py --verbose         # print each record as it's processed
  python3 scrape_rbi.py --test --verbose  # combine flags

Dependencies: requests, beautifulsoup4, pandas, openpyxl, lxml
Install: pip install -r requirements.txt
"""

from __future__ import annotations

import argparse
import json
import os
import re
import string
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

# ---------------------------------------------------------------------------
# Third-party imports — give a helpful message if not installed
# ---------------------------------------------------------------------------
try:
    import requests
    from bs4 import BeautifulSoup
    import pandas as pd
except ImportError as exc:
    print(
        f"[ERROR] Missing dependency: {exc}\n"
        "Run: pip install -r requirements.txt",
        file=sys.stderr,
    )
    sys.exit(1)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

# The RBI DLA list page (June 2025 — check periodically; the URL may change).
RBI_DLA_URL = (
    "https://www.rbi.org.in/Scripts/PublicationReportDetails.aspx?UrlPage=&ID=1308"
)

# RBI NBFC master list (we use it to build the nbfcList field).
RBI_NBFC_URL = "https://www.rbi.org.in/Scripts/BS_NBFCList.aspx"

# HTTP request timeout in seconds. The RBI site can be slow from outside India.
REQUEST_TIMEOUT = 10

# User-Agent header. RBI blocks generic Python/requests UAs; a browser-like
# UA is required. We also identify ourselves as the ScamShield bot.
HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (compatible; ScamShield-Bot/1.0; +https://scamshield.ai/bot)"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
}

# Disclaimer text required in the output JSON (matches UI copy).
DISCLAIMER = (
    "This list is self-reported by regulated entities to RBI via CIMS. "
    "Inclusion confirms a claimed association with a regulated entity — "
    "it is not an endorsement of conduct or a guarantee of legitimacy."
)

# Words removed during name normalisation. These are common corporate suffixes
# and sector terms that prevent matching "KreditBee Pvt Ltd" with "KreditBee".
NOISE_WORDS = {
    "pvt", "ltd", "limited", "private", "technologies", "technology", "tech",
    "finserv", "financial", "finance", "services", "service", "india",
    "solutions", "solution", "ventures", "venture", "capital", "group",
    "holdings", "holding", "digital", "payments", "payment", "corporation",
    "incorporated", "enterprises",
}

# ---------------------------------------------------------------------------
# Fallback NBFC / bank list (used when the live NBFC page is unreachable).
# This covers the most commonly encountered REs in DLA disclosures.
# ---------------------------------------------------------------------------
FALLBACK_NBFC_LIST = [
    "Axis Bank Limited",
    "HDFC Bank Limited",
    "ICICI Bank Limited",
    "State Bank of India",
    "Kotak Mahindra Bank Limited",
    "IndusInd Bank Limited",
    "Yes Bank Limited",
    "IDFC First Bank Limited",
    "Bajaj Finance Limited",
    "IIFL Finance Limited",
    "Muthoot Finance Limited",
    "Manappuram Finance Limited",
    "Tata Capital Financial Services Limited",
    "Piramal Capital & Housing Finance Limited",
    "L&T Finance Limited",
    "Hero FinCorp Limited",
    "Aditya Birla Finance Limited",
    "PayU Finance India Pvt Ltd",
    "PaySense Services India Pvt Ltd",
    "Whizdm Innovations Pvt Ltd",
]

# ---------------------------------------------------------------------------
# Mock data for --test mode (20 representative records, no network needed).
# This allows CI pipelines and developers to test the pipeline offline.
# ---------------------------------------------------------------------------
MOCK_RECORDS_RAW = [
    ("CashKaro", "Axis Bank Limited"),
    ("KreditBee", "IIFL Finance Limited"),
    ("MoneyView", "Whizdm Innovations Pvt Ltd"),
    ("LazyPay", "PayU Finance India Pvt Ltd"),
    ("PaySense", "PaySense Services India Pvt Ltd"),
    ("EarlySalary", "IDFC First Bank Limited"),
    ("Stashfin", "Stashfin Credit Line Pvt Ltd"),
    ("Navi", "Navi Finserv Pvt Ltd"),
    ("mPokket", "mPokket Pvt Ltd"),
    ("SlicePay", "Quadrillion Finance Pvt Ltd"),
    ("Fibe", "Social Worth Technologies Pvt Ltd"),
    ("SmartCoin", "SmartCoin Financials Pvt Ltd"),
    ("CreditBee", "IIFL Finance Limited"),       # duplicate — should be de-duped
    ("Dhani Loans", "Indiabulls Consumer Finance Ltd"),
    ("Jupiter", "Federal Bank Limited"),
    ("Fi Money", "Federal Bank Limited"),
    ("Freo", "MUFG Bank Ltd"),
    ("Kissht", "OnEMI Technology Solutions Pvt Ltd"),
    ("Uni Cards", "Liquiloans Pvt Ltd"),
    ("True Balance", "True Credits Pvt Ltd"),
]


# ---------------------------------------------------------------------------
# Core functions
# ---------------------------------------------------------------------------

def normalize_name(name: str) -> str:
    """
    Reduce an app or entity name to a canonical form for deduplication and
    fuzzy matching. The goal is that "KreditBee Pvt Ltd" and "KreditBee"
    both produce "kreditbee".

    Steps:
    1. Lowercase.
    2. Remove all punctuation (handles hyphens, ampersands, dots, etc.).
    3. Split into tokens.
    4. Drop tokens in NOISE_WORDS.
    5. Rejoin with a single space and strip.
    """
    if not name or not name.strip():
        return ""

    # Step 1 — lowercase
    text = name.lower()

    # Step 2 — strip punctuation (replace with space to avoid merging tokens)
    text = text.translate(str.maketrans(string.punctuation, " " * len(string.punctuation)))

    # Step 3 — tokenise
    tokens = text.split()

    # Step 4 — remove noise words
    tokens = [t for t in tokens if t not in NOISE_WORDS]

    # Step 5 — rejoin
    return " ".join(tokens).strip()


def fetch_page(url: str, verbose: bool = False) -> Optional[str]:
    """
    Fetch an HTML page from the RBI website. Returns the HTML string or None
    on any network / HTTP error.

    We set a strict timeout so the script doesn't hang indefinitely if the
    RBI site is slow (common from outside India).
    """
    if verbose:
        print(f"[FETCH] GET {url}")

    try:
        response = requests.get(url, headers=HEADERS, timeout=REQUEST_TIMEOUT)
        response.raise_for_status()
        return response.text
    except requests.exceptions.Timeout:
        print(
            f"[ERROR] Request to {url} timed out after {REQUEST_TIMEOUT}s.\n"
            "The RBI website is often slow from outside India. Try:\n"
            "  1. Running from an Indian IP (VPN or cloud server)\n"
            "  2. Opening the URL in a browser, saving the page, and passing "
            "it via --test with a custom fixture.",
            file=sys.stderr,
        )
    except requests.exceptions.ConnectionError:
        print(
            f"[ERROR] Cannot connect to {url}.\n"
            "Check your internet connection or try --test mode.",
            file=sys.stderr,
        )
    except requests.exceptions.HTTPError as exc:
        print(f"[ERROR] HTTP {exc.response.status_code} from {url}.", file=sys.stderr)
    except Exception as exc:  # noqa: BLE001
        print(f"[ERROR] Unexpected error fetching {url}: {exc}", file=sys.stderr)

    return None


def find_download_link(html: str, verbose: bool = False) -> Optional[str]:
    """
    Look for a CSV or XLSX download link in the RBI page.

    The RBI occasionally publishes DLA data as downloadable files rather than
    inline tables. We check for these first because parsing a structured file
    is more reliable than scraping HTML.

    Returns the absolute URL of the first CSV/XLSX link found, or None.
    """
    soup = BeautifulSoup(html, "lxml")
    base = "https://www.rbi.org.in"

    for a in soup.find_all("a", href=True):
        href: str = a["href"]
        if any(href.lower().endswith(ext) for ext in (".csv", ".xlsx", ".xls")):
            full_url = href if href.startswith("http") else base + href
            if verbose:
                print(f"[FOUND] Download link: {full_url}")
            return full_url

    return None


def download_and_parse_file(url: str, verbose: bool = False) -> list[dict]:
    """
    Download a CSV or XLSX file from the given URL and parse it into a list
    of raw dicts with keys 'dlaName' and 'registeredEntity'.

    We use pandas because it handles multi-sheet XLSX files gracefully and
    automatically detects column types.
    """
    if verbose:
        print(f"[DOWNLOAD] Fetching file: {url}")

    try:
        response = requests.get(url, headers=HEADERS, timeout=REQUEST_TIMEOUT)
        response.raise_for_status()
    except Exception as exc:  # noqa: BLE001
        print(f"[ERROR] Could not download file {url}: {exc}", file=sys.stderr)
        return []

    import io
    content = response.content

    try:
        if url.lower().endswith(".csv"):
            df = pd.read_csv(io.BytesIO(content))
        else:
            df = pd.read_excel(io.BytesIO(content))
    except Exception as exc:  # noqa: BLE001
        print(f"[ERROR] Could not parse file from {url}: {exc}", file=sys.stderr)
        return []

    # Normalise column names for lookup — lowercase, strip whitespace
    df.columns = [str(c).lower().strip() for c in df.columns]

    # Try to find the DLA name column (various possible headers)
    dla_col = _find_column(df, ["name of dla", "dla name", "app name", "application name"])
    re_col = _find_column(df, ["name of re", "re name", "registered entity", "regulated entity", "lender"])

    if not dla_col or not re_col:
        print(
            f"[ERROR] Could not identify DLA/RE columns in file. "
            f"Found columns: {list(df.columns)}",
            file=sys.stderr,
        )
        return []

    records = []
    for _, row in df.iterrows():
        dla = str(row.get(dla_col, "")).strip()
        re_name = str(row.get(re_col, "")).strip()
        if dla and re_name and dla.lower() not in ("nan", "none", ""):
            records.append({"dlaName": dla, "registeredEntity": re_name})

    if verbose:
        print(f"[PARSED] {len(records)} records from file")
    return records


def _find_column(df: "pd.DataFrame", candidates: list[str]) -> Optional[str]:
    """Return the first column name that matches any candidate (case-insensitive)."""
    cols_lower = {c.lower(): c for c in df.columns}
    for candidate in candidates:
        if candidate in cols_lower:
            return cols_lower[candidate]
    return None


def parse_html_table(html: str, verbose: bool = False) -> list[dict]:
    """
    Parse the DLA list from an HTML table. This is the fallback path when
    no downloadable file is found.

    The RBI page typically contains a single <table> with columns:
      "Name of DLA" | "Name of RE"

    We locate the header row to determine column indices, then iterate the
    data rows. We log a detailed snippet if parsing fails so developers can
    quickly diagnose a format change.

    Returns a list of dicts with 'dlaName' and 'registeredEntity'.
    """
    soup = BeautifulSoup(html, "lxml")

    # Find all tables; prefer tables with a header mentioning "DLA" or "app"
    tables = soup.find_all("table")
    if not tables:
        print(
            "[ERROR] No <table> elements found on page. The RBI page format "
            "may have changed. First 500 chars of body:\n"
            + (soup.get_text()[:500]),
            file=sys.stderr,
        )
        return []

    target_table = None
    dla_col_idx: int = -1
    re_col_idx: int = -1

    for table in tables:
        headers = [th.get_text(strip=True).lower() for th in table.find_all("th")]
        if not headers:
            # Some RBI tables use <td> for headers in the first row
            first_row = table.find("tr")
            if first_row:
                headers = [td.get_text(strip=True).lower() for td in first_row.find_all("td")]

        for i, h in enumerate(headers):
            if "dla" in h or "app" in h or "application" in h:
                dla_col_idx = i
            if "re" in h or "entity" in h or "lender" in h or "bank" in h:
                re_col_idx = i

        if dla_col_idx >= 0 and re_col_idx >= 0:
            target_table = table
            break

    if target_table is None:
        # Last resort: use the largest table (most likely to be the data table)
        target_table = max(tables, key=lambda t: len(t.find_all("tr")))
        dla_col_idx = 0
        re_col_idx = 1
        if verbose:
            print(
                "[WARN] Could not identify column headers. Assuming column 0 = DLA, "
                "column 1 = RE (largest table heuristic)."
            )

    records = []
    rows = target_table.find_all("tr")

    # Skip the first row (header)
    for row in rows[1:]:
        cells = row.find_all(["td", "th"])
        if len(cells) <= max(dla_col_idx, re_col_idx):
            continue  # malformed row, skip

        dla = cells[dla_col_idx].get_text(strip=True)
        re_name = cells[re_col_idx].get_text(strip=True) if re_col_idx < len(cells) else ""

        if not dla or dla.lower() in ("nan", "n/a", "-", ""):
            continue

        record = {"dlaName": dla, "registeredEntity": re_name}

        if verbose:
            print(f"  [RECORD] {dla!r} → {re_name!r}")

        records.append(record)

    if verbose:
        print(f"[PARSED] {len(records)} rows from HTML table")

    return records


def fetch_nbfc_list(verbose: bool = False) -> list[str]:
    """
    Fetch the list of registered NBFCs from the RBI NBFC master list page.

    This is used to populate the nbfcList field in the output JSON, which
    the backend uses to validate "registered entity" claims.

    Falls back to FALLBACK_NBFC_LIST if the page is unreachable (common in
    test / offline environments).
    """
    html = fetch_page(RBI_NBFC_URL, verbose=verbose)
    if not html:
        if verbose:
            print("[WARN] Using hardcoded fallback NBFC list.")
        return FALLBACK_NBFC_LIST

    soup = BeautifulSoup(html, "lxml")
    nbfc_names: list[str] = []

    # The NBFC list page typically has a table with company names in column 1
    for table in soup.find_all("table"):
        rows = table.find_all("tr")
        for row in rows[1:]:  # skip header
            cells = row.find_all("td")
            if cells:
                name = cells[0].get_text(strip=True)
                if name and len(name) > 2:
                    nbfc_names.append(name)

    if not nbfc_names:
        if verbose:
            print("[WARN] Could not parse NBFC list; using fallback.")
        return FALLBACK_NBFC_LIST

    # De-duplicate (preserve order)
    seen: set[str] = set()
    unique: list[str] = []
    for n in nbfc_names:
        if n not in seen:
            seen.add(n)
            unique.append(n)

    if verbose:
        print(f"[NBFC] Found {len(unique)} unique NBFCs/banks")

    return unique


def deduplicate(raw_records: list[dict], verbose: bool = False) -> list[dict]:
    """
    De-duplicate records by normalised DLA name. When the same DLA appears
    under multiple regulated entities (common for wallets associated with
    multiple banks), we keep the FIRST occurrence.

    We also assign normalised versions of both name fields here so they're
    available in one pass.
    """
    seen_names: set[str] = set()
    deduped: list[dict] = []

    for r in raw_records:
        norm_dla = normalize_name(r.get("dlaName", ""))
        norm_entity = normalize_name(r.get("registeredEntity", ""))

        if not norm_dla:
            continue  # skip empty rows

        if norm_dla in seen_names:
            if verbose:
                print(f"  [DEDUP] Skipping duplicate: {r['dlaName']!r}")
            continue

        seen_names.add(norm_dla)
        deduped.append({
            "dlaName": r["dlaName"].strip(),
            "registeredEntity": r.get("registeredEntity", "").strip(),
            "packageId": None,  # populated later by Play Store enrichment
            "normalizedDlaName": norm_dla,
            "normalizedEntityName": norm_entity,
        })

    return deduped


def generate_mock_records(verbose: bool = False) -> tuple[list[dict], list[str]]:
    """
    Generate 20 mock DLA records without making any network requests.
    Used in --test mode for CI pipelines and offline development.

    Also returns a mock NBFC list derived from the mock records' REs.
    """
    if verbose:
        print("[TEST] Generating mock data (no network calls)")

    raw = [{"dlaName": name, "registeredEntity": re_} for name, re_ in MOCK_RECORDS_RAW]
    records = deduplicate(raw, verbose=verbose)

    # Build mock NBFC list from unique REs in mock data
    nbfc_list = list(dict.fromkeys(r["registeredEntity"] for r in records))

    return records, nbfc_list


def load_fixture(fixture_path: Path, verbose: bool = False) -> list[dict]:
    """
    Parse the local HTML fixture file for --test mode HTML parsing tests.
    Returns raw records (pre-deduplication).
    """
    if verbose:
        print(f"[FIXTURE] Reading {fixture_path}")
    html = fixture_path.read_text(encoding="utf-8")
    return parse_html_table(html, verbose=verbose)


def write_output(
    records: list[dict],
    nbfc_list: list[str],
    source_url: str,
    output_path: Path,
    verbose: bool = False,
) -> None:
    """
    Serialize the processed records to JSON and write to output_path.

    The output format is consumed by the ScamShield backend's /api/verify
    endpoint and the rbi_check module in the scoring engine.
    """
    output_path.parent.mkdir(parents=True, exist_ok=True)

    payload = {
        "fetchedAt": datetime.now(timezone.utc).isoformat(),
        "recordCount": len(records),
        "sourceUrl": source_url,
        "disclaimer": DISCLAIMER,
        "records": records,
        "nbfcList": nbfc_list,
    }

    output_path.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )

    print(f"[OK] Written {len(records)} records to {output_path}")


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

def main() -> None:
    parser = argparse.ArgumentParser(
        description="Scrape the RBI Digital Lending App directory for ScamShield.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    parser.add_argument(
        "--test",
        action="store_true",
        help="Use mock/fixture data instead of fetching from RBI (no network needed).",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=Path(__file__).parent.parent / "backend" / "data" / "rbi_dla_dataset.json",
        help="Path to write the output JSON (default: ../backend/data/rbi_dla_dataset.json).",
    )
    parser.add_argument(
        "--verbose",
        action="store_true",
        help="Print detailed progress and each record as it is processed.",
    )
    args = parser.parse_args()

    output_path: Path = args.output
    verbose: bool = args.verbose

    print(f"ScamShield RBI Ingestion — output: {output_path}")

    # ------------------------------------------------------------------
    # TEST MODE: use mock data, skip all network calls
    # ------------------------------------------------------------------
    if args.test:
        records, nbfc_list = generate_mock_records(verbose=verbose)
        write_output(records, nbfc_list, RBI_DLA_URL + " (test mode)", output_path, verbose)
        return

    # ------------------------------------------------------------------
    # LIVE MODE: fetch from RBI
    # ------------------------------------------------------------------

    # Step 1: Fetch the DLA page
    html = fetch_page(RBI_DLA_URL, verbose=verbose)
    if not html:
        print(
            "\n[FATAL] Could not fetch RBI DLA page. Options:\n"
            "  1. Run with --test to use mock data\n"
            "  2. Try from an Indian IP / VPN\n"
            "  3. Download the page manually and pass it via fixture",
            file=sys.stderr,
        )
        sys.exit(1)

    # Step 2: Look for a CSV/XLSX download link first (more reliable)
    raw_records: list[dict] = []
    download_url = find_download_link(html, verbose=verbose)

    if download_url:
        raw_records = download_and_parse_file(download_url, verbose=verbose)

    # Step 3: Fall back to HTML table parsing if no file was found/parsed
    if not raw_records:
        if verbose:
            print("[INFO] No download link found; parsing HTML table directly.")
        raw_records = parse_html_table(html, verbose=verbose)

    if not raw_records:
        print(
            "[FATAL] Could not parse any DLA records from the RBI page.\n"
            "The page format may have changed. Run with --verbose to see details.",
            file=sys.stderr,
        )
        sys.exit(1)

    # Step 4: De-duplicate
    records = deduplicate(raw_records, verbose=verbose)
    print(f"[INFO] {len(raw_records)} raw rows → {len(records)} unique records after deduplication")

    # Step 5: Fetch NBFC list (best-effort; falls back to hardcoded list)
    nbfc_list = fetch_nbfc_list(verbose=verbose)

    # Step 6: Write output
    write_output(records, nbfc_list, RBI_DLA_URL, output_path, verbose)


if __name__ == "__main__":
    main()
