#!/usr/bin/env python3
"""
UI接続用アダプター
質問回答(q1-q10) → 推薦ロジック → UI表示用JSON を生成する。
フロントエンドからはこのモジュールの adapt() を呼ぶだけで完結する。
"""

import json
import sys
from pathlib import Path
from datetime import date

# ---------------------------------------------------------------------------
# パス（日次更新後もそのまま参照できるよう、統合データは固定パスから読む）
# ---------------------------------------------------------------------------
BASE_DIR = Path(__file__).resolve().parent.parent
INTEGRATED_PATH = BASE_DIR / "data" / "integrated" / "carrier-plan-integrated.json"
OUTPUT_DIR = BASE_DIR / "data" / "recommender"

# 推薦ロジック本体をインポート
sys.path.insert(0, str(BASE_DIR / "scripts"))
from recommend_carrier_plan import (
    recommend,
    load_integrated_data,
    convert_answers,
    _is_data_only,
    _is_low_speed_unlimited,
    _is_cash_equivalent_campaign,
    _extract_speed_limit,
    CARRIER_GROUP,
    CARRIER_SPEED_TIER,
    ECOSYSTEM_CARRIER_BONUS,
    USAGE_BAND_GB,
)

# ---------------------------------------------------------------------------
# ポイントサイト URL マッピング（検索ページ）
# ---------------------------------------------------------------------------
POINT_SITE_URLS = {
    "モッピー":               "https://pc.moppy.jp/",
    "ハピタス":               "https://hapitas.jp/",
    "ポイントインカム":       "https://pointi.jp/",
    "ワラウ":                 "https://www.warau.jp/",
    "ポイントタウン":         "https://www.pointtown.com/",
    "ECナビ":                 "https://ecnavi.jp/",
    "ちょびリッチ":           "https://www.chobirich.com/",
    "げん玉":                 "https://www.gendama.jp/",
    "Powl":                   "https://web.powl.jp/",
    "ニフティポイントクラブ": "https://lifemedia.jp/",
}


# ---------------------------------------------------------------------------
# 統合データのメタ情報取得
# ---------------------------------------------------------------------------

def _get_data_updated_at() -> str:
    """統合データの生成日を取得"""
    try:
        with open(INTEGRATED_PATH, "r", encoding="utf-8") as f:
            data = json.load(f)
        return data.get("meta", {}).get("generated_at", str(date.today()))
    except Exception:
        return str(date.today())


# ---------------------------------------------------------------------------
# 表示文言生成
# ---------------------------------------------------------------------------

def _data_capacity_display(rec: dict, full_rec: dict) -> str:
    """表示用データ容量"""
    if rec.get("unlimited_flag"):
        if full_rec and _is_low_speed_unlimited(full_rec):
            speed = _extract_speed_limit(full_rec)
            return f"無制限（低速{speed}）"
        pricing = (full_rec or {}).get("pricing_model", "")
        if pricing == "topping":
            return "無制限（都度購入型）"
        return "無制限"
    gb = rec.get("data_capacity_gb")
    if gb is None:
        return "―"
    if isinstance(gb, float) and gb == int(gb):
        return f"{int(gb)}GB"
    return f"{gb}GB"


def _point_site_display(rec: dict, full_rec: dict) -> str:
    """表示用ポイントサイト文言"""
    ps_name = rec.get("best_point_site_name")
    ps_yen = rec.get("best_point_site_reward_yen")
    if ps_name and ps_yen and ps_yen > 0:
        return f"{ps_name}経由で{ps_yen:,}円相当"
    # found_no_points の判定
    if full_rec:
        status = full_rec.get("best_point_site_status")
        if status == "found_no_points":
            return "ポイントサイト還元なし（掲載はあるが還元対象外）"
        if status == "unconfirmed":
            return "ポイントサイト還元：未確認"
    return "ポイントサイト掲載なし"


def _point_site_link(rec: dict) -> str | None:
    """ポイントサイトへのリンク URL（なければ None）"""
    ps_name = rec.get("best_point_site_name")
    ps_yen = rec.get("best_point_site_reward_yen")
    if ps_name and ps_yen and ps_yen > 0:
        return POINT_SITE_URLS.get(ps_name)
    return None


