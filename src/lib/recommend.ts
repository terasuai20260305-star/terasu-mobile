import type {
  MobilePlan,
  DataUsage,
  DiagnosisInput,
  RecommendResult,
  RecommendationResult,
} from "./types";
import plansData from "../../data/mobile-plans.json";

const CARRIER_TO_PROVIDER: Record<string, string[]> = {
  ドコモ: ["ドコモ"],
  au: ["au"],
  ソフトバンク: ["ソフトバンク"],
  楽天モバイル: ["楽天モバイル"],
  "格安SIM（MVNO）": ["IIJmio", "mineo", "OCNモバイルONE"],
  わからない: [],
};

const ESTIMATED_CURRENT_FEE: Record<string, Record<DataUsage, number>> = {
  ドコモ: { light: 2167, medium: 7315, heavy: 7315, unknown: 7315 },
  au: { light: 3278, medium: 7238, heavy: 7238, unknown: 7238 },
  ソフトバンク: { light: 3278, medium: 7425, heavy: 7425, unknown: 7238 },
  楽天モバイル: { light: 1078, medium: 2178, heavy: 3278, unknown: 2178 },
  "格安SIM（MVNO）": { light: 990, medium: 2000, heavy: 2178, unknown: 2178 },
  わからない: { light: 3000, medium: 6000, heavy: 7000, unknown: 6000 },
};

function requiredGb(usage: DataUsage): number | null {
  switch (usage) {
    case "light": return 3;
    case "medium": return 20;
    case "heavy": return null;
    case "unknown": return 20;
  }
}

function matchesDataUsage(plan: MobilePlan, usage: DataUsage): boolean {
  const needed = requiredGb(usage);
  if (needed === null) return plan.unlimited_data;
  if (plan.unlimited_data) return true;
  if (plan.data_allowance_gb === null) return false;
  return plan.data_allowance_gb >= needed;
}

function scorePlan(
  plan: MobilePlan,
  usage: DataUsage,
  hasFamilyDiscount: boolean | null
): number {
  let effectiveFee = plan.monthly_fee_base;

  if (hasFamilyDiscount === true && plan.family_discount_available) {
    effectiveFee -= plan.family_discount_amount;
  }

  const needed = requiredGb(usage);
  if (needed !== null && plan.data_allowance_gb !== null && !plan.unlimited_data) {
    const excess = plan.data_allowance_gb - needed;
    if (excess >= 0 && excess <= 5) {
      effectiveFee -= 100;
    }
  }

  if (plan.provider_name === "楽天モバイル") {
    if (usage === "light") effectiveFee = 1078;
    else if (usage === "medium") effectiveFee = 2178;
  }

  if (plan.plan_name === "マイそく（スタンダード）") {
    if (usage === "heavy") effectiveFee += 3000;
    else if (usage === "medium") effectiveFee += 1500;
    else if (usage === "unknown") effectiveFee += 2000;
  }

  return effectiveFee;
}

/**
 * 初年度トータルお得額を計算
 * = 月額節約 × 12 + キャンペーン特典合計 + ポイントサイト還元
 */
function calcFirstYearBenefit(
  plan: MobilePlan,
  monthlySaving: number
): number {
  let total = monthlySaving * 12;

  // キャンペーン特典
  for (const c of plan.campaigns) {
    if (c.type === "discount" && c.duration_months) {
      total += c.amount * c.duration_months;
    } else {
      // point, cashback, or one-time discount
      total += c.amount;
    }
  }

  // ポイントサイト還元（最高額のもの）
  if (plan.point_site) {
    total += plan.point_site.reward;
  }

  return total;
}

/**
 * キャンペーン特典の合計額（一時金換算）
 */
function calcCampaignTotal(plan: MobilePlan): number {
  let total = 0;
  for (const c of plan.campaigns) {
    if (c.type === "discount" && c.duration_months) {
      total += c.amount * c.duration_months;
    } else {
      total += c.amount;
    }
  }
  return total;
}

function generateReasons(
  plan: MobilePlan,
  input: DiagnosisInput,
  monthlySaving: number
): string[] {
  const reasons: string[] = [];

  if (monthlySaving > 0) {
    reasons.push(`今より月額${monthlySaving.toLocaleString()}円安くなる見込みです`);
  }

  if (plan.unlimited_data && input.data_usage === "heavy") {
    reasons.push("データ無制限なので容量を気にせず使えます");
  }

  if (input.data_usage === "light" && plan.data_allowance_gb !== null && plan.data_allowance_gb <= 5) {
    reasons.push("ライトユーザーに最適な容量と料金バランスです");
  }

  if (input.data_usage === "medium") {
    reasons.push("普段使いにちょうど良い容量のプランです");
  }

  if (plan.provider_name === "楽天モバイル") {
    reasons.push("国内通話が無料で、通話料も節約できます");
  }

  if (plan.provider_name === "IIJmio" || plan.provider_name === "mineo") {
    reasons.push("格安SIMの中でも利用者満足度が高いサービスです");
  }

  // キャンペーン特典がある場合
  const campaignTotal = calcCampaignTotal(plan);
  if (campaignTotal > 0) {
    reasons.push(`キャンペーン特典で${campaignTotal.toLocaleString()}円相当もお得です`);
  }

  return reasons.slice(0, 4);
}

