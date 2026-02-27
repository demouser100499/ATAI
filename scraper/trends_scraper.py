#!/usr/bin/env python3
"""
trends_scraper.py
─────────────────
Scrapes the Google Trends "Trending Now" page using Selenium, returning a JSON
array of trending keyword strings for a given geographic region and category.

Usage:
  python trends_scraper.py --geo IN --category 1 --hours 168 --limit 20

Arguments:
  --geo          ISO country/region code (e.g. IN, US, GB). Default: US
  --category     Google Trends Trending Now category ID (0 = All). Default: 0
  --hours        Time window in hours: 4 | 24 | 48 | 168 (7 days). Default: 168
  --limit        Maximum keywords to return. Default: 50
  --no-headless  Show the browser window (useful for local debugging)

Stdout:
  JSON object: { "keywords": [...], "count": N, "geo": "...", "category": "...",
                 "category_name": "...", "hours": "..." }

Exit codes:
  0 — success (keywords may be empty if none are trending in the selected filter)
  1 — unrecoverable error (JSON error object still written to stdout for the caller)
"""

import argparse
import json
import re
import sys
import time
from datetime import datetime

from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC


# ─── Constants ───────────────────────────────────────────────────────────────

CATEGORY_NAMES: dict[str, str] = {
    "0":  "All categories",
    "1":  "Autos and Vehicles",
    "2":  "Beauty and Fashion",
    "3":  "Business and Finance",
    "4":  "Entertainment",
    "5":  "Food and Drink",
    "6":  "Games",
    "7":  "Health",
    "8":  "Hobbies and Leisure",
    "9":  "Jobs and Education",
    "10": "Law and Government",
    "11": "Other",
    "13": "Pets and Animals",
    "14": "Politics",
    "15": "Science",
    "16": "Shopping",
    "17": "Sports",
    "18": "Technology",
    "19": "Travel and Transportation",
    "20": "Climate",
}

# Strings that appear in Google Trends UI JSON but are not valid keywords
_UI_NOISE: set[str] = {
    "trending", "google trends", "interest", "google", "export", "relevance",
    "started", "hours", "days", "volume", "ago", "active", "breakdown", "past",
    "week", "embed", "privacy", "help", "feedback", "all", "rows per page",
    "show more", "back", "home", "explore", "by relevance", "all trends",
    "all categories", "trending now",
}


# ─── Utilities ────────────────────────────────────────────────────────────────

def _log(level: str, message: str) -> None:
    """Write a timestamped structured log line to stderr (keeps stdout clean for JSON)."""
    ts = datetime.utcnow().strftime("%H:%M:%S")
    print(f"[{ts}] [trends_scraper] [{level}] {message}", file=sys.stderr)


def _build_driver(headless: bool) -> webdriver.Chrome:
    """
    Initialise a Chrome WebDriver with anti-bot-detection options.
    Uses Chrome's new headless mode when headless=True.
    """
    options = Options()
    options.add_argument("--no-sandbox")
    options.add_argument("--disable-dev-shm-usage")
    options.add_argument("--disable-gpu")
    options.add_argument("--window-size=1920,1080")
    options.add_argument("--lang=en-US")
    options.add_argument("--disable-blink-features=AutomationControlled")
    options.add_experimental_option("excludeSwitches", ["enable-automation"])
    options.add_experimental_option("useAutomationExtension", False)
    options.add_argument(
        "user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
    )
    if headless:
        options.add_argument("--headless=new")

    driver = webdriver.Chrome(options=options)
    # Mask the webdriver property so the page doesn't block headless access
    driver.execute_script(
        "Object.defineProperty(navigator, 'webdriver', {get: () => undefined})"
    )
    return driver


def _extract_from_page_source(page_source: str, limit: int) -> list[str]:
    """
    Regex-based extraction from the hydrated JSON blobs embedded in the page source.
    Used as a last-resort fallback when DOM element selectors return nothing.

    Google Trends embeds trending data as JSON with "title", "query", and
    "entityTitle" keys — we extract values from all three patterns.
    """
    keywords: list[str] = []
    seen: set[str] = set()

    patterns = [
        re.compile(r'"title"\s*:\s*"([^"]{3,80})"'),
        re.compile(r'"query"\s*:\s*"([^"]{3,80})"'),
        re.compile(r'"entityTitle"\s*:\s*"([^"]{3,80})"'),
    ]
    for pattern in patterns:
        for match in pattern.findall(page_source):
            kw = match.strip()
            key = kw.lower()
            if kw and key not in _UI_NOISE and kw not in seen:
                seen.add(kw)
                keywords.append(kw)
                if len(keywords) >= limit:
                    return keywords

    return keywords[:limit]


# ─── Core Scraping Logic ──────────────────────────────────────────────────────

