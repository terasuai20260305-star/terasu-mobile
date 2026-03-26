import type {
  MobilePlan,
  DataUsage,
  DiagnosisInput,
  RecommendResult,
} from "./types";
import plansData from "../../data/mobile-plans.json";

// キャリア名 → 推薦から除外するプロバイダー名のマッピング
// 「格安SIM（MVNO）」選択時は全MVNOを除外
const CARRIER_TO_PROVIDER: Record<string, string[]> = {
  ドコモ: ["ドコモ"],
  au: ["au"],
  ソフトバンク: ["ソフトバンク"],
  楽天モバイル: ["楽天モバイル"],
  "格安SIM（MVNO）": ["IIJmio", "mineo", "OCNモバイルONE"],
  わからない: [],
};

// 推薦対象外のプロバイダー（新規受付終了）
const EXCLUDED_PROVIDERS = ["OCNモバイルONE"];

// データ使用量 → 想定月額（大手キャリア利用時の概算）
const ESTIMATED_CURRENT_FEE: Record<string, Record<DataUsage, number>> = {
  ドコモ: { light: 2167, medium: 7315, heavy: 7315, unknown: 5000 },
  au: { light: 3278, medium: 7238, heavy: 7238, unknown: 5000 },
  ソフトバンク: { light: 3278, medium: 7425, heavy: 7425, unknown: 5000 },
  楽天モバイル: { light: 1078, medium: 2178, heavy: 3278, unknown: 2178 },
  "格安SIM（MVNO）": { light: 990, medium: 1500, heavy: 2000, unknown: 1500 },
  わからない: { light: 3000, medium: 5000, heavy: 7000, unknown: 5000 },
};

// データ使用量に応じた必要GB
function requiredGb(usage: DataUsage): number | null {
  switch (usage) {
    case "light":
      return 3;
    case "medium":
      return 20;
    case "heavy":
      return null; // 無制限が望ましい
    case "unknown":
      return 20; // 中間で見積もる
  }
}

// プランがデータ使用量に適合するかチェック
function matchesDataUsage(plan: MobilePlan, usage: DataUsage): boolean {
  const needed = requiredGb(usage);

  if (needed === null) {
    // heavy: 無制限プランのみ
    return plan.unlimited_data;
  }

  if (plan.unlimited_data) return true;
  if (plan.data_allowance_gb === null) return false;
  return plan.data_allowance_gb >= needed;
}

// プランのスコアリング（低いほど良い = 実質月額ベース）
function scorePlan(
  plan: MobilePlan,
  usage: DataUsage,
  hasFamilyDiscount: boolean | null
): number {
  let effectiveFee = plan.monthly_fee_base;

  // 家族割の適用
  if (hasFamilyDiscount === true && plan.family_discount_available) {
    effectiveFee -= plan.family_discount_amount;
  }

  // データ使用量とプランの適合度ボーナス
  const needed = requiredGb(usage);
  if (needed !== null && plan.data_allowance_gb !== null && !plan.unlimited_data) {
    // 必要量にぴったりなプランを優遇（余りが少ないほど良い）
    const excess = plan.data_allowance_gb - needed;
    if (excess >= 0 && excess <= 5) {
      effectiveFee -= 100; // ちょうど良いボーナス
    }
  }

  // 楽天モバイルの段階制料金を考慮
  if (plan.provider_name === "楽天モバイル") {
    if (usage === "light") effectiveFee = 1078;
    else if (usage === "medium") effectiveFee = 2178;
    // heavy はそのまま 3278
  }

  // マイそく（低速無制限）はヘビー・ミディアムユーザーにはペナルティ
  // 1.5Mbps制限は実用上「無制限」とは言い難い
  if (plan.plan_name === "マイそく（スタンダード）") {
    if (usage === "heavy") effectiveFee += 3000;
    else if (usage === "medium") effectiveFee += 1500;
    else if (usage === "unknown") effectiveFee += 2000;
  }

  return effectiveFee;
}

