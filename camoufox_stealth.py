"""
camoufox_stealth.py
--------------------
Python translation of bot_core.js — worker scraping bot with:
  • Bright Data rotating proxy  (country + session randomisation)
  • Camoufox stealth browser   (Firefox fingerprint, geoip, humanise)
  • Canvas / Audio / WebGL / ClientRects noise injection
  • Resource blocking          (images, media, stylesheets)
  • Human-like timing          (5-15 s reading wait, 15-60 s dwell)
  • Infinite main loop         (same as JS RunTasks)

Usage:
  python camoufox_stealth.py work=1

Proxy env vars  (.env):
  PROXY_PASSWORD   – Bright Data zone password
  PROXY_SERVER     – host:port  (default brd.superproxy.io:22225)
"""

import os
import sys
import asyncio
import random
import string
import json

import aiohttp
from dotenv import load_dotenv
from camoufox.async_api import AsyncCamoufox
from camoufox import DefaultAddons
# ── Env ───────────────────────────────────────────────────────────────────────
load_dotenv()
PROXY_PASSWORD = os.environ.get("PROXY_PASSWORD", "")
PROXY_SERVER   = os.environ.get("PROXY_SERVER", "brd.superproxy.io:22225")
ENDPOINT       = "https://crap-app.pages.dev"

# Auto-detect GitHub Actions / CI — use headless=True for speed
IS_CI = os.environ.get("CI", "").lower() in ("true", "1")

# ── CLI: work=N ───────────────────────────────────────────────────────────────
work_num: str | None = None
for _arg in sys.argv[1:]:
    if _arg.startswith("work="):
        _digits = "".join(c for c in _arg.split("=")[1] if c.isdigit())
        if _digits:
            work_num = _digits
        break

# ── Location pool (same weights as JS) ───────────────────────────────────────
LOCATIONS = [
    "se", "ng", "cm", "ci", "ua", "at", "at", "fr", "ca",
    *["us"] * 40,                           # heavy US weight
    "fr", "fr", "fr",
    "uk", "au", "de", "jp", "sg", "kr", "it", "es",
    "in", "id", "ph", "th", "my", "eg", "tr", "pk", "bd",
    "mx", "lk", "ml", "bj", "ug", "mm", "no", "pf", "np",
    "bf", "cd", "bi", "gf", "cf", "hk", "cg",
]

# ── Device / OS preferences ───────────────────────────────────────────────────
PREFERENCES = [
    {"value": {"device": "desktop", "os": "windows"}, "weight": 20},
    # Camoufox does not support "android" — "linux" is the closest supported OS
    {"value": {"device": "mobile",  "os": "linux"},   "weight": 100},
]


# ══════════════════════════════════════════════════════════════════════════════
# Helpers
# ══════════════════════════════════════════════════════════════════════════════

def rand_int(lo: int, hi: int) -> int:
    return random.randint(lo, hi)


def weighted_random(prefs: list) -> dict:
    total = sum(p["weight"] for p in prefs)
    r = random.random() * total
    for p in prefs:
        if r < p["weight"]:
            return p["value"]
        r -= p["weight"]
    return prefs[-1]["value"]


def generate_session_id(length: int = 32) -> str:
    chars = string.ascii_lowercase + string.digits
    return "".join(random.choice(chars) for _ in range(length))


# ══════════════════════════════════════════════════════════════════════════════
# Network
# ══════════════════════════════════════════════════════════════════════════════

async def fetch_json(session: aiohttp.ClientSession, url: str) -> dict | None:
    try:
        async with session.get(url, timeout=aiohttp.ClientTimeout(total=15)) as r:
            return await r.json(content_type=None)
    except Exception as e:
        print(f"[FETCH ERROR] {url} → {e}")
        return None


async def get_node_info(session: aiohttp.ClientSession) -> dict | None:
    print("[INFO] Fetching node info...")
    return await fetch_json(session, f"{ENDPOINT}/threads.json")


async def get_custom_countries(session: aiohttp.ClientSession) -> dict | None:
    print("[INFO] Fetching custom countries...")
    return await fetch_json(session, f"{ENDPOINT}/countries.json")


# ══════════════════════════════════════════════════════════════════════════════
# Browser helpers
# ══════════════════════════════════════════════════════════════════════════════

async def block_resources(context) -> None:
    """
    Block images, stylesheets and media on ALL pages in the context,
    including popups.  Must be called on the context, not a page.
    """
    async def _handler(route):
        if route.request.resource_type in ("image", "stylesheet", "media"):
            await route.abort()
        else:
            await route.continue_()
    await context.route("**/*", _handler)


async def perform_random_clicks(page) -> None:
    """Single random click anywhere on the visible viewport."""
    width  = await page.evaluate("window.innerWidth")
    height = await page.evaluate("window.innerHeight")
    await page.mouse.click(rand_int(0, width), rand_int(0, height))
    await page.wait_for_timeout(rand_int(2_000, 3_000))


# ══════════════════════════════════════════════════════════════════════════════
# Core session
# ══════════════════════════════════════════════════════════════════════════════

