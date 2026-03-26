/**
 * Phase 1: Playwright でキャリア・ポイントサイトのスクリーンショットを取得
 *
 * 使い方:
 *   npx tsx scripts/scraper/screenshot.ts
 *
 * 必要パッケージ:
 *   npm install -D playwright @anthropic-ai/sdk
 *   npx playwright install chromium
 */

import { chromium } from "playwright";
import path from "path";
import fs from "fs";
import { CARRIER_TARGETS, POINT_SITE_TARGETS } from "./config";

const SCREENSHOT_DIR = path.join(__dirname, "../../data/screenshots");

async function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

async function takeScreenshots() {
  await ensureDir(SCREENSHOT_DIR);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    locale: "ja-JP",
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  });

  const timestamp = new Date().toISOString().split("T")[0];

  // キャリア料金ページ
  for (const carrier of CARRIER_TARGETS) {
    for (let i = 0; i < carrier.urls.length; i++) {
      const url = carrier.urls[i];
      const page = await context.newPage();
      console.log(`📸 ${carrier.provider_name} (${i + 1}/${carrier.urls.length}): ${url}`);

      try {
        await page.goto(url, { waitUntil: "networkidle", timeout: 30000 });
        // Cookie同意バナーを閉じる試み
        try {
          await page.click('[class*="cookie"] button, [class*="consent"] button', { timeout: 3000 });
        } catch {
          // バナーがなければスキップ
        }
        await page.waitForTimeout(2000);

        // フルページスクリーンショット
        const filename = `${carrier.provider_name}_${i + 1}_${timestamp}.png`;
        await page.screenshot({
          path: path.join(SCREENSHOT_DIR, filename),
          fullPage: true,
        });
        console.log(`  ✅ → ${filename}`);
      } catch (error) {
        console.error(`  ❌ Error: ${error}`);
      } finally {
        await page.close();
      }
    }
  }

  // ポイントサイト
  for (const site of POINT_SITE_TARGETS) {
    for (const keyword of site.search_keywords) {
      const page = await context.newPage();
      const searchUrl = `${site.base_url}search?q=${encodeURIComponent(keyword + " モバイル")}`;
      console.log(`📸 ${site.site_name} (${keyword}): ${searchUrl}`);

      try {
        await page.goto(searchUrl, { waitUntil: "networkidle", timeout: 30000 });
        await page.waitForTimeout(2000);

        const filename = `pointsite_${site.site_name}_${keyword}_${timestamp}.png`;
        await page.screenshot({
          path: path.join(SCREENSHOT_DIR, filename),
          fullPage: false, // ファーストビューのみ
        });
        console.log(`  ✅ → ${filename}`);
      } catch (error) {
        console.error(`  ❌ Error: ${error}`);
      } finally {
        await page.close();
      }
    }
  }

  await browser.close();
  console.log(`\n📁 Screenshots saved to: ${SCREENSHOT_DIR}`);
}

takeScreenshots().catch(console.error);
