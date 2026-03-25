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
PROXY_SERVER   = os.environ.get("PROXY_SERVER", "")
ENDPOINT       = "https://main-managment-dashboard.idrissimahdi2020.workers.dev"

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



def validate_env() -> bool:
    """Print a full config report; return False if any required var is missing."""
    print("=" * 58)
    print("  CAMOUFOX STEALTH BOT — STARTUP CONFIG")
    print("=" * 58)
    checks = [
        ("PROXY_PASSWORD", PROXY_PASSWORD,  "password", True),
        ("PROXY_SERVER",   PROXY_SERVER,    "proxy",           True),
        ("ENDPOINT",       ENDPOINT,        "endpoint",               False),
        ("CI / headless",  str(IS_CI),      str(IS_CI),             False),
        ("work number",    work_num or "",  work_num or "<not set>",True),
    ]
    all_ok = True
    for name, raw, display, required in checks:
        ok    = bool(raw)
        tag   = "OK " if ok else ("ERR" if required else "   ")
        mark  = "✓" if ok else ("✗" if required else "-")
        print(f"  [{tag}] {mark} {name:<22} → {display}")
        if required and not ok:
            all_ok = False
    print("=" * 58)
    if not all_ok:
        print("\n[FATAL] Required env vars are missing.")
        print("        → Add them to .env (local) or GitHub Secrets (CI).\n")
    return all_ok


# ── Location pool (same weights as JS) ───────────────────────────────────────
LOCATIONS = ["us"]

# ── Device / OS preferences ───────────────────────────────────────────────────
PREFERENCES = [
    {"value": {"device": "desktop", "os": "windows"}, "weight": 20},
    # Camoufox does not support "android" — "linux" is the closest supported OS
]