def _point_site_status_label(full_rec: dict | None) -> str:
    """ポイントサイトのステータスラベル"""
    if not full_rec:
        return "not_found"
    return full_rec.get("best_point_site_status", "not_found")


def _effective_monthly_breakdown(rec: dict, full_rec: dict) -> dict:
    """実質月額の計算内訳"""
    monthly = rec.get("monthly_price_tax_included", 0)
    initial = (full_rec or {}).get("total_initial_cost_yen", 0) or 0
    known_benefit = (full_rec or {}).get("total_known_benefit_yen", 0) or 0
    potential_benefit = (full_rec or {}).get("total_potential_benefit_yen", 0) or 0
    effective_year = rec.get("effective_first_year_cost_yen", 0)
    effective_monthly = rec.get("effective_monthly_cost_yen", 0)
    stacking = (full_rec or {}).get("official_campaign_stackability_status", "")

    # 公式キャンペーン
    official_title = rec.get("best_official_campaign_title") or ""
    official_yen = (full_rec or {}).get("best_official_reward_value_yen_normalized") or 0
    official_raw = (full_rec or {}).get("best_official_reward_raw") or ""

    # ポイントサイト
    ps_name = rec.get("best_point_site_name")
    ps_yen = rec.get("best_point_site_reward_yen") or 0

    breakdown = {
        "monthly_price": monthly,
        "initial_cost": initial,
        "official_campaign_title": official_title if official_title else None,
        "official_campaign_value_yen": official_yen if official_yen else None,
        "official_campaign_raw": official_raw if official_raw and not official_yen else None,
        "point_site_name": ps_name,
        "point_site_value_yen": ps_yen if ps_yen > 0 else None,
        "effective_first_year_cost": effective_year,
        "effective_monthly_cost": effective_monthly,
    }

    # stacking unknown の場合は追加ポテンシャルを表示
    if stacking == "unknown" and potential_benefit > known_benefit:
        breakdown["additional_potential_yen"] = potential_benefit - known_benefit
        breakdown["additional_potential_note"] = "条件が合えばさらに安くなる可能性あり（要確認）"

    return breakdown


def _official_campaign_display(rec: dict, full_rec: dict) -> str:
    """公式キャンペーンの表示文言"""
    title = rec.get("best_official_campaign_title")
    yen = (full_rec or {}).get("best_official_reward_value_yen_normalized")
    raw = (full_rec or {}).get("best_official_reward_raw")
    campaign_type = (full_rec or {}).get("best_official_campaign_type", "")

    if not title:
        return "公式キャンペーンなし"

    type_labels = {
        "point": "ポイント還元",
        "cashback": "キャッシュバック",
        "discount": "割引",
        "device_discount": "端末割引",
        "free_period": "無料期間",
    }
    type_label = type_labels.get(campaign_type, "特典")

    if yen and yen > 0:
        return f"{title}（{type_label}: {yen:,}円相当）"
    if raw:
        return f"{title}（{raw[:40]}）"
    return title


