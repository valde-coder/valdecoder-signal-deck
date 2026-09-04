import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const PORT = 9555;
const BASE_URL = "http://localhost:3000/valdecoder-signal-deck/";
const EVIDENCE_DIR = "/home/valdemaster/ValdeCoder/evidence/final";

fs.mkdirSync(EVIDENCE_DIR, { recursive: true });

async function launchChrome() {
  const tmpDir = `/tmp/chrome-audit-${Date.now()}`;
  fs.mkdirSync(tmpDir, { recursive: true });
  const chrome = spawn("/usr/bin/google-chrome", [
    "--headless=new",
    `--remote-debugging-port=${PORT}`,
    "--remote-debugging-address=127.0.0.1",
    `--user-data-dir=${tmpDir}`,
    "--no-sandbox",
    "--use-gl=angle",
    "--use-angle=swiftshader",
    "--enable-unsafe-swiftshader",
    "--disable-dev-shm-usage",
    "--window-size=1440,900",
  ], { stdio: "ignore" });

  for (let i = 0; i < 40; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${PORT}/json/version`);
      if (res.ok) {
        return chrome;
      }
    } catch {}
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error("Failed to start chrome remote debugging");
}

class CDPClient {
  constructor(wsUrl) {
    this.ws = new WebSocket(wsUrl);
    this.id = 0;
    this.callbacks = new Map();
    this.consoleLogs = [];
    this.consoleErrors = [];

    this.ready = new Promise((resolve, reject) => {
      this.ws.onopen = resolve;
      this.ws.onerror = reject;
    });

    this.ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.id && this.callbacks.has(msg.id)) {
          const { resolve, reject } = this.callbacks.get(msg.id);
          this.callbacks.delete(msg.id);
          if (msg.error) reject(new Error(msg.error.message));
          else resolve(msg.result);
        } else if (msg.method) {
          if (msg.method === "Runtime.consoleAPICalled") {
            const type = msg.params.type;
            const text = msg.params.args.map((a) => (typeof a.value !== "undefined" ? a.value : JSON.stringify(a))).join(" ");
            if (type === "error") this.consoleErrors.push(text);
            else this.consoleLogs.push(`[${type}] ${text}`);
          } else if (msg.method === "Log.entryAdded") {
            if (msg.params.entry.level === "error") {
              this.consoleErrors.push(msg.params.entry.text);
            }
          }
        }
      } catch (err) {
        console.error("Error parsing CDP message:", err);
      }
    };
  }

  async send(method, params = {}) {
    await this.ready;
    const id = ++this.id;
    return new Promise((resolve, reject) => {
      this.callbacks.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  async close() {
    this.ws.close();
  }
}

async function runAudit() {
  console.log("Launching Chrome with SwiftShader WebGL...");
  const chrome = await launchChrome();

  try {
    let listRes = await fetch(`http://127.0.0.1:${PORT}/json/list`);
    let pages = await listRes.json();
    if (!pages || pages.length === 0) {
      const newRes = await fetch(`http://127.0.0.1:${PORT}/json/new?${BASE_URL}`, { method: "PUT" });
      const newPage = await newRes.json();
      pages = [newPage];
    }

    const wsUrl = pages[0].webSocketDebuggerUrl;
    console.log("Connecting CDP to:", wsUrl);
    const cdp = new CDPClient(wsUrl);

    await cdp.send("Page.enable");
    await cdp.send("Runtime.enable");
    await cdp.send("Log.enable");

    // 1. Desktop Initial / Hero
    console.log("1. Desktop Hero (1440x900)...");
    await cdp.send("Emulation.setDeviceMetricsOverride", {
      width: 1440,
      height: 900,
      deviceScaleFactor: 1,
      mobile: false,
    });
    await cdp.send("Page.navigate", { url: BASE_URL });
    await new Promise((r) => setTimeout(r, 2200));

    const shotHero = await cdp.send("Page.captureScreenshot", { format: "png" });
    fs.writeFileSync(path.join(EVIDENCE_DIR, "01-desktop-hero.png"), Buffer.from(shotHero.data, "base64"));

    // 2. Open Command Palette via Ctrl+K
    console.log("2. Command Palette Modal...");
    await cdp.send("Runtime.evaluate", {
      expression: `window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true }))`,
    });
    await new Promise((r) => setTimeout(r, 600));
    const shotCmd = await cdp.send("Page.captureScreenshot", { format: "png" });
    fs.writeFileSync(path.join(EVIDENCE_DIR, "02-modal-command-palette.png"), Buffer.from(shotCmd.data, "base64"));

    // Close Modal via Escape
    await cdp.send("Runtime.evaluate", {
      expression: `window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))`,
    });
    await new Promise((r) => setTimeout(r, 400));

    // 3. Scroll to Radar Section
    console.log("3. Radar Section...");
    await cdp.send("Runtime.evaluate", {
      expression: `document.getElementById('radar')?.scrollIntoView({ behavior: 'instant' })`,
    });
    await new Promise((r) => setTimeout(r, 800));
    const shotRadar = await cdp.send("Page.captureScreenshot", { format: "png" });
    fs.writeFileSync(path.join(EVIDENCE_DIR, "03-desktop-radar.png"), Buffer.from(shotRadar.data, "base64"));

    // Open Signal Modal
    console.log("4. Signal Detail Modal...");
    await cdp.send("Runtime.evaluate", {
      expression: `document.querySelector('.radar-card')?.click()`,
    });
    await new Promise((r) => setTimeout(r, 500));
    const shotSignalModal = await cdp.send("Page.captureScreenshot", { format: "png" });
    fs.writeFileSync(path.join(EVIDENCE_DIR, "04-modal-signal-detail.png"), Buffer.from(shotSignalModal.data, "base64"));

    // Close Signal Modal
    await cdp.send("Runtime.evaluate", {
      expression: `window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))`,
    });
    await new Promise((r) => setTimeout(r, 400));

    // 5. Scroll to Arsenal Section
    console.log("5. Arsenal Section...");
    await cdp.send("Runtime.evaluate", {
      expression: `document.getElementById('arsenal')?.scrollIntoView({ behavior: 'instant' })`,
    });
    await new Promise((r) => setTimeout(r, 800));
    const shotArsenal = await cdp.send("Page.captureScreenshot", { format: "png" });
    fs.writeFileSync(path.join(EVIDENCE_DIR, "05-desktop-arsenal.png"), Buffer.from(shotArsenal.data, "base64"));

    // 6. Scroll to Lab Section (with 3D Mascot)
    console.log("6. Lab Section with 3D Mascot...");
    await cdp.send("Runtime.evaluate", {
      expression: `document.getElementById('lab')?.scrollIntoView({ behavior: 'instant' })`,
    });
    await new Promise((r) => setTimeout(r, 1500));
    const shotLab = await cdp.send("Page.captureScreenshot", { format: "png" });
    fs.writeFileSync(path.join(EVIDENCE_DIR, "06-desktop-lab-mascot.png"), Buffer.from(shotLab.data, "base64"));

    // 7. Click 3D Mascot (trigger acknowledgement)
    console.log("7. Click 3D Mascot...");
    await cdp.send("Runtime.evaluate", {
      expression: `document.querySelector('.ox-mascot-3d-wrap')?.click()`,
    });
    await new Promise((r) => setTimeout(r, 300));
    const shotMascotClicked = await cdp.send("Page.captureScreenshot", { format: "png" });
    fs.writeFileSync(path.join(EVIDENCE_DIR, "07-mascot-interaction.png"), Buffer.from(shotMascotClicked.data, "base64"));

    // 8. Mobile Viewport (390x844)
    console.log("8. Mobile Viewport (390x844)...");
    await cdp.send("Emulation.setDeviceMetricsOverride", {
      width: 390,
      height: 844,
      deviceScaleFactor: 2,
      mobile: true,
    });
    await cdp.send("Runtime.evaluate", {
      expression: `window.scrollTo(0, 0)`,
    });
    await new Promise((r) => setTimeout(r, 1000));
    const shotMobile = await cdp.send("Page.captureScreenshot", { format: "png" });
    fs.writeFileSync(path.join(EVIDENCE_DIR, "08-mobile-hero.png"), Buffer.from(shotMobile.data, "base64"));

    // 9. Mobile Lab
    console.log("9. Mobile Lab...");
    await cdp.send("Runtime.evaluate", {
      expression: `document.getElementById('lab')?.scrollIntoView({ behavior: 'instant' })`,
    });
    await new Promise((r) => setTimeout(r, 1000));
    const shotMobileLab = await cdp.send("Page.captureScreenshot", { format: "png" });
    fs.writeFileSync(path.join(EVIDENCE_DIR, "09-mobile-lab.png"), Buffer.from(shotMobileLab.data, "base64"));

    // 10. Exploded Mode (?debug3d=1)
    console.log("10. Exploded 3D Mascot (?debug3d=1)...");
    await cdp.send("Emulation.setDeviceMetricsOverride", {
      width: 1440,
      height: 900,
      deviceScaleFactor: 1,
      mobile: false,
    });
    await cdp.send("Page.navigate", { url: `${BASE_URL}?debug3d=1#lab` });
    await new Promise((r) => setTimeout(r, 2200));
    await cdp.send("Runtime.evaluate", {
      expression: `document.getElementById('lab')?.scrollIntoView({ behavior: 'instant' })`,
    });
    await new Promise((r) => setTimeout(r, 800));
    const shotExploded = await cdp.send("Page.captureScreenshot", { format: "png" });
    fs.writeFileSync(path.join(EVIDENCE_DIR, "10-debug-exploded-mascot.png"), Buffer.from(shotExploded.data, "base64"));

    // Summary of console errors
    console.log("--- AUDIT RESULTS ---");
    console.log("Console Errors:", cdp.consoleErrors.length);
    if (cdp.consoleErrors.length > 0) {
      console.log(cdp.consoleErrors);
    }
    console.log("Screenshots captured successfully in", EVIDENCE_DIR);

    const auditReport = {
      timestamp: new Date().toISOString(),
      consoleErrorsCount: cdp.consoleErrors.length,
      consoleErrors: cdp.consoleErrors,
      consoleLogsCount: cdp.consoleLogs.length,
      evidenceFiles: fs.readdirSync(EVIDENCE_DIR),
    };

    fs.writeFileSync(path.join(EVIDENCE_DIR, "audit-results.json"), JSON.stringify(auditReport, null, 2));
    await cdp.close();
  } finally {
    chrome.kill("SIGTERM");
  }
}

runAudit().catch((err) => {
  console.error("Audit failed:", err);
  process.exit(1);
});