def scrape_trending(geo: str, category: str, hours: str, limit: int, headless: bool) -> list[str]:
    """
    Open Google Trends Trending Now and extract trending keyword strings.

    Three extraction strategies are tried in order (most specific → most general):
      1. Angular web-component CSS selectors (feed-item-header, mwc-list-item, etc.)
      2. ARIA role-based element selectors ([role='row'], [role='listitem'])
      3. JSON regex extraction from the fully hydrated page source (most reliable)

    Returns a deduplicated list of up to `limit` keywords.
    """
    url = (
        f"https://trends.google.com/trending"
        f"?geo={geo}&category={category}&hours={hours}&hl=en-US"
    )
    category_name = CATEGORY_NAMES.get(str(category), f"category={category}")
    _log("INFO", f"Target URL: {url}")

    driver = None
    try:
        driver = _build_driver(headless)
        driver.get(url)

        # Wait for the Angular page to finish rendering the trend feed
        _log("INFO", "Waiting 4s for page JS rendering...")
        time.sleep(4)

        keywords: list[str] = []
        seen: set[str] = set()

        def _add(text: str) -> None:
            """Normalise, deduplicate, and append a keyword."""
            t = text.strip().split("\n")[0].strip()
            if t and 3 <= len(t) <= 100 and t not in seen:
                seen.add(t)
                keywords.append(t)

        # ── Strategy 1: Angular web-component CSS selectors ──────────────────
        _log("INFO", "Strategy 1 — Angular component CSS selectors...")
        COMPONENT_SELECTORS = [
            "feed-list-item",
            "mwc-list-item",
            ".K5L6z",
            "[class*='mZ3RIc']",
            "[jsname='oKdM2c']",
            ".trend-link",
            ".item-label",
        ]
        for selector in COMPONENT_SELECTORS:
            try:
                elements = driver.find_elements(By.CSS_SELECTOR, selector)
                if elements:
                    for el in elements:
                        _add(el.text.strip())
                    if keywords:
                        _log("INFO", f"  → Strategy 1 succeeded ('{selector}'): {len(keywords)} keyword(s)")
                        break
            except Exception:
                continue

        # ── Strategy 2: ARIA role-based selectors ────────────────────────────
        if not keywords:
            _log("INFO", "Strategy 2 — ARIA role selectors ([role='row'], [role='listitem'])...")
            try:
                WebDriverWait(driver, 10).until(
                    EC.presence_of_element_located(
                        (By.CSS_SELECTOR, "[role='row'], [role='listitem']")
                    )
                )
                rows = driver.find_elements(By.CSS_SELECTOR, "[role='row'], [role='listitem']")
                for row in rows:
                    parts = [t.strip() for t in row.text.split("\n") if t.strip()]
                    if parts and len(parts[0]) >= 3:
                        _add(parts[0])
                if keywords:
                    _log("INFO", f"  → Strategy 2 succeeded: {len(keywords)} keyword(s)")
                else:
                    _log("WARN", "  → Strategy 2: no keywords extracted from role elements")
            except Exception as e:
                _log("WARN", f"  → Strategy 2 failed: {e}")

        # ── Strategy 3: JSON regex on page source ────────────────────────────
        if len(keywords) < 3:
            _log("INFO", "Strategy 3 — JSON regex extraction from hydrated page source...")
            page_source = driver.page_source
            fallback_kws = _extract_from_page_source(page_source, limit)
            for kw in fallback_kws:
                _add(kw)
            _log("INFO", f"  → Strategy 3 extracted {len(fallback_kws)} keyword(s)")

        result = keywords[:limit]
        _log("INFO", f"Done — {len(result)} keyword(s) ready for '{category_name}' ({geo})")
        return result

    finally:
        if driver:
            try:
                driver.quit()
            except Exception:
                pass


# ─── Entry Point ─────────────────────────────────────────────────────────────

def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Scrape Google Trends Trending Now keywords via headless Chrome"
    )
    parser.add_argument("--geo",         default="US",  help="ISO country code (default: US)")
    parser.add_argument("--category",    default="0",   help="GT category ID (default: 0 = All)")
    parser.add_argument("--hours",       default="168", help="Time window in hours: 4|24|48|168 (default: 168)")
    parser.add_argument("--limit",       default=50, type=int, help="Max keywords to return (default: 50)")
    parser.add_argument("--no-headless", action="store_true", help="Show browser window (for debugging)")
    return parser.parse_args()


def main() -> None:
    args   = parse_args()
    geo    = args.geo.upper().strip()
    cat    = args.category.strip()
    hours  = args.hours.strip()
    limit  = args.limit
    headless = not args.no_headless
    cat_name = CATEGORY_NAMES.get(cat, "Unknown")

    _log("INFO", f"Args — geo={geo}, category={cat} ({cat_name}), hours={hours}, limit={limit}, headless={headless}")

    try:
        keywords = scrape_trending(geo, cat, hours, limit, headless)
        output = {
            "keywords":      keywords,
            "count":         len(keywords),
            "geo":           geo,
            "category":      cat,
            "category_name": cat_name,
            "hours":         hours,
        }
        print(json.dumps(output, ensure_ascii=False))
        sys.exit(0)

    except Exception as exc:
        _log("ERROR", f"Fatal scraper error: {exc}")
        error_output = {
            "error":    str(exc),
            "keywords": [],
            "count":    0,
        }
        # Always write valid JSON to stdout so callers don't need to handle empty output
        print(json.dumps(error_output, ensure_ascii=False))
        sys.exit(1)


if __name__ == "__main__":
    main()