async def open_browser(username: str, node: dict, views: dict) -> bool:
    """
    Launch one Camoufox session for the given proxy username / node.
    Mirrors OpenBrowser() from bot_core.js.
    """
    pref     = weighted_random(PREFERENCES)
    camoufox_os = pref["os"]           # "windows" or "android"

    try:
        async with AsyncCamoufox(
            headless=IS_CI,     # True on GitHub Actions, False locally
            geoip=True,         # timezone & locale auto-matched to proxy exit-node
            os=camoufox_os,     # fingerprint OS
            humanize=True,   
            exclude_addons=[DefaultAddons.UBO],    # human mouse/timing behaviour
            proxy={
                "server":   f"http://{PROXY_SERVER}",
                "username": username,
                "password": PROXY_PASSWORD,
            },
        ) as browser:

            context = await browser.new_context()
            context.set_default_timeout(60_000)
            context.set_default_navigation_timeout(60_000)

            page  = await context.new_page()

            # ── Context-level blocking (main page + every popup) ──────────────
            await block_resources(context)

            # ── Auto-close any popup / new tab that opens ─────────────────────
            async def _close_popup(popup):
                try:
                    await popup.close()
                except Exception:
                    pass
            context.on("page", lambda popup: asyncio.ensure_future(_close_popup(popup)))


            print(
                f"[w={work_num}] views={views.get('views', 0)} | "
                f"site={node.get('link')} | "
                f"custom_loc={node.get('custom_location')} | "
                f"bots={node.get('bots')} | "
                f"device={pref['device']}"
            )

            # Navigate
            await page.goto(node["link"], wait_until="load")

            # Wait for network to settle (mirrors JS .catch(()=>{}))
            try:
                await page.wait_for_load_state("networkidle", timeout=30_000)
            except Exception:
                pass

            # Random initial wait — simulate human reading time (5-15 s)
            await page.wait_for_timeout(rand_int(5_000, 15_000))

            # One random click
            await perform_random_clicks(page)

            # Dwell time (15-60 s)
            await page.wait_for_timeout(rand_int(15_000, 60_000))

            return True

    except Exception as e:
        err = str(e)
        # Suppress harmless cleanup / mid-navigation close errors
        _silent = ("Connection closed", "Browser.close", "TargetClosedError", "Target closed", "Target page, context or browser has been closed")
        if not any(s in err for s in _silent):
            print(f"[ERROR] open_browser ({node.get('link')}): {e}")
        return False


# ══════════════════════════════════════════════════════════════════════════════
# Task pool — mirrors tasksPoll()
# ══════════════════════════════════════════════════════════════════════════════

async def tasks_poll(node: dict, countries: dict | None, views: dict) -> None:
    bot_count = int(node.get("bots") or 1)

    default_locs  = ["se", "fr", "us"]
    custom_locs   = (
        countries.get("customLocations", default_locs)
        if countries
        else default_locs
    )

    async def _one_task():
        if node.get("custom_location"):
            location = random.choice(custom_locs)
        else:
            location = random.choice(LOCATIONS)

        session_id = generate_session_id(50)
        username   = (
            f"brd-customer-hl_19cb0fe8-zone-mw"
            f"-country-{location}-session-{session_id}"
        )
        await open_browser(username, node, views)

    await asyncio.gather(*[_one_task() for _ in range(bot_count)])


# ══════════════════════════════════════════════════════════════════════════════
# Main loop — mirrors RunTasks()
# ══════════════════════════════════════════════════════════════════════════════

async def run_tasks() -> None:
    if work_num is None:
        print("[ERROR] No work number provided. Usage: python camoufox_stealth.py work=1")
        return

    async with aiohttp.ClientSession() as http:

        # Initial node fetch to build view log
        nodes = await get_node_info(http)
        if not nodes:
            print("[ERROR] Could not fetch initial node info.")
            return

        node_group = nodes.get(f"work_{work_num}", {})
        view_log   = [
            {"key": work_num, "node": node_group[k], "views": 0}
            for k in node_group
        ]

        # Infinite loop (345_535_345 iterations like the JS)
        for iteration in range(345_535_345):
            countries = await get_custom_countries(http)
            nodes     = await get_node_info(http)

            if not nodes:
                print("[ERROR] No nodes returned — retrying next iteration.")
                await asyncio.sleep(5)
                continue

            node_group = nodes.get(f"work_{work_num}", {})
            keys       = list(node_group.keys())

            print(
                f"[INFO] workflow={work_num} | nodes={len(keys)} | "
                f"iteration={iteration + 1}"
            )

            async def _run_node(key: str):
                node = node_group[key]
                # Update view counter
                for item in view_log:
                    if item["node"].get("link") == node.get("link"):
                        item["views"] += int(node.get("bots") or 0)
                vlog = next(
                    (v for v in view_log if v["node"].get("link") == node.get("link")),
                    {"views": 0},
                )
                await tasks_poll(node, countries, vlog)

            await asyncio.gather(*[_run_node(k) for k in keys])


# ── Entry-point ───────────────────────────────────────────────────────────────
if __name__ == "__main__":
    try:
        asyncio.run(run_tasks())
    except KeyboardInterrupt:
        print("\n[INFO] Stopped by user.")