function generateCautions(plan: MobilePlan): string[] {
  const cautions: string[] = [];

  if (plan.provider_name === "IIJmio" || plan.provider_name === "mineo") {
    cautions.push("昼12時台は通信速度が低下する場合があります");
  }

  if (plan.provider_name === "楽天モバイル") {
    cautions.push("地下やビル内では繋がりにくい場合があります");
  }

  if (plan.provider_name === "IIJmio" || plan.provider_name === "mineo" || plan.provider_name === "楽天モバイル") {
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

function generateNotRecommendedIf(plan: MobilePlan): string[] {
  const items: string[] = [];

  if (plan.provider_name === "IIJmio" || plan.provider_name === "mineo") {
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

  if (!plan.unlimited_data && plan.data_allowance_gb !== null && plan.data_allowance_gb <= 5) {
    items.push("動画をよく観る方やテザリングを多用する方");
  }

  if (items.length === 0) {
    items.push("現在のキャリアの独自サービスに依存している方");
  }

  return items.slice(0, 2);
}

function generateNoRecommendReasons(input: DiagnosisInput): string[] {
  const reasons: string[] = [];

  if (input.current_carrier === "楽天モバイル") {
    reasons.push("楽天モバイルは段階制料金で、使用量に応じて最安水準です");
    reasons.push("通話料も無料のため、他社に乗り換えるメリットが少ないです");
  } else if (input.current_carrier === "格安SIM（MVNO）") {
    reasons.push("すでに格安SIMをご利用のため、大幅な改善余地がありません");
    reasons.push("現在のプランが使用量に合ったコスパの良い選択です");
  } else {
    reasons.push("現在のプランがお得な料金設定です");
  }

  return reasons;
}

export function recommend(input: DiagnosisInput): RecommendResult {
  const allPlans: MobilePlan[] = plansData.plans as MobilePlan[];

  const excludedProviders = [
    ...(CARRIER_TO_PROVIDER[input.current_carrier] || []),
  ];

  const candidates = allPlans.filter(
    (plan) =>
      plan.is_recommendable &&
      !excludedProviders.includes(plan.provider_name) &&
      matchesDataUsage(plan, input.data_usage)
  );

  if (candidates.length === 0) {
    return {
      no_recommendation: true,
      message: "現在のプランがすでに最適な可能性が高いです。",
      reasons: generateNoRecommendReasons(input),
    };
  }

  const carrierFees =
    ESTIMATED_CURRENT_FEE[input.current_carrier] ||
    ESTIMATED_CURRENT_FEE["わからない"];
  const currentFee = carrierFees[input.data_usage];

  const scored = candidates.map((plan) => ({
    plan,
    score: scorePlan(plan, input.data_usage, input.has_family_discount),
  }));

  scored.sort((a, b) => a.score - b.score);

  const best = scored[0];
  const monthlySaving = Math.max(0, currentFee - best.score);

  if (monthlySaving < 200) {
    return {
      no_recommendation: true,
      message: "現在のプランはすでにお得です！大きな改善余地は見つかりませんでした。",
      reasons: generateNoRecommendReasons(input),
    };
  }

  const isAllUnknown =
    input.current_carrier === "わからない" &&
    input.data_usage === "unknown" &&
    input.has_family_discount === null;

  // 初年度トータルお得額
  const firstYearTotalBenefit = calcFirstYearBenefit(best.plan, monthlySaving);

  // 2番目の候補
  let secondPlan: RecommendationResult["second_plan"] = undefined;
  if (scored.length >= 2) {
    const second = scored[1];
    const secondSaving = Math.max(0, currentFee - second.score);
    if (secondSaving >= 200) {
      secondPlan = {
        provider_name: second.plan.provider_name,
        plan_name: second.plan.plan_name,
        monthly_fee: second.score,
        monthly_saving: secondSaving,
      };
    }
  }

  return {
    recommended_plan: best.plan,
    monthly_saving: monthlySaving,
    annual_saving: monthlySaving * 12,
    first_year_total_benefit: firstYearTotalBenefit,
    reasons: generateReasons(best.plan, input, monthlySaving),
    cautions: generateCautions(best.plan),
    not_recommended_if: generateNotRecommendedIf(best.plan),
    ...(isAllUnknown && {
      note: "条件が不明なため、最も多くの方に合うプランをご提案しています。",
    }),
    ...(secondPlan && { second_plan: secondPlan }),
  };
}