# ── Referrals (Google, Socials, Direct) ───────────────────────────────────────
REFERRERS = [
    {"value": "", "weight": 3},                           # Direct
    {"value": "https://www.google.com/", "weight": 0},    # Google
    {"value": "https://m.facebook.com/", "weight": 10},  # Facebook
    {"value": "https://l.instagram.com/", "weight": 0},   # Instagram
    {"value": "https://t.co/", "weight": 0},              # Twitter
    {"value": "https://bitly.com/", "weight": 50},         # Bitly
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
    return await fetch_json(session, f"{ENDPOINT}/api/config/threads")


async def get_custom_countries(session: aiohttp.ClientSession) -> dict | None:
    print("[INFO] Fetching custom countries...")
    return await fetch_json(session, f"{ENDPOINT}/api/config/customloc")


async def record_api_view(session: aiohttp.ClientSession, website: str) -> None:
    url = f"{ENDPOINT}/api/views"
    payload = {"website": website, "viewRegistred": True}
    try:
        async with session.post(url, json=payload, timeout=aiohttp.ClientTimeout(total=15)) as r:
            if r.status != 200:
                print(f"[METRIC ERROR] {website} → HTTP {r.status}")
    except Exception as e:
        print(f"[METRIC ERROR] {website} → {e}")


async def send_discord_screenshot(session: aiohttp.ClientSession, screenshot_bytes: bytes, website: str, tz: str) -> None:
    webhook_url = "https://discord.com/api/webhooks/1486198278486753362/LezWrKtc09Gkob57pPt9Y4acbpr4-isy66M79VU28L2o4VvgmefFQMiIQQzctyLZdH1G"
    try:
        data = aiohttp.FormData()
        payload_json = {
            "content": f"📸 **Successful View Completed**\n**Website:** `{website}`\n**Geo-Timezone:** `{tz}`"
        }
        data.add_field("payload_json", json.dumps(payload_json), content_type="application/json")
        data.add_field("file", screenshot_bytes, filename="screenshot.jpg", content_type="image/jpeg")
        
        async with session.post(webhook_url, data=data, timeout=aiohttp.ClientTimeout(total=20)) as r:
            if r.status not in (200, 204):
                print(f"[DISCORD ERROR] HTTP {r.status} → {await r.text()}")
    except Exception as e:
        print(f"[DISCORD ERROR] {e}")


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
    """Find a random text/link element and smoothly scroll/click on it to bypass coordinate heuristic checks."""
    try:
        # Avoid clicking random void coordinates. Bots do that. Humans click elements.
        locators = await page.locator("p:visible, a:visible, h1:visible, h2:visible, h3:visible, span:visible").all()
        if locators:
            target = random.choice(locators)
            await target.scroll_into_view_if_needed(timeout=2_000)
            # humanize=True ensures this .click() uses a real bezier-curve mouse movement path!
            await target.click(timeout=3_000, delay=rand_int(100, 300))
        else:
            # Fallback scroll using a realistic mouse wheel sweep
            await page.mouse.wheel(0, rand_int(300, 900))
    except Exception:
        pass
    await page.wait_for_timeout(rand_int(2_000, 4_000))


# ══════════════════════════════════════════════════════════════════════════════
# Core session
# ══════════════════════════════════════════════════════════════════════════════

async def open_browser(username: str, node: dict, views: dict, session: aiohttp.ClientSession) -> bool:

    try:
        async with AsyncCamoufox(
            headless=False,     # True on GitHub Actions, False locally
            geoip=True,         # timezone & locale auto-matched to proxy exit-node
            humanize=True,       # human mouse/timing behaviour
            exclude_addons=[DefaultAddons.UBO],   
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
            #  await block_resources(context)

            # # ── Auto-close any popup / new tab that opens ─────────────────────
            # async def _close_popup(popup):
            #     try:
            #         await popup.close()
            #     except Exception:
            #         pass
            # context.on("page", lambda popup: asyncio.ensure_future(_close_popup(popup)))


            timezone = await page.evaluate("Intl.DateTimeFormat().resolvedOptions().timeZone")

            referrer = weighted_random(REFERRERS)

            print(
                f"[worker={work_num}] views={views.get('views', 0)} | "
                f"site={node.get('link')} | "
                f"tz={timezone} | "
                f"ref={referrer or 'Direct'} | "
                f"bots={node.get('bots')} | "
            )

            # Navigate with referral header (domcontentloaded is massively faster than load)
            goto_args = {"wait_until": "domcontentloaded", "timeout": 25_000}
            if referrer:
                goto_args["referer"] = referrer
                
            try:
                await page.goto(node["link"], **goto_args)
            except Exception as e:
                print(f"[ERROR] Proxy slow or blocked loading {node['link']} → {e}")
                return False

            # Let network naturally settle, but do NOT stall for 30s if ads/telemetry keep firing!
            try:
                await page.wait_for_load_state("networkidle", timeout=3_000)
            except Exception:
                pass

            # Random initial wait — simulate human reading time (3-8 s instead of 5-15s)
            await page.wait_for_timeout(rand_int(3_000, 8_000))
            await perform_random_clicks(page)
            await page.wait_for_timeout(rand_int(3_000, 8_000))
            await perform_random_clicks(page)
            # Dwell time (reduced standard deviation for faster pacing: 10-30s instead of 15-60s)
            await page.wait_for_timeout(rand_int(30_000, 60_000))

            # Take full screenshot & push to Discord right before shutting down Playwright!
            try:
                # We use high JPEG compression to guarantee it fits easily over Discord limits
                screenshot = await page.screenshot(type="jpeg", quality=60, full_page=True, timeout=10_000)
                await send_discord_screenshot(session, screenshot, node.get("link"), timezone)
            except Exception as e:
                print(f"[SCREENSHOT ERROR] Failed to capture or send: {e}")

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

async def tasks_poll(node: dict, countries: dict | None, views: dict, session: aiohttp.ClientSession) -> None:
    bot_count = int(node.get("bots") or 1)

    default_locs  = ["us"]
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

        session_id = generate_session_id(100)
        username   = (
            f"brd-customer-hl_19cb0fe8-zone-mw"
            f"-country-{location}-session-{session_id}"
        )
        success = await open_browser(username, node, views, session)
        if success:
            await record_api_view(session, node.get("link"))

    await asyncio.gather(*[_one_task() for _ in range(bot_count)])


# ══════════════════════════════════════════════════════════════════════════════
# Main loop — mirrors RunTasks()
# ══════════════════════════════════════════════════════════════════════════════

async def run_tasks() -> None:
    # ── Config check — printed first thing on every run ───────────────────────
    if not validate_env():
        return

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
                await tasks_poll(node, countries, vlog, http)

            await asyncio.gather(*[_run_node(k) for k in keys])


# ── Entry-point ───────────────────────────────────────────────────────────────
if __name__ == "__main__":
    try:
        asyncio.run(run_tasks())
    except KeyboardInterrupt:
        print("\n[INFO] Stopped by user.")
