/**
 * App Store Screenshot Generator
 *
 * Captures screenshots at required iOS device sizes for App Store Connect.
 * Run with: bun run screenshots
 *
 * Prerequisites:
 * - Dev server running: bun run dev
 * - Playwright installed: bun add -d playwright
 */

import { chromium, type Page } from "playwright";
import { mkdir } from "fs/promises";
import { join } from "path";

// App Store required device sizes
const DEVICES = {
  "iPhone-6.9": {
    name: "iPhone 16 Pro Max",
    width: 1320,
    height: 2868,
    scale: 3,
  },
  "iPhone-6.5": {
    name: "iPhone 11 Pro Max",
    width: 1242,
    height: 2688,
    scale: 3,
  },
  "iPhone-5.5": {
    name: "iPhone 8 Plus",
    width: 1242,
    height: 2208,
    scale: 3,
  },
  "iPad-12.9": {
    name: "iPad Pro 12.9",
    width: 2048,
    height: 2732,
    scale: 2,
  },
} as const;

// Screens to capture
const SCREENS = [
  { name: "01-home", path: "/" },
  { name: "02-play", path: "/play" },
  { name: "03-ai-vs-ai", path: "/ai-vs-ai" },
  { name: "04-simulation", path: "/simulation" },
] as const;

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";
const OUTPUT_DIR = join(process.cwd(), "screenshots", "appstore");

async function waitForApp(page: Page) {
  await page.waitForLoadState("networkidle");
  // Extra time for animations to settle
  await page.waitForTimeout(1000);
}

async function takeScreenshots() {
  console.log("📸 App Store Screenshot Generator\n");
  console.log(`Base URL: ${BASE_URL}`);
  console.log(`Output: ${OUTPUT_DIR}\n`);

  // Create output directories
  for (const deviceKey of Object.keys(DEVICES)) {
    await mkdir(join(OUTPUT_DIR, deviceKey), { recursive: true });
  }

  const browser = await chromium.launch();

  for (const [deviceKey, device] of Object.entries(DEVICES)) {
    console.log(`\n📱 ${device.name} (${device.width}x${device.height})`);

    const context = await browser.newContext({
      viewport: {
        width: Math.round(device.width / device.scale),
        height: Math.round(device.height / device.scale),
      },
      deviceScaleFactor: device.scale,
      isMobile: deviceKey.startsWith("iPhone"),
      hasTouch: true,
    });

    const page = await context.newPage();

    for (const screen of SCREENS) {
      const url = `${BASE_URL}${screen.path}`;
      console.log(`  → ${screen.name}`);

      await page.goto(url);
      await waitForApp(page);

      const filename = `${screen.name}.png`;
      await page.screenshot({
        path: join(OUTPUT_DIR, deviceKey, filename),
        fullPage: false,
      });
    }

    await context.close();
  }

  await browser.close();

  console.log("\n✅ Screenshots saved to:", OUTPUT_DIR);
  console.log("\nDevice folders:");
  for (const [key, device] of Object.entries(DEVICES)) {
    console.log(`  ${key}/ - ${device.name}`);
  }
}

takeScreenshots().catch((error) => {
  console.error("Screenshot generation failed:", error);
  process.exit(1);
});
