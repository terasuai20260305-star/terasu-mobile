// 質問回答型（Q1-Q10 + 任意のQ11）
export interface RecommendAnswers {
  q1: string;    // 今使っている会社
  q2: string;    // 今のプラン名わかる？
  q3: string;    // 今の使い方（Q2≠わかる のとき表示）
  q4: string;    // 今のスマホ代
  q5: string;    // 電話の使い方
  q6: string;    // これから使いたい量
  q7: string;    // 昼の速度許容
  q8: string;    // 番号そのまま
  q9: string[];  // 家族割・セット割
  q10: string[]; // 経済圏
  q11?: string;  // 光回線の種別（Q9で「家のネット」を選んだときのみ表示）
}

// 適用できる可能性のあるセット割（スコアには含まれない）
export interface ApplicableBundleDiscount {
  discount_id: string;
  label: string;         // 表示名（例: "ドコモ光セット割"）
  monthly_amount: number; // 月額割引額（円）
  note: string;          // 注意書き（例: "別途ドコモ光契約が必要"）
}

// 実質月額の計算内訳
export interface EffectiveMonthlyBreakdown {
  monthly_price: number;
  initial_cost: number;
  official_campaign_title: string | null;
  official_campaign_value_yen: number | null;
  official_campaign_raw: string | null;
  point_site_name: string | null;
  point_site_value_yen: number | null;
  effective_first_year_cost: number;
  effective_monthly_cost: number;
  additional_potential_yen?: number;
  additional_potential_note?: string;
}

// 推薦結果型
export interface RecommendV2Recommendation {
  rank: number;
  carrier_name: string;
  plan_name: string;
  headline: string;
  monthly_price_tax_included: number;
  effective_first_year_cost_yen: number;
  effective_monthly_cost_yen: number;
  data_capacity_display: string;
  best_point_site_name: string | null;
  best_point_site_reward_yen: number | null;
  best_point_site_link: string | null;
  best_point_site_status: string;
  point_site_display: string;
  best_official_campaign_title: string | null;
  official_campaign_display: string;
  recommendation_reason_short: string;
  recommendation_reason_long: string;
  caution_note: string;
  confidence_label: "high" | "medium" | "low";
  tags: string[];
  voice_support: boolean;
  esim_available: boolean | null;
  wifi_comment: string;
  cost_comment: string;
  effective_monthly_breakdown: EffectiveMonthlyBreakdown;
  non_cash_perks: Array<{
    title: string
    type: string
    value_yen: number
    raw: string
    reward_is_cash_equivalent: boolean
    reward_included_in_effective_cost: boolean
  }>
  applicable_bundle_discounts?: ApplicableBundleDiscount[]
}

export interface RecommendV2Response {
  status: "ok" | "error";
  error_message?: string;
  generated_at: string;
  data_updated_at: string;
  total_candidates: number;
  recommendations: RecommendV2Recommendation[];
  estimated_current_plan?: {
    estimated: boolean
    description?: string | null
    group?: string
    bill_band?: string
    midpoint?: number | null
    estimated_gb_band?: string | null
    plan_known?: string
  } | null;
  savings_limited?: boolean;
  savings_limited_reason?: string | null;
}
