/**
 * Phase 3: バリデーション＋差分チェック＋mobile-plans.json更新
 *
 * 使い方:
 *   npx tsx scripts/scraper/validate-and-update.ts
 *
 * 処理フロー:
 *   1. data/extracted/ の最新抽出結果を読み込み
 *   2. 現在の mobile-plans.json と比較
 *   3. バリデーション（異常値チェック）
 *   4. 差分が小さければ自動更新、大きければ警告して人間確認を要求
 */

import fs from "fs";
import path from "path";
import { VALIDATION } from "./config";

const PLANS_PATH = path.join(__dirname, "../../data/mobile-plans.json");
const EXTRACTED_DIR = path.join(__dirname, "../../data/extracted");

interface ValidationResult {
  valid: boolean;
  warnings: string[];
  errors: string[];
  changes: string[];
  requires_human_review: boolean;
}

function getLatestExtraction(): Record<string, unknown> | null {
  if (!fs.existsSync(EXTRACTED_DIR)) return null;
  const files = fs
    .readdirSync(EXTRACTED_DIR)
    .filter((f) => f.startsWith("extraction_") && f.endsWith(".json"))
    .sort()
    .reverse();
  if (files.length === 0) return null;
  return JSON.parse(fs.readFileSync(path.join(EXTRACTED_DIR, files[0]), "utf-8"));
}

function validateExtractedData(extracted: Record<string, unknown>): ValidationResult {
  const result: ValidationResult = {
    valid: true,
    warnings: [],
    errors: [],
    changes: [],
    requires_human_review: false,
  };

  // 現在のプランデータを読み込み
  const currentData = JSON.parse(fs.readFileSync(PLANS_PATH, "utf-8"));
  const currentPlans = currentData.plans;

  for (const [filename, data] of Object.entries(extracted)) {
    if (!data || typeof data !== "object") continue;
    const d = data as Record<string, unknown>;

    if (d.error) {
      result.errors.push(`${filename}: 抽出エラー - ${d.error}`);
      result.valid = false;
      continue;
    }

    // プラン料金のバリデーション
    if (d.plans && Array.isArray(d.plans)) {
      for (const plan of d.plans) {
        const p = plan as Record<string, unknown>;
        const fee = Number(p.monthly_fee_base);

        if (fee < VALIDATION.MIN_MONTHLY_FEE || fee > VALIDATION.MAX_MONTHLY_FEE) {
          result.errors.push(
            `${filename}: ${p.plan_name}の月額${fee}円が範囲外 (${VALIDATION.MIN_MONTHLY_FEE}〜${VALIDATION.MAX_MONTHLY_FEE})`
          );
          result.valid = false;
        }

        // 既存プランとの差分チェック
        const existing = currentPlans.find(
          (cp: Record<string, unknown>) => cp.plan_name === p.plan_name
        );
        if (existing) {
          const diff = Math.abs(fee - Number(existing.monthly_fee_base));
          if (diff > VALIDATION.PRICE_CHANGE_THRESHOLD) {
            result.warnings.push(
              `${p.plan_name}: 料金変動 ${existing.monthly_fee_base}円 → ${fee}円 (差額${diff}円)`
            );
            result.requires_human_review = true;
          } else if (diff > 0) {
            result.changes.push(
              `${p.plan_name}: 料金変動 ${existing.monthly_fee_base}円 → ${fee}円`
            );
          }
        } else {
          result.warnings.push(`新プラン検出: ${p.plan_name} (${fee}円/月)`);
          result.requires_human_review = true;
        }
      }
    }

    // ポイントサイト還元のバリデーション
    if (d.rewards && Array.isArray(d.rewards)) {
      for (const reward of d.rewards) {
        const r = reward as Record<string, unknown>;
        const amount = Number(r.reward);

        if (amount < VALIDATION.MIN_POINT_REWARD || amount > VALIDATION.MAX_POINT_REWARD) {
          result.errors.push(
            `${filename}: ${r.provider_name}の還元額${amount}円が範囲外`
          );
          result.valid = false;
        }
      }
    }
  }

  return result;
}

function main() {
  console.log("🔍 バリデーション開始...\n");

  const extracted = getLatestExtraction();
  if (!extracted) {
    console.error("❌ 抽出データが見つかりません。先に extract.ts を実行してください");
    process.exit(1);
  }

  const result = validateExtractedData(extracted);

  // 結果表示
  if (result.errors.length > 0) {
    console.log("❌ エラー:");
    result.errors.forEach((e) => console.log(`  - ${e}`));
  }

  if (result.warnings.length > 0) {
    console.log("\n⚠️ 警告（人間確認が必要）:");
    result.warnings.forEach((w) => console.log(`  - ${w}`));
  }

  if (result.changes.length > 0) {
    console.log("\n✅ 変更点:");
    result.changes.forEach((c) => console.log(`  - ${c}`));
  }

  if (result.requires_human_review) {
    console.log("\n🛑 人間による確認が必要です。以下を確認してから手動で更新してください:");
    console.log("  1. 上記の警告内容を確認");
    console.log("  2. 必要に応じて data/mobile-plans.json を手動更新");
    console.log("  3. git commit & push");
    // TODO: Slack/LINE通知を送信
    process.exit(2);
  }

  if (!result.valid) {
    console.log("\n❌ バリデーションエラーがあるため更新をスキップします");
    process.exit(1);
  }

  if (result.changes.length === 0) {
    console.log("\n✅ 変更なし。現在のデータは最新です。");
    return;
  }

  // 自動更新（安全な変更のみ）
  console.log("\n🔄 mobile-plans.json を自動更新します...");
  // TODO: 抽出データを使って mobile-plans.json を更新する処理
  // 現時点では差分レポートのみ
  console.log("  ※ 自動更新機能は未実装です。上記の変更点を参考に手動更新してください。");
}

main();
