import { mkdir } from "node:fs/promises";
import { createRequire } from "node:module";
import { chromium, firefox, webkit, devices } from "playwright";

const base = process.env.BASE_URL ?? "https://games.srikanthparsi.com";
const evidenceDir = process.env.EVIDENCE_DIR;
const require = createRequire(import.meta.url);
const overallTimer = setTimeout(() => {
  console.error("browser matrix exceeded 180 seconds");
  process.exit(1);
}, 180_000);
const axePath = require.resolve("axe-core/axe.min.js");
const cases = [
  { name: "chromium-desktop", browser: chromium, context: { viewport: { width: 1440, height: 900 } } },
  { name: "firefox-desktop", browser: firefox, context: { viewport: { width: 1440, height: 900 } } },
  { name: "webkit-desktop", browser: webkit, context: { viewport: { width: 1440, height: 900 } } },
  { name: "chromium-320-portrait", browser: chromium, context: { viewport: { width: 320, height: 568 }, isMobile: true, hasTouch: true, reducedMotion: "reduce" } },
  { name: "chromium-320-landscape", browser: chromium, context: { viewport: { width: 568, height: 320 }, isMobile: true, hasTouch: true, reducedMotion: "reduce" } },
  { name: "webkit-iphone-13-portrait", browser: webkit, context: { ...devices["iPhone 13"], reducedMotion: "reduce" } },
  { name: "webkit-iphone-13-landscape", browser: webkit, context: { ...devices["iPhone 13 landscape"], reducedMotion: "reduce" } },
];
if (evidenceDir !== undefined) await mkdir(evidenceDir, { recursive: true });
const results = [];
for (const item of cases) {
  const instance = await item.browser.launch({ headless: true, timeout: 20_000 });
  try {
    const context = await instance.newContext(item.context);
    const page = await context.newPage();
    page.setDefaultTimeout(15_000);
    page.setDefaultNavigationTimeout(15_000);
    const errors = [];
    page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
    page.on("pageerror", (error) => errors.push(error.message));
    const response = await page.goto(base, { waitUntil: "networkidle", timeout: 15_000 });
    if (!response?.ok()) throw new Error(`${item.name}: navigation returned ${String(response?.status())}`);
    await page.getByRole("heading", { name: /game night/i }).waitFor();
    await page.addScriptTag({ path: axePath });
    const violations = await page.evaluate(async () => (await globalThis.axe.run(document)).violations);
    if (violations.length > 0) throw new Error(`${item.name}: axe violations ${violations.map((entry) => entry.id).join(", ")}`);
    const geometry = await page.evaluate(() => ({ innerWidth, documentWidth: document.documentElement.scrollWidth, bodyWidth: document.body.scrollWidth }));
    if (geometry.documentWidth > geometry.innerWidth || geometry.bodyWidth > geometry.innerWidth)
      throw new Error(`${item.name}: horizontal overflow ${JSON.stringify(geometry)}`);
    const createLink = page.getByRole("link", { name: "Create a room", exact: true });
    await createLink.focus();
    if (!(await createLink.evaluate((element) => element === document.activeElement))) throw new Error(`${item.name}: primary CTA is not keyboard focusable`);
    await createLink.click();
    await page.getByLabel("Display name").fill("Browser Smoke");
    if (!(await page.getByRole("button", { name: "Create room" }).isVisible())) throw new Error(`${item.name}: create-room control is not visible`);
    if (errors.length > 0) throw new Error(`${item.name}: browser errors: ${errors.join(" | ")}`);
    if (evidenceDir !== undefined) await page.screenshot({ path: `${evidenceDir}/${item.name}.png`, fullPage: true });
    results.push({ name: item.name, ...geometry, axeViolations: 0, browserErrors: 0, keyboardCta: true, createForm: true });
    await context.close();
  } finally { await instance.close(); }
}
clearTimeout(overallTimer);
console.log(JSON.stringify({ base, cases: results }));