def _build_headline(rec: dict, features: dict, full_rec: dict) -> str:
    """UIカード上部の一行キャッチ"""
    carrier = rec.get("carrier_name", "")
    monthly = rec.get("monthly_price_tax_included", 0)
    effective_monthly = rec.get("effective_monthly_cost_yen", 0)
    gb = rec.get("data_capacity_gb")
    is_unlimited = rec.get("unlimited_flag", False)
    ecosystems = features.get("ecosystem_memberships", [])

    headline = None

    # 経済圏マッチ
    for eco in ecosystems:
        bonus_carriers = ECOSYSTEM_CARRIER_BONUS.get(eco, [])
        if carrier in bonus_carriers:
            eco_labels = {
                "rakuten": "楽天経済圏",
                "paypay_yahoo": "PayPay経済圏",
                "u_next": "U-NEXT利用者",
                "aeon": "イオン経済圏",
                "jcom": "J:COM利用者",
                "kyushu_bbiq": "九州エリア",
            }
            label = eco_labels.get(eco, "")
            if label:
                headline = f"{label}なら相性抜群の{carrier}"
                break

    # コスト系（通常月額を主役に）
    if headline is None:
        if monthly and monthly <= 1000:
            headline = f"月額{monthly:,}円の超低コストプラン"
        elif monthly and monthly <= 2000:
            headline = f"月額{monthly:,}円で始められる"

    # 容量系
    if headline is None:
        if is_unlimited:
            if full_rec and _is_low_speed_unlimited(full_rec):
                headline = "低速無制限で月額を最小限に"
            else:
                pricing = (full_rec or {}).get("pricing_model", "")
                if pricing == "topping":
                    headline = "必要なときだけ無制限（都度購入型）"
                else:
                    headline = f"高速無制限で月額{monthly:,}円"
        elif gb and gb >= 20:
            headline = f"{gb:.0f}GB大容量で月額{monthly:,}円"
        else:
            headline = f"月額{monthly:,}円で{gb or '?'}GBが使える"

    # データ専用プランは headline でも明示
    if full_rec and _is_data_only(full_rec) and "データ専用" not in headline:
        headline += "（データ専用）"
    return headline


def _build_reason_short(rec: dict, features: dict, full_rec: dict) -> str:
    """一行要点（30文字前後）"""
    carrier = rec.get("carrier_name", "")
    monthly = rec.get("monthly_price_tax_included", 0)
    gb = rec.get("data_capacity_gb")
    is_unlimited = rec.get("unlimited_flag", False)
    is_data = full_rec and _is_data_only(full_rec)
    band = features.get("usage_band", "standard")

    band_labels = {
        "light": "〜3GBユーザー",
        "standard": "〜10GBユーザー",
        "moderate": "20GB前後ユーザー",
        "heavy": "30GB前後ユーザー",
        "unlimited": "大容量ユーザー",
    }
    usage_label = band_labels.get(band, "")

    if is_unlimited:
        if full_rec and _is_low_speed_unlimited(full_rec):
            return f"低速無制限で月額{monthly:,}円。テキスト中心なら十分"
        return f"{usage_label}向けの無制限プラン。月額{monthly:,}円"

    gb_str = f"{gb:.0f}GB" if gb else "低容量"
    suffix = "（データ専用）" if is_data else ""
    return f"{usage_label}向け{gb_str}プラン{suffix}。月額{monthly:,}円"


