import os
import time
import json
from playwright.sync_api import sync_playwright

BASE_URL = "http://localhost:3000/valdecoder-signal-deck/"
OUT_DIR = "/home/valdemaster/ValdeCoder/evidence/final"
os.makedirs(OUT_DIR, exist_ok=True)

def run():
    errors = []
    logs = []

    with sync_playwright() as p:
        browser = p.chromium.launch(
            headless=True,
            args=[
                "--no-sandbox",
                "--use-gl=angle",
                "--use-angle=swiftshader",
                "--enable-unsafe-swiftshader",
                "--disable-dev-shm-usage",
            ]
        )

        # ---------------- 1. Desktop 1440x900 ----------------
        context = browser.new_context(
            viewport={"width": 1440, "height": 900},
            device_scale_factor=1,
        )
        page = context.new_page()

        page.on("console", lambda msg: errors.append(msg.text) if msg.type == "error" else logs.append(f"[{msg.type}] {msg.text}"))
        page.on("pageerror", lambda exc: errors.append(str(exc)))

        print("Navigating to Desktop Hero...")
        page.goto(BASE_URL, wait_until="networkidle")
        time.sleep(2.0)

        # 1. Desktop Hero settled
        page.screenshot(path=os.path.join(OUT_DIR, "01-desktop-hero-settled.png"))
        print("Captured 01-desktop-hero-settled.png")

        # 2. Command Palette (Ctrl+K)
        print("Opening Command Palette...")
        page.keyboard.press("Control+k")
        time.sleep(0.6)
        page.screenshot(path=os.path.join(OUT_DIR, "02-modal-command-palette.png"))
        print("Captured 02-modal-command-palette.png")
        page.keyboard.press("Escape")
        time.sleep(0.4)

        # 3. Radar Section
        print("Scrolling to Radar...")
        page.locator("#radar").scroll_into_view_if_needed()
        time.sleep(1.0)
        page.screenshot(path=os.path.join(OUT_DIR, "03-desktop-radar.png"))
        print("Captured 03-desktop-radar.png")

        # 4. Signal Detail Modal
        print("Opening Signal Detail Modal...")
        signal_cards = page.locator(".radar-card")
        if signal_cards.count() > 0:
            signal_cards.first.click()
            time.sleep(0.6)
            page.screenshot(path=os.path.join(OUT_DIR, "04-modal-signal-detail.png"))
            print("Captured 04-modal-signal-detail.png")
            page.keyboard.press("Escape")
            time.sleep(0.4)

        # 5. Projetos Section
        print("Scrolling to Projetos...")
        page.locator("#projetos").scroll_into_view_if_needed()
        time.sleep(1.0)
        page.screenshot(path=os.path.join(OUT_DIR, "05-desktop-projetos.png"))
        print("Captured 05-desktop-projetos.png")

        # 5b. Card Hover Animation (Tilt & Glow)
        print("Hovering on first project card...")
        first_card = page.locator("#projetos a[data-cursor]").first
        if first_card.count() > 0:
            first_card.hover()
            time.sleep(0.5)
            page.screenshot(path=os.path.join(OUT_DIR, "05b-desktop-projetos-hover.png"))
            print("Captured 05b-desktop-projetos-hover.png")

        # 6. Lab Section with 3D Mascot
        print("Scrolling to Lab with 3D Mascot...")
        page.locator("#lab").scroll_into_view_if_needed()
        time.sleep(1.8)
        page.screenshot(path=os.path.join(OUT_DIR, "06-desktop-lab-mascot.png"))
        print("Captured 06-desktop-lab-mascot.png")

        # 7. Mascot Interaction (click to acknowledge)
        print("Interacting with 3D Mascot...")
        mascot = page.locator(".ox-mascot-3d-wrap")
        if mascot.count() > 0:
            mascot.click()
            time.sleep(0.35)
            page.screenshot(path=os.path.join(OUT_DIR, "07-mascot-interaction.png"))
            print("Captured 07-mascot-interaction.png")

        # 8. Keyboard navigation: Tab to verify focus-visible ring
        print("Testing keyboard focus-visible...")
        page.keyboard.press("Tab")
        time.sleep(0.2)
        page.keyboard.press("Tab")
        time.sleep(0.2)
        page.screenshot(path=os.path.join(OUT_DIR, "08-focus-visible-keyboard.png"))
        print("Captured 08-focus-visible-keyboard.png")

        context.close()

        # ---------------- 2. Mobile 390x844 ----------------
        print("Opening Mobile viewport 390x844...")
        mobile_ctx = browser.new_context(
            viewport={"width": 390, "height": 844},
            device_scale_factor=2,
            is_mobile=True,
            has_touch=True,
        )
        mobile_page = mobile_ctx.new_page()
        mobile_page.goto(BASE_URL, wait_until="networkidle")
        time.sleep(2.0)

        mobile_page.screenshot(path=os.path.join(OUT_DIR, "09-mobile-hero.png"))
        print("Captured 09-mobile-hero.png")

        mobile_page.locator("#lab").scroll_into_view_if_needed()
        time.sleep(1.5)
        mobile_page.screenshot(path=os.path.join(OUT_DIR, "10-mobile-lab.png"))
        print("Captured 10-mobile-lab.png")

        mobile_ctx.close()

        # ---------------- 3. Debug Exploded 3D (?debug3d=1) ----------------
        print("Opening ?debug3d=1...")
        debug_ctx = browser.new_context(
            viewport={"width": 1440, "height": 900},
            device_scale_factor=1,
        )
        debug_page = debug_ctx.new_page()
        debug_page.goto(f"{BASE_URL}?debug3d=1", wait_until="networkidle")
        time.sleep(1.5)
        debug_page.locator("#lab").scroll_into_view_if_needed()
        time.sleep(1.5)

        # Set explode slider to 0.75
        slider = debug_page.locator(".ox-mascot-3d-wrap input[type='range']")
        if slider.count() > 0:
            slider.fill("0.75")
            time.sleep(0.5)

        debug_page.screenshot(path=os.path.join(OUT_DIR, "11-debug-exploded-3d.png"))
        print("Captured 11-debug-exploded-3d.png")

        debug_ctx.close()
        browser.close()

    # Write audit log
    report = {
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ"),
        "consoleErrorsCount": len(errors),
        "consoleErrors": errors,
        "logsCount": len(logs),
    }
    with open(os.path.join(OUT_DIR, "playwright-audit.json"), "w", encoding="utf-8") as f:
        json.dump(report, f, indent=2)

    print(f"\nAudit complete! Total console errors: {len(errors)}")

if __name__ == "__main__":
    run()
