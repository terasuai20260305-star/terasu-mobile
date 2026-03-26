/**
 * スクレイピング対象のキャリア・ポイントサイト設定
 *
 * 各キャリアの料金ページURLと、ポイントサイトの検索対象を定義。
 * Playwright でスクリーンショットを取得し、Claude Vision API で構造化データを抽出する。
 */

export interface CarrierTarget {
  provider_name: string;
  urls: string[];
  description: string;
}

export interface PointSiteTarget {
  site_name: string;
  base_url: string;
  search_keywords: string[];
}

export const CARRIER_TARGETS: CarrierTarget[] = [
  {
    provider_name: "ドコモ",
    urls: [
      "https://www.docomo.ne.jp/charge/eximo/",
      "https://www.docomo.ne.jp/charge/irumo/",
    ],
    description: "eximo, irumoの料金・キャンペーン",
  },
  {
    provider_name: "au",
    urls: [
      "https://www.au.com/mobile/charge/smartphone/plan-unlimited-max/",
      "https://www.au.com/mobile/charge/smartphone/plan-smahomini/",
    ],
    description: "使い放題MAX, スマホミニプランの料金・キャンペーン",
  },
  {
    provider_name: "ソフトバンク",
    urls: [
      "https://www.softbank.jp/mobile/price-plan/meriharimuseigen-plus/",
      "https://www.softbank.jp/mobile/price-plan/minifitplan-plus/",
    ],
    description: "メリハリ無制限+, ミニフィットプラン+の料金・キャンペーン",
  },
  {
    provider_name: "楽天モバイル",
    urls: [
      "https://network.mobile.rakuten.co.jp/fee/saikyo-plan/",
      "https://network.mobile.rakuten.co.jp/campaign/",
    ],
    description: "Rakuten最強プランの料金・キャンペーン",
  },
  {
    provider_name: "IIJmio",
    urls: [
      "https://www.iijmio.jp/gigaplan/",
      "https://www.iijmio.jp/campaign/",
    ],
    description: "ギガプランの料金・キャンペーン",
  },
  {
    provider_name: "mineo",
    urls: [
      "https://mineo.jp/price/",
      "https://mineo.jp/campaign/",
    ],
    description: "マイピタ, マイそくの料金・キャンペーン",
  },
];

export const POINT_SITE_TARGETS: PointSiteTarget[] = [
  {
    site_name: "ハピタス",
    base_url: "https://hapitas.jp/",
    search_keywords: ["ドコモ", "au", "ソフトバンク", "楽天モバイル", "IIJmio", "mineo"],
  },
  {
    site_name: "モッピー",
    base_url: "https://moppy.jp/",
    search_keywords: ["ドコモ", "au", "ソフトバンク", "楽天モバイル", "IIJmio", "mineo"],
  },
  {
    site_name: "ポイントインカム",
    base_url: "https://pointi.jp/",
    search_keywords: ["ドコモ", "au", "ソフトバンク", "楽天モバイル", "IIJmio", "mineo"],
  },
  {
    site_name: "価格.com",
    base_url: "https://kakaku.com/mobile_data/sim/",
    search_keywords: [],
  },
];

/**
 * Claude Vision API に渡すプロンプト
 */
export const CARRIER_EXTRACTION_PROMPT = `以下の携帯キャリア料金ページのスクリーンショットから、料金プラン情報を正確に抽出してください。

抽出項目（JSON形式で出力）：
{
  "plans": [
    {
      "plan_name": "プラン名",
      "monthly_fee_base": 月額基本料金（税込、数値のみ）,
      "data_allowance_gb": データ容量（GB、無制限ならnull）,
      "unlimited_data": true/false
    }
  ],
  "campaigns": [
    {
      "name": "キャンペーン名",
      "type": "discount" | "point" | "cashback",
      "amount": 金額（数値のみ）,
      "duration_months": 適用月数（一括ならnull）,
      "end_date": "終了日（YYYY-MM-DD形式、不明ならnull）",
      "conditions": "適用条件"
    }
  ]
}

重要なルール：
- 推測ではなく、画像に記載されている情報のみを抽出すること
- 税込価格を使用すること
- 金額は数値のみ（カンマや円記号は除く）
- 確信が持てない項目には "confidence": "low" を付与すること`;

export const POINT_SITE_EXTRACTION_PROMPT = `以下のポイントサイトのスクリーンショットから、携帯キャリアの還元情報を抽出してください。

抽出項目（JSON形式で出力）：
{
  "rewards": [
    {
      "provider_name": "キャリア名",
      "reward": 還元額（数値のみ、ポイント数）,
      "conditions": "条件",
      "url": "案件ページURL（わかれば）"
    }
  ]
}

重要なルール：
- 推測ではなく、画像に記載されている情報のみを抽出すること
- 還元額は数値のみ
- 対象が見つからない場合は空配列を返すこと`;

/**
 * バリデーション閾値
 */
export const VALIDATION = {
  /** 月額料金の許容範囲 */
  MIN_MONTHLY_FEE: 500,
  MAX_MONTHLY_FEE: 15000,
  /** 前回からの価格変動許容額（これを超えたら人間確認） */
  PRICE_CHANGE_THRESHOLD: 500,
  /** ポイントサイト還元の許容範囲 */
  MIN_POINT_REWARD: 0,
  MAX_POINT_REWARD: 50000,
};