def _build_reason_long(rec: dict, features: dict, full_rec: dict) -> str:
    """2〜4文の説明"""
    parts = []
    carrier = rec.get("carrier_name", "")
    monthly = rec.get("monthly_price_tax_included", 0)
    effective = rec.get("effective_first_year_cost_yen", 0)
    effective_monthly = rec.get("effective_monthly_cost_yen", 0)
    gb = rec.get("data_capacity_gb")
    is_unlimited = rec.get("unlimited_flag", False)
    is_data = full_rec and _is_data_only(full_rec)
    is_low_speed = full_rec and _is_low_speed_unlimited(full_rec)
    ecosystems = features.get("ecosystem_memberships", [])
    pricing = (full_rec or {}).get("pricing_model", "")

    # 容量/プラン特性
    if is_unlimited:
        if is_low_speed:
            speed = _extract_speed_limit(full_rec) if full_rec else "低速"
            parts.append(f"最大{speed}の低速無制限プランで、テキストや軽い検索向きです")
        elif pricing == "topping":
            parts.append("基本料0円で、必要なときだけデータを購入する都度購入型プランです。実際の月額は購入パターンで変わります")
        else:
            parts.append("高速データ通信が無制限で使えるプランです")
    elif gb:
        parts.append(f"月{gb:.0f}GBのデータ容量が使えるプランです")

    # データ専用
    if is_data:
        parts.append("音声通話には非対応のデータ通信専用プランです")

    # コスト（通常月額を先に、実質月額は補助）
    parts.append(f"通常月額{monthly:,}円（税込）で、特典を含めた初年度の月あたり目安は約{effective_monthly:,}円です")

    # 経済圏
    for eco in ecosystems:
        bonus_carriers = ECOSYSTEM_CARRIER_BONUS.get(eco, [])
        if carrier in bonus_carriers:
            eco_labels = {
                "rakuten": "楽天ポイントが貯まりやすく、楽天サービスとの相性がよいです",
                "paypay_yahoo": "PayPayポイントが貯まりやすく、Yahoo!サービスとの相性がよいです",
                "u_next": "U-NEXTとの相乗効果が期待でき、エンタメ利用者に向いています",
                "aeon": "WAONポイントとの連携があり、イオン利用者に向いています",
                "jcom": "J:COMサービスとのセット割が期待できます",
                "kyushu_bbiq": "九州電力/BBIQとのセット割が期待できます",
            }
            if eco in eco_labels:
                parts.append(eco_labels[eco])
                break

    # 昼間速度
    tolerance = features.get("daytime_speed_tolerance", "unknown")
    tier = CARRIER_SPEED_TIER.get(carrier, "mvno")
    if tolerance == "prefer_fast":
        if tier == "mno":
            parts.append("MNO回線で昼間の速度低下が起きにくいです")
        elif tier == "sub_brand":
            parts.append("サブブランドのため昼間の速度は比較的安定しています")
        elif tier == "mvno":
            parts.append("格安SIMのため昼間の速度低下が起きやすい点はご注意ください")
    elif tolerance == "tolerate_any" and tier == "mvno":
        parts.append("格安SIMですが安さ重視の方に向いています")

    # PS
    ps_name = rec.get("best_point_site_name")
    ps_yen = rec.get("best_point_site_reward_yen")
    if ps_name and ps_yen and ps_yen > 0:
        parts.append(f"ポイントサイト（{ps_name}）経由の申し込みで{ps_yen:,}円相当の還元が見込めます")

    return "。".join(parts)


def _build_tags(rec: dict, features: dict, full_rec: dict) -> list:
    """UIフィルタ・バッジ用タグ（最大4個、優先度順）"""
    priority_tags = []   # 警告系（必ず表示）
    normal_tags = []     # 通常系（スペースがあれば表示）

    gb = rec.get("data_capacity_gb")
    is_unlimited = rec.get("unlimited_flag", False)
    is_data = full_rec and _is_data_only(full_rec)
    is_low_speed = full_rec and _is_low_speed_unlimited(full_rec)
    carrier = rec.get("carrier_name", "")
    ecosystems = features.get("ecosystem_memberships", [])
    confidence = rec.get("confidence_label", "medium")

    # 警告タグ（優先表示）
    if is_data:
        priority_tags.append("データ専用")
    if is_low_speed:
        priority_tags.append("低速無制限")
    pricing = (full_rec or {}).get("pricing_model", "")
    if pricing == "topping":
        priority_tags.append("都度購入型")
    if confidence == "low" or rec.get("caution_note"):
        if "要確認あり" not in priority_tags:
            priority_tags.append("要確認あり")

    # 容量タグ
    if is_unlimited and not is_low_speed:
        normal_tags.append("無制限")
    elif gb is not None and not is_low_speed:
        normal_tags.append(f"{gb:.0f}GB")

    # 経済圏タグ（1つだけ）
    for eco in ecosystems:
        if carrier in ECOSYSTEM_CARRIER_BONUS.get(eco, []):
            eco_tag = {
                "rakuten": "楽天◎",
                "paypay_yahoo": "PayPay◎",
                "u_next": "U-NEXT◎",
                "aeon": "イオン◎",
                "jcom": "J:COM◎",
                "kyushu_bbiq": "BBIQ◎",
            }
            if eco in eco_tag:
                normal_tags.append(eco_tag[eco])
                break  # 1つだけ

    # 結合して最大4個
    tags = priority_tags + normal_tags
    return tags[:4]


