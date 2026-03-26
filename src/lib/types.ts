export interface Campaign {
  name: string;
  type: "discount" | "point" | "cashback";
  amount: number;
  duration_months?: number;
  end_date: string | null;
  conditions: string;
}

export interface PointSite {
  site_name: string;
  reward: number;
  url: string;
  last_updated: string;
}

export interface MobilePlan {
  provider_name: string;
  plan_name: string;
  monthly_fee_base: number;
  data_allowance_gb: number | null;
  unlimited_data: boolean;
  family_discount_available: boolean;
  family_discount_amount: number;
  set_discount_available: boolean;
  is_recommendable: boolean;
  features: string[];
  demerits: string[];
  official_url: string;
  campaigns: Campaign[];
  point_site: PointSite | null;
}

export interface MobilePlansData {
  last_updated: string;
  plans: MobilePlan[];
}

export type DataUsage = "light" | "medium" | "heavy" | "unknown";

export interface DiagnosisInput {
  current_carrier: string;
  data_usage: DataUsage;
  has_family_discount: boolean | null;
}

export interface RecommendationResult {
  recommended_plan: MobilePlan;
  monthly_saving: number;
  annual_saving: number;
  first_year_total_benefit: number;
  reasons: string[];
  cautions: string[];
  not_recommended_if: string[];
  note?: string;
  second_plan?: {
    provider_name: string;
    plan_name: string;
    monthly_fee: number;
    monthly_saving: number;
  };
}

export interface NoRecommendationResult {
  no_recommendation: true;
  message: string;
  reasons: string[];
}

export type RecommendResult = RecommendationResult | NoRecommendationResult;
