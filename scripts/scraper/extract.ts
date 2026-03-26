/**
 * Phase 2: Claude Vision API でスクリーンショットから構造化データを抽出
 *
 * 使い方:
 *   ANTHROPIC_API_KEY=sk-... npx tsx scripts/scraper/extract.ts
 *
 * 処理フロー:
 *   1. data/screenshots/ のスクショを読み込み
 *   2. Claude Vision API に送信して構造化JSONを取得
 *   3. data/extracted/ に抽出結果を保存
 */

import Anthropic from "@anthropic-ai/sdk";
import fs from "fs";
import path from "path";
import {
  CARRIER_EXTRACTION_PROMPT,
  POINT_SITE_EXTRACTION_PROMPT,
} from "./config";

const SCREENSHOT_DIR = path.join(__dirname, "../../data/screenshots");
const EXTRACTED_DIR = path.join(__dirname, "../../data/extracted");

function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

async function extractFromScreenshot(
  client: Anthropic,
  imagePath: string,
  prompt: string
): Promise<unknown> {
  const imageData = fs.readFileSync(imagePath);
  const base64 = imageData.toString("base64");
  const ext = path.extname(imagePath).toLowerCase();
  const mediaType = ext === ".jpg" || ext === ".jpeg" ? "image/jpeg" : "image/png";

  const response = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 4096,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: {
              type: "base64",
              media_type: mediaType,
              data: base64,
            },
          },
          {
            type: "text",
            text: prompt,
          },
        ],
      },
    ],
  });

  // レスポンスからJSONを抽出
  const text = response.content
    .filter((block): block is Anthropic.TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("");

  // JSON部分を抽出（```json ... ``` or 直接JSON）
  const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/) || text.match(/(\{[\s\S]*\})/);
  if (!jsonMatch) {
    throw new Error(`JSON not found in response: ${text.substring(0, 200)}`);
  }

  return JSON.parse(jsonMatch[1]);
}

async function main() {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error("❌ ANTHROPIC_API_KEY が設定されていません");
    process.exit(1);
  }

  ensureDir(EXTRACTED_DIR);
  const client = new Anthropic();

  const files = fs.readdirSync(SCREENSHOT_DIR).filter((f) => f.endsWith(".png"));
  if (files.length === 0) {
    console.error("❌ スクリーンショットが見つかりません。先に screenshot.ts を実行してください");
    process.exit(1);
  }

  const timestamp = new Date().toISOString().split("T")[0];
  const results: Record<string, unknown> = {};

  for (const file of files) {
    const imagePath = path.join(SCREENSHOT_DIR, file);
    const isPointSite = file.startsWith("pointsite_");
    const prompt = isPointSite ? POINT_SITE_EXTRACTION_PROMPT : CARRIER_EXTRACTION_PROMPT;

    console.log(`🔍 Extracting: ${file}`);
    try {
      const data = await extractFromScreenshot(client, imagePath, prompt);
      results[file] = data;
      console.log(`  ✅ Extracted successfully`);
    } catch (error) {
      console.error(`  ❌ Error: ${error}`);
      results[file] = { error: String(error) };
    }

    // レート制限を避けるため少し待機
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  // 抽出結果を保存
  const outputPath = path.join(EXTRACTED_DIR, `extraction_${timestamp}.json`);
  fs.writeFileSync(outputPath, JSON.stringify(results, null, 2));
  console.log(`\n📁 Extraction results saved to: ${outputPath}`);
}

main().catch(console.error);