def _build_wifi_comment(features: dict, rec: dict, full_rec: dict = None) -> str:
    """Wi-Fi有無に応じたコメント（新設計ではWi-Fi質問削除のため空文字が多い）"""
    wifi = features.get("wifi_home")
    gb = rec.get("data_capacity_gb")
    is_unlimited = rec.get("unlimited_flag", False)
    pricing = (full_rec or {}).get("pricing_model", "")

    if wifi is None:
        return ""

    if wifi is True:
        if is_unlimited and pricing == "topping":
            return "自宅Wi-Fiがあれば都度購入の頻度を抑えられます"
        if is_unlimited:
            return "自宅Wi-Fiがあるなら無制限でなくても足りる可能性があります"
        if gb and gb <= 10:
            return "自宅Wi-Fiがあるので、この容量で普段使いは十分です"
        return "自宅Wi-Fiありで外出先での利用を補完できます"
    elif wifi is False:
        if is_unlimited and pricing == "topping":
            return "都度購入型のため、Wi-Fiなしだと利用頻度に応じてコストが増えます"
        if is_unlimited:
            return "自宅Wi-Fiなしでも無制限なので安心です"
        if gb and gb >= 20:
            return "自宅Wi-Fiがなくても大容量でカバーできます"
        if gb and gb <= 5:
            return "自宅Wi-Fiがないため、外出先では節約が必要かもしれません"
        return "自宅Wi-Fiなしのため、容量の使い方に注意が必要です"
    else:
        return ""


def _build_cost_comment(rec: dict, full_rec: dict) -> str:
    """コストの補足"""
    parts = []
    confidence = rec.get("confidence_label", "medium")
    pricing = (full_rec or {}).get("pricing_model", "")
    stacking = (full_rec or {}).get("official_campaign_stackability_status", "")
    potential = (full_rec or {}).get("total_potential_benefit_yen", 0)
    known = (full_rec or {}).get("total_known_benefit_yen", 0)

    if pricing == "topping":
        parts.append("都度購入型のため、実際のコストは利用頻度で変わります")

    if confidence == "low":
        parts.append("比較データの信頼度が低めのため、公式サイトで最新情報をご確認ください")

    if stacking == "unknown" and potential and potential > 0:
        if known > 0:
            parts.append(f"確定還元{known:,}円に加え、条件が合えばさらに{potential - known:,}円相当が見込めます（要確認）")
        else:
            parts.append(f"条件が合えば最大{potential:,}円相当の特典が見込めます（要確認）")

    if not parts:
        return "表示コストは確定情報に基づいています"

    return "。".join(parts)


# ---------------------------------------------------------------------------
# メインアダプター
# ---------------------------------------------------------------------------

def _estimate_current_plan(features: dict, result: dict) -> dict | None:
    """現在のプラン帯を推定（推薦エンジンの結果を透過）"""
    estimated = result.get("estimated_current_plan")
    if estimated is not None:
        return estimated
    # フォールバック（推薦エンジンにデータがない場合）
    return {"estimated": False}


def adapt(answers: dict, records: list = None) -> dict:
    """
    UI接続のメインエントリポイント。
    answers: 質問回答 (q1〜q10)
    records: 統合データ (None なら自動読み込み)
    戻り値: ui-response-schema.json 準拠の dict
    """
    if records is None:
        records = load_integrated_data()

    features = convert_answers(answers)
    result = recommend(answers, records, top_n=3)

    data_updated_at = _get_data_updated_at()

    recommendations = []
    for i, r in enumerate(result["top_recommendations"], 1):
        # 統合データから完全レコードを取得
        full_rec = next(
            (x for x in records
             if x["carrier_name"] == r["carrier_name"]
             and x["plan_name"] == r["plan_name"]),
            None
        )

        recommendations.append({
            "rank": i,
            "carrier_name": r["carrier_name"],
            "plan_name": r["plan_name"],
            "headline": _build_headline(r, features, full_rec),
            "monthly_price_tax_included": r["monthly_price_tax_included"],
            "effective_first_year_cost_yen": r["effective_first_year_cost_yen"],
            "effective_monthly_cost_yen": r["effective_monthly_cost_yen"],
            "data_capacity_display": _data_capacity_display(r, full_rec),
            "best_point_site_name": r.get("best_point_site_name"),
            "best_point_site_reward_yen": r.get("best_point_site_reward_yen"),
            "best_point_site_link": _point_site_link(r),
            "best_point_site_status": _point_site_status_label(full_rec),
            "point_site_display": _point_site_display(r, full_rec),
            "best_official_campaign_title": r.get("best_official_campaign_title"),
            "official_campaign_display": _official_campaign_display(r, full_rec),
            "recommendation_reason_short": _build_reason_short(r, features, full_rec),
            "recommendation_reason_long": _build_reason_long(r, features, full_rec),
            "caution_note": r.get("caution_note", ""),
            "confidence_label": r.get("confidence_label", "medium"),
            "tags": _build_tags(r, features, full_rec),
            "voice_support": not (full_rec and _is_data_only(full_rec)),
            "esim_available": (full_rec or {}).get("esim_available"),
            "wifi_comment": _build_wifi_comment(features, r, full_rec),
            "cost_comment": _build_cost_comment(r, full_rec),
            "effective_monthly_breakdown": _effective_monthly_breakdown(r, full_rec),
            "non_cash_perks": r.get("non_cash_perks", []),
            "applicable_bundle_discounts": r.get("applicable_bundle_discounts", []),
        })

    return {
        "status": "ok",
        "generated_at": str(date.today()),
        "data_updated_at": data_updated_at,
        "total_candidates": result["total_candidates_evaluated"],
        "recommendations": recommendations,
        "estimated_current_plan": _estimate_current_plan(features, result),
        "savings_limited": result.get("savings_limited", False),
        "savings_limited_reason": result.get("savings_limited_reason"),
    }