// 推薦理由を生成
function generateReasons(
  plan: MobilePlan,
  input: DiagnosisInput,
  monthlySaving: number
): string[] {
  const reasons: string[] = [];

  if (monthlySaving > 0) {
    reasons.push(
      `今より月額${monthlySaving.toLocaleString()}円安くなる見込みです`
    );
  }

  if (plan.unlimited_data && input.data_usage === "heavy") {
    reasons.push("データ無制限なので容量を気にせず使えます");
  }

  if (
    input.data_usage === "light" &&
    plan.data_allowance_gb !== null &&
    plan.data_allowance_gb <= 5
  ) {
    reasons.push("ライトユーザーに最適な容量と料金バランスです");
  }

  if (input.data_usage === "medium") {
    reasons.push("普段使いにちょうど良い容量のプランです");
  }

  if (plan.provider_name === "楽天モバイル") {
    reasons.push("国内通話が無料で、通話料も節約できます");
  }

  if (
    plan.provider_name === "IIJmio" ||
    plan.provider_name === "mineo"
  ) {
    reasons.push("格安SIMの中でも利用者満足度が高いサービスです");
  }

  return reasons.slice(0, 3);
}

// 注意点を生成
function generateCautions(plan: MobilePlan): string[] {
  const cautions: string[] = [];

  if (
    plan.provider_name === "IIJmio" ||
    plan.provider_name === "mineo"
  ) {
    cautions.push("昼12時台は通信速度が低下する場合があります");
  }

  if (plan.provider_name === "楽天モバイル") {
    cautions.push("地下やビル内では繋がりにくい場合があります");
  }

  if (
    plan.provider_name === "IIJmio" ||
    plan.provider_name === "mineo" ||
    plan.provider_name === "楽天モバイル"
  ) {
    cautions.push("大手キャリアと比べて対面サポートが少なめです");
  }

  if (plan.plan_name === "マイそく（スタンダード）") {
    cautions.push("最大速度が1.5Mbpsに制限されるため高画質動画には不向きです");
  }

  if (cautions.length === 0) {
    cautions.push("乗り換え時にMNP手続きが必要です");
  }

  return cautions.slice(0, 2);
}

// 向かない人を生成
function generateNotRecommendedIf(plan: MobilePlan): string[] {
  const items: string[] = [];

  if (
    plan.provider_name === "IIJmio" ||
    plan.provider_name === "mineo"
  ) {
    items.push("昼休みにスマホを頻繁に使う方");
    items.push("困ったとき店舗で相談したい方");
  }

  if (plan.provider_name === "楽天モバイル") {
    items.push("地下鉄や地下街での利用が多い方");
    items.push("電波の安定性を最重視する方");
  }

  if (plan.plan_name === "マイそく（スタンダード）") {
    items.push("高画質な動画視聴やオンラインゲームをする方");
  }

  if (!plan.unlimited_data && plan.data_allowance_gb !== null) {
    if (plan.data_allowance_gb <= 5) {
      items.push("動画をよく観る方やテザリングを多用する方");
    }
  }

  if (items.length === 0) {
    items.push("現在のキャリアの独自サービスに依存している方");
  }

  return items.slice(0, 2);
}

// メインの推薦関数
export function recommend(input: DiagnosisInput): RecommendResult {
  const allPlans: MobilePlan[] = plansData.plans;

  // 現在のキャリアに該当するプロバイダーを除外
  const excludedProviders = [
    ...EXCLUDED_PROVIDERS,
    ...(CARRIER_TO_PROVIDER[input.current_carrier] || []),
  ];

  // 候補プランをフィルタリング
  const candidates = allPlans.filter(
    (plan) =>
      !excludedProviders.includes(plan.provider_name) &&
      matchesDataUsage(plan, input.data_usage)
  );

  if (candidates.length === 0) {
    return {
      no_recommendation: true,
      message:
        "現在のプランがすでに最適な可能性が高いです。条件を変えて再度お試しください。",
    };
  }

  // 現在の推定月額を取得
  const carrierFees =
    ESTIMATED_CURRENT_FEE[input.current_carrier] ||
    ESTIMATED_CURRENT_FEE["わからない"];
  const currentFee = carrierFees[input.data_usage];

  // スコアリングして最適プランを選択
  const scored = candidates.map((plan) => ({
    plan,
    score: scorePlan(plan, input.data_usage, input.has_family_discount),
  }));

  scored.sort((a, b) => a.score - b.score);

  const best = scored[0];
  const monthlySaving = Math.max(0, currentFee - best.score);

  // 改善余地なし判定（月200円未満の改善は誤差の範囲）
  if (monthlySaving < 200) {
    return {
      no_recommendation: true,
      message:
        "現在のプランはすでにお得です！大きな改善余地は見つかりませんでした。",
    };
  }

  return {
    recommended_plan: best.plan,
    monthly_saving: monthlySaving,
    annual_saving: monthlySaving * 12,
    reasons: generateReasons(best.plan, input, monthlySaving),
    cautions: generateCautions(best.plan),
    not_recommended_if: generateNotRecommendedIf(best.plan),
  };
}