# ---------------------------------------------------------------------------
# 監査
# ---------------------------------------------------------------------------

def audit_ui_output(output: dict, records: list) -> dict:
    """UI出力を7項目で監査"""
    checks = []
    recs = output.get("recommendations", [])

    # 1. 必要項目が揃っているか
    required_fields = [
        "rank", "carrier_name", "plan_name", "headline",
        "monthly_price_tax_included", "effective_first_year_cost_yen",
        "effective_monthly_cost_yen", "best_point_site_name",
        "best_point_site_reward_yen", "best_official_campaign_title",
        "recommendation_reason_short", "recommendation_reason_long",
        "caution_note", "confidence_label", "tags", "voice_support",
        "esim_available", "wifi_comment", "cost_comment",
    ]
    issues_1 = []
    for r in recs:
        missing = [f for f in required_fields if f not in r]
        if missing:
            issues_1.append(f"rank={r.get('rank')}: 不足フィールド {missing}")
    checks.append({"check": "B1_required_fields", "desc": "必要項目が揃っているか", "result": "FAIL" if issues_1 else "PASS", "issues": issues_1})

    # 2. データ専用に音声通話不可の明記があるか
    issues_2 = []
    for r in recs:
        if not r.get("voice_support"):
            reason_long = r.get("recommendation_reason_long", "")
            if "音声通話" not in reason_long and "データ通信専用" not in reason_long:
                issues_2.append(f"rank={r['rank']} {r['plan_name']}: データ専用だが reason_long に音声不可注記がない")
            if "データ専用" not in r.get("tags", []):
                issues_2.append(f"rank={r['rank']} {r['plan_name']}: データ専用だが tags にデータ専用がない")
    checks.append({"check": "B2_data_only_noted", "desc": "データ専用に音声通話不可の明記があるか", "result": "FAIL" if issues_2 else "PASS", "issues": issues_2})

    # 3. caution_note が必要な候補にだけ出ているか
    issues_3 = []
    for r in recs:
        carrier = r["carrier_name"]
        plan = r["plan_name"]
        full_rec = next((x for x in records if x["carrier_name"] == carrier and x["plan_name"] == plan), None)
        if full_rec:
            stacking = full_rec.get("official_campaign_stackability_status")
            conf = full_rec.get("merge_confidence")
            has_flags = bool(full_rec.get("unresolved_flags"))
            needs_caution = stacking == "unknown" or conf == "low" or has_flags
            if needs_caution and not r.get("caution_note"):
                issues_3.append(f"rank={r['rank']} {carrier}: caution_note が必要だが空")
    checks.append({"check": "B3_caution_appropriate", "desc": "caution_note が必要な候補にだけ出ているか", "result": "FAIL" if issues_3 else "PASS", "issues": issues_3})

    # 4. reason_short / long が実データと整合しているか
    issues_4 = []
    for r in recs:
        monthly = r.get("monthly_price_tax_included", 0)
        reason_short = r.get("recommendation_reason_short", "")
        reason_long = r.get("recommendation_reason_long", "")
        if f"{monthly:,}円" not in reason_short and f"{monthly:,}円" not in reason_long:
            issues_4.append(f"rank={r['rank']} {r['carrier_name']}: 月額{monthly}円が理由文に不在")
        ps_name = r.get("best_point_site_name")
        ps_yen = r.get("best_point_site_reward_yen")
        if ps_name and ps_yen and ps_yen > 0:
            if ps_name not in reason_long:
                issues_4.append(f"rank={r['rank']}: PS {ps_name} が reason_long に不在")
    checks.append({"check": "B4_reason_consistency", "desc": "理由文が実データと整合しているか", "result": "FAIL" if issues_4 else "PASS", "issues": issues_4})

    # 5. found_no_points を還元ありのように見せていないか
    issues_5 = []
    for r in recs:
        ps_display = r.get("point_site_display", "")
        if not r.get("best_point_site_reward_yen"):
            if "円相当" in ps_display and "還元なし" not in ps_display:
                issues_5.append(f"rank={r['rank']}: PS還元なしだが表示が還元ありに見える")
    checks.append({"check": "B5_no_false_ps_reward", "desc": "found_no_points を還元ありのように見せていないか", "result": "FAIL" if issues_5 else "PASS", "issues": issues_5})

    # 6. low confidence 候補に適切な注意があるか
    issues_6 = []
    for r in recs:
        if r.get("confidence_label") == "low":
            if "要確認あり" not in r.get("tags", []):
                issues_6.append(f"rank={r['rank']}: low confidence だが tags に要確認あり がない")
            if "信頼度" not in r.get("cost_comment", "") and "信頼度" not in r.get("caution_note", ""):
                issues_6.append(f"rank={r['rank']}: low confidence だが注意文言がない")
    checks.append({"check": "B6_low_confidence_noted", "desc": "low confidence 候補に適切な注意があるか", "result": "FAIL" if issues_6 else "PASS", "issues": issues_6})

    # 7. そのままUI接続できるか
    issues_7 = []
    if output.get("status") != "ok":
        issues_7.append("status が ok でない")
    if not output.get("data_updated_at"):
        issues_7.append("data_updated_at が空")
    for r in recs:
        if not r.get("headline"):
            issues_7.append(f"rank={r.get('rank')}: headline が空")
        if not r.get("recommendation_reason_short"):
            issues_7.append(f"rank={r.get('rank')}: reason_short が空")
        if not r.get("recommendation_reason_long"):
            issues_7.append(f"rank={r.get('rank')}: reason_long が空")
    checks.append({"check": "B7_ui_ready", "desc": "そのままUI接続できるか", "result": "FAIL" if issues_7 else "PASS", "issues": issues_7})

    overall = "PASS"
    for c in checks:
        if c["result"] == "FAIL":
            overall = "FAIL"
            break

    return {
        "audit_date": str(date.today()),
        "overall_result": overall,
        "total_checks": len(checks),
        "checks": checks,
    }


# ---------------------------------------------------------------------------
# Markdown出力
# ---------------------------------------------------------------------------

def output_to_markdown(output: dict) -> str:
    lines = []
    lines.append("# 推薦結果（UI表示用）\n")
    lines.append(f"> 生成日: {output['generated_at']} | データ更新日: {output['data_updated_at']} | 評価対象: {output['total_candidates']}プラン\n")

    for r in output["recommendations"]:
        lines.append(f"## {r['rank']}位: {r['carrier_name']} {r['plan_name']}\n")
        lines.append(f"**{r['headline']}**\n")
        lines.append(f"| 項目 | 値 |")
        lines.append(f"|:-----|:---|")
        lines.append(f"| 通常月額（税込） | {r['monthly_price_tax_included']:,}円 |")
        lines.append(f"| データ容量 | {r['data_capacity_display']} |")
        lines.append(f"| 初年度実質月額 | {r['effective_monthly_cost_yen']:,}円 |")
        lines.append(f"| 実質初年度コスト | {r['effective_first_year_cost_yen']:,}円 |")
        lines.append(f"| ポイントサイト | {r['point_site_display']} |")
        cp = r.get("best_official_campaign_title") or "―"
        lines.append(f"| 公式キャンペーン | {cp} |")
        lines.append(f"| 音声通話 | {'対応' if r['voice_support'] else '非対応（データ専用）'} |")
        esim = r.get("esim_available")
        lines.append(f"| eSIM | {'対応' if esim is True else '非対応' if esim is False else '不明'} |")
        lines.append(f"| 信頼度 | {r['confidence_label']} |")
        lines.append(f"| タグ | {', '.join(r['tags'])} |")
        lines.append("")
        lines.append(f"**一言:** {r['recommendation_reason_short']}")
        lines.append("")
        lines.append(f"**詳しく:** {r['recommendation_reason_long']}")
        lines.append("")
        if r.get("caution_note"):
            lines.append(f"**要確認:** {r['caution_note']}")
            lines.append("")
        if r.get("wifi_comment"):
            lines.append(f"**Wi-Fi:** {r['wifi_comment']}")
            lines.append("")
        if r.get("cost_comment"):
            lines.append(f"**コスト補足:** {r['cost_comment']}")
            lines.append("")

    return "\n".join(lines)


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

SAMPLE_SCENARIOS = [
    {
        "name": "シナリオ1: light + 速度重視 + 楽天系",
        "answers": {
            "q1": "大手キャリア本体",
            "q2": "わからない",
            "q3": "連絡、地図、たまの検索くらい（〜3GBくらい）",
            "q4": "3500-5000",
            "q5": "短い電話がたまにある",
            "q6": "〜3GBくらい",
            "q7": "できれば避けたい",
            "q8": "はい",
            "q9": ["使えなさそう"],
            "q10": ["楽天カードや楽天サービスをよく使う"],
        },
    },
    {
        "name": "シナリオ2: standard + MVNO OK + PayPay系",
        "answers": {
            "q1": "大手系サブブランド",
            "q2": "だいたいわかる",
            "q3": "SNSやネットをよく見る（〜10GBくらい）",
            "q4": "5000-7000",
            "q5": "5分かけ放題があると安心",
            "q6": "〜10GBくらい",
            "q7": "少し遅くなるくらいなら大丈夫",
            "q8": "はい",
            "q9": ["家族がすでに同じ会社を使っている"],
            "q10": ["PayPayやYahoo!サービスをよく使う"],
        },
    },
    {
        "name": "シナリオ3: moderate + 安さ最優先 + U-NEXT系",
        "answers": {
            "q1": "大手系サブブランド",
            "q2": "わからない",
            "q3": "動画をたまに見る（20GB前後）",
            "q4": "7000以上",
            "q5": "ほとんどしない",
            "q6": "20GB前後",
            "q7": "安くなるなら気にしない",
            "q8": "はい",
            "q9": ["家のネットをすでに使っている"],
            "q10": ["U-NEXTを使っている"],
        },
    },
]

if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser()
    parser.add_argument("--scenario", type=int, default=0, help="シナリオ番号 (1-indexed, 0=全実行)")
    args = parser.parse_args()

    records = load_integrated_data()

    if args.scenario == 0:
        for sc in SAMPLE_SCENARIOS:
            print(f"\n{'='*60}\n{sc['name']}\n{'='*60}")
            output = adapt(sc["answers"], records)
            print(output_to_markdown(output))
            audit = audit_ui_output(output, records)
            print(f"\n監査: {audit['overall_result']}")
            for c in audit["checks"]:
                print(f"  {c['check']}: {c['result']}")
    else:
        idx = args.scenario - 1
        if 0 <= idx < len(SAMPLE_SCENARIOS):
            sc = SAMPLE_SCENARIOS[idx]
            print(f"=== {sc['name']} ===")
            output = adapt(sc["answers"], records)
            print(output_to_markdown(output))
