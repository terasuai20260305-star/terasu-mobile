#!/usr/bin/env python3
"""
推薦ロジック本体
統合済みキャリア比較データから、ユーザー回答に基づいて最適プランを推薦する。
UI接続を前提としたモジュール構成。
Q1-Q10 対応版（v3）
"""

import json
import sys
import math
from pathlib import Path
from datetime import date

# ---------------------------------------------------------------------------
# パス
# ---------------------------------------------------------------------------
BASE_DIR = Path(__file__).resolve().parent.parent
INTEGRATED_PATH = BASE_DIR / "data" / "integrated" / "carrier-plan-integrated.json"
OUTPUT_DIR = BASE_DIR / "data" / "recommender"

# ---------------------------------------------------------------------------
# 定数: usage_band → GB帯マッピング（市場感に近い区分）
# ---------------------------------------------------------------------------
USAGE_BAND_GB = {
    "light":     {"ideal": 3,   "min": 0,   "max": 5},
    "standard":  {"ideal": 10,  "min": 3,   "max": 15},
    "moderate":  {"ideal": 20,  "min": 10,  "max": 25},
    "heavy":     {"ideal": 30,  "min": 20,  "max": 50},
    "unlimited": {"ideal": 999, "min": 30,  "max": 9999},
}

# ---------------------------------------------------------------------------
# 定数: キャリア → グループ
# ---------------------------------------------------------------------------
CARRIER_GROUP = {
    "ドコモ":           "mno_main",
    "au":               "mno_main",
    "ソフトバンク":     "mno_main",
    "ahamo":            "sub_brand",
    "UQ mobile":        "sub_brand",
    "povo2.0":          "sub_brand",
    "Y!mobile":         "sub_brand",
    "LINEMO":           "sub_brand",
    "楽天モバイル":     "sub_brand",
    "IIJmio":           "mvno",
    "mineo":            "mvno",
    "NUROモバイル":     "mvno",
    "BIGLOBEモバイル":  "mvno",
    "イオンモバイル":   "mvno",
    "J:COM MOBILE":     "mvno",
    "HISモバイル":      "mvno",
    "LIBMO":            "mvno",
    "y.u mobile":       "mvno",
    "QTmobile":         "mvno",
    "日本通信SIM":      "mvno",
    "U-NEXT MOBILE":    "mvno",
    "BB.exciteモバイル": "mvno",
}

# ---------------------------------------------------------------------------
# 定数: ecosystem → 加点キャリア
# ---------------------------------------------------------------------------
ECOSYSTEM_CARRIER_BONUS = {
    "rakuten":      ["楽天モバイル"],
    "paypay_yahoo": ["Y!mobile", "LINEMO"],
    "olive":        [],  # 補助的—直接キャリア加点なし
    "u_next":       ["U-NEXT MOBILE", "y.u mobile"],
    "aeon":         ["イオンモバイル"],
    "jcom":         ["J:COM MOBILE"],
    "kyushu_bbiq":  ["QTmobile"],
}

# ---------------------------------------------------------------------------
# スコアリング重み
# ---------------------------------------------------------------------------
W = {
    "cost":             0.40,
    "usage_fit":        0.20,
    "daytime_speed":    0.10,
    "ecosystem":        0.08,
    "call_option":      0.06,
    "discount":         0.05,
    "confidence":       0.04,
    "mnp_bonus":        0.04,
    "wifi_adjust":      0.03,
}
ECOSYSTEM_CAP = 12.0  # 経済圏加点の上限 (100点満点中)

# ---------------------------------------------------------------------------
# データ専用プラン判定 / 低速unlimited判定
# ---------------------------------------------------------------------------
DATA_ONLY_KEYWORDS = ["データ専用", "データタイプ", "シングルタイプ", "データコース", "データ定額"]
LOW_SPEED_KEYWORDS = ["最大200kbps", "最大300kbps", "最大32kbps", "低速無制限", "低速通信"]
LOW_SPEED_PLAN_NAMES = ["マイそく スーパーライト", "マイそく ライト"]

# ---------------------------------------------------------------------------
# キャンペーンタイプ分類: 実質月額に含めるか
# ---------------------------------------------------------------------------
CAMPAIGN_CASH_EQUIVALENT_TYPES = {"cashback", "point", "monthly_discount", "fee_waiver"}
CAMPAIGN_NON_CASH_TYPES = {"device_discount", "other", "free_months"}


def _is_data_only(rec: dict) -> bool:
    """音声通話不可のデータ専用プランか"""
    name = rec.get("plan_name", "")
    for kw in DATA_ONLY_KEYWORDS:
        if kw in name:
            return True
    voice = rec.get("voice_basic_condition", "") or ""
    if any(w in voice for w in ["通話不可", "音声通話なし", "データ通信のみ", "データ専用"]):
        return True
    return False


def _is_low_speed_unlimited(rec: dict) -> bool:
    """低速unlimited（200-300kbps制限付き無制限）か"""
    if not rec.get("unlimited_flag"):
        return False
    notes = rec.get("notes", "") or ""
    name = rec.get("plan_name", "")
    for kw in LOW_SPEED_KEYWORDS:
        if kw in notes:
            return True
    for pn in LOW_SPEED_PLAN_NAMES:
        if pn in name:
            return True
    return False


def _is_cash_equivalent_campaign(campaign: dict) -> bool:
    """キャンペーンの特典が現金同等（実質月額計算に含める）か判定"""
    ctype = campaign.get("type") or ""
    if ctype in CAMPAIGN_CASH_EQUIVALENT_TYPES:
        return True
    if ctype in CAMPAIGN_NON_CASH_TYPES:
        return False
    # type が None or unknown: reward_raw テキストから推定
    raw = str(campaign.get("reward_raw") or "")
    # 現金同等の指標
    cash_indicators = ["キャッシュバック", "ポイント", "割引", "手数料無料", "値引き", "還元"]
    if any(kw in raw for kw in cash_indicators):
        return True
    # 非金銭の指標
    non_cash_indicators = ["端末", "機種", "ディズニー", "Netflix", "エンタメ",
                           "旅行", "クーポン", "データ増量", "無料体験"]
    if any(kw in raw for kw in non_cash_indicators):
        return False
    return False  # 不明な場合は含めない


def _extract_speed_limit(rec: dict) -> str:
    """低速プランの速度上限を抽出（例: '300kbps'）"""
    import re
    notes = rec.get("notes", "") or ""
    m = re.search(r"最大(\d+kbps)", notes)
    if m:
        return m.group(1)
    name = rec.get("plan_name", "")
    if "ライト" in name:
        return "300kbps"
    if "スーパーライト" in name:
        return "32kbps"
    return "低速"


# ---------------------------------------------------------------------------
# 特徴量変換 (Q1-Q10 対応)
# ---------------------------------------------------------------------------

# Q6: これから使いたい量 → usage_band（推薦の主ドライバー）
QUESTION_TO_DESIRED_USAGE = {
    "〜3GBくらい":    "light",
    "〜10GBくらい":   "standard",
    "20GB前後":       "moderate",
    "30GB前後":       "heavy",
    "無制限向け":     "unlimited",
    "わからない":     "standard",  # 不明時は10GB帯（中間値）をデフォルトに
}

# Q3: 今の使い方 → current_usage_band（現在プラン推定用）
QUESTION_TO_CURRENT_USAGE = {
    "連絡、地図、たまの検索くらい（〜3GBくらい）":       "light",
    "SNSやネットをよく見る（〜10GBくらい）":              "standard",
    "動画をたまに見る（20GB前後）":                       "moderate",
    "動画やSNSをかなり使う（30GB前後）":                  "heavy",
    "容量を気にせず使いたい（無制限向け）":               "unlimited",
    "わからない":                                         "unknown",
    # 旧互換 (Q1形式)
    "連絡、地図、たまの検索くらい":                       "light",
    "SNSやネットをよく見る":                              "standard",
    "動画はたまに見る":                                    "moderate",
    "動画やSNSをかなり使う":                              "heavy",
    "容量を気にせず使いたい":                             "unlimited",
    "連絡・地図・たまの検索くらい":                       "light",
    "外でも動画をよく見る":                               "heavy",
    "容量を気にせずかなり使う":                           "unlimited",
    "動画をよく見る":                                      "heavy",
}

QUESTION_TO_DAYTIME_SPEED = {
    "できれば避けたい":                   "prefer_fast",
    "少し遅くなるくらいなら大丈夫":       "tolerate_slight",
    "安くなるなら気にしない":             "tolerate_any",
    "わからない":                          "unknown",
    # 旧互換
    "かなり安くなるなら気にしない":        "tolerate_any",
    "よくわからない":                      "unknown",
}

QUESTION_TO_GROUP = {
    # 新形式（Q1）
    "大手キャリア本体":                             "mno_main",
    "大手系サブブランド":                           "sub_brand",
    "格安SIM":                                      "mvno",
    "わからない":                                   "unknown",
    # 旧形式互換
    "ドコモ系":                                     "mno_main",
    "au / UQ / povo系":                              "sub_brand",
    "ソフトバンク / ワイモバイル / LINEMO系":         "sub_brand",
    "楽天モバイル":                                   "sub_brand",
}

QUESTION_TO_BILL_BAND = {
    # 新形式（Q4）
    "2000未満":     "under_2000",
    "2000-3500":    "2000_3500",
    "3500-5000":    "3500_5000",
    "5000-7000":    "5000_7000",
    "7000以上":     "over_7000",
    "わからない":   "unknown",
    # 旧形式互換
    "1000未満":     "under_2000",
    "1000-2000":    "under_2000",
    "2000-3000":    "2000_3500",
    "3000-5000":    "3500_5000",
}

QUESTION_TO_CALL = {
    # 新形式（Q5）
    "ほとんどしない":                "none",
    "短い電話がたまにある":          "occasional",
    "5分かけ放題があると安心":       "kakeho_5",
    "10分かけ放題がほしい":          "kakeho_10",
    "かけ放題がほしい":              "kakeho_full",
    "わからない":                    "unknown",
    # 旧互換
    "たまに短い電話":                "occasional",
    "5分かけ放題":                   "kakeho_5",
    "10分かけ放題":                  "kakeho_10",
    "完全かけ放題":                  "kakeho_full",
    "よくわからない":                "unknown",
}

QUESTION_TO_MNP = {
    "はい":             True,
    "どちらでもいい":   False,
    "わからない":       None,
    "よくわからない":   None,
}

# 新形式: 家族割・セット割（すでに使っている/まとめられそう の区別）
QUESTION_TO_DISCOUNT = {
    "家族がすでに同じ会社を使っている":   ("family", "active"),
    "家族で同じ会社にまとめられそう":     ("family", "potential"),
    "家のネットをすでに使っている":       ("net_bundle", "active"),
    "家のネットをまとめられそう":         ("net_bundle", "potential"),
    "電気などをすでに使っている":         ("electricity", "active"),
    "電気などをまとめられそう":           ("electricity", "potential"),
    "使えなさそう":                       None,
    "わからない":                         None,
    # 旧互換
    "家族割":                             ("family", "potential"),
    "ネットセット割":                     ("net_bundle", "potential"),
    "電気セット割":                       ("electricity", "potential"),
    "なし":                               None,
}

QUESTION_TO_ECOSYSTEM = {
    "楽天カードや楽天サービスをよく使う":           "rakuten",
    "PayPayやYahoo!サービスをよく使う":             "paypay_yahoo",
    "三井住友カード / Olive を使っている":          "olive",
    "U-NEXTを使っている":                          "u_next",
    "イオンカードやWAONをよく使う":                 "aeon",
    "J:COMのサービスを使っている":                  "jcom",
    "九州電力やBBIQを使っている":                   "kyushu_bbiq",
    "特にない":                                     None,
}

QUESTION_TO_WIFI = {
    "はい":       True,
    "いいえ":     False,
    "わからない": None,
}

QUESTION_TO_PLAN_KNOWN = {
    "わかる":         "known",
    "だいたいわかる": "roughly",
    "わからない":     "unknown",
}

# ---------------------------------------------------------------------------
# キャリア速度ティア（昼間速度スコア用）
# ---------------------------------------------------------------------------
CARRIER_SPEED_TIER = {
    "ドコモ":           "mno",
    "ahamo":            "mno",
    "au":               "mno",
    "UQ mobile":        "sub_brand",
    "povo2.0":          "mno",
    "ソフトバンク":     "mno",
    "Y!mobile":         "sub_brand",
    "LINEMO":           "sub_brand",
    "楽天モバイル":     "mno",
    "IIJmio":           "mvno",
    "mineo":            "mvno",
    "NUROモバイル":     "mvno",
    "BIGLOBEモバイル":  "mvno",
    "イオンモバイル":   "mvno",
    "J:COM MOBILE":     "mvno",
    "HISモバイル":      "mvno",
    "LIBMO":            "mvno",
    "y.u mobile":       "mvno",
    "QTmobile":         "mvno",
    "日本通信SIM":      "mvno",
    "U-NEXT MOBILE":    "mvno",
    "BB.exciteモバイル": "mvno",
}

# ---------------------------------------------------------------------------
# 家族割・セット割対応キャリア
# ---------------------------------------------------------------------------
DISCOUNT_CARRIER_MAP = {
    "family": ["ドコモ", "au", "UQ mobile", "ソフトバンク", "Y!mobile", "楽天モバイル"],
    "net_bundle": ["ドコモ", "au", "UQ mobile", "ソフトバンク", "Y!mobile", "J:COM MOBILE"],
    "electricity": ["au", "UQ mobile", "ソフトバンク", "楽天モバイル"],
}

# ---------------------------------------------------------------------------
# 光回線 → 適用可能な光セット割マッピング（スコアには含めない・別枠表示用）
# Q11回答値: docomo_hikari / softbank_hikari / au_hikari / jcom / bb_excite_hikari / other / none
# ---------------------------------------------------------------------------
BUNDLE_DISCOUNT_CATALOG = {
    "docomo_hikari_wari_1210": {
        "label": "ドコモ光セット割",
        "monthly_amount": 1210,
        "carriers": ["ドコモ"],
        "note": "別途ドコモ光の契約が必要・家族回線数に応じて適用",
    },
    "sb_ouchiwari_1100": {
        "label": "おうち割 光セット",
        "monthly_amount": 1100,
        "carriers": ["ソフトバンク"],
        "note": "別途SoftBank 光 / SoftBank Airの契約が必要",
    },
    "uq_jitaku_set_1100": {
        "label": "自宅セット割（インターネット）",
        "monthly_amount": 1100,
        "carriers": ["UQ mobile"],
        "note": "別途対象の光回線等の契約が必要",
    },
    "ymobile_jitaku_1188": {
        "label": "おうち割 光セット（A）",
        "monthly_amount": 1188,
        "carriers": ["Y!mobile"],
        "note": "別途SoftBank 光 / SoftBank Airの契約が必要",
    },
    "au_smart_value_1100": {
        "label": "auスマートバリュー",
        "monthly_amount": 1100,
        "carriers": ["au"],
        "note": "別途auひかり等の対象固定回線の契約が必要",
    },
    "bb_excite_set_220": {
        "label": "BB.excite家族まるごとセット割",
        "monthly_amount": 220,
        "carriers": ["BB.exciteモバイル"],
        "note": "別途BB.excite光 Fitの契約が必要",
    },
}

FIBER_TO_BUNDLE_IDS = {
    "docomo_hikari":    ["docomo_hikari_wari_1210"],
    "softbank_hikari":  ["sb_ouchiwari_1100", "uq_jitaku_set_1100", "ymobile_jitaku_1188"],
    "au_hikari":        ["au_smart_value_1100", "uq_jitaku_set_1100"],
    "jcom":             ["au_smart_value_1100", "uq_jitaku_set_1100"],
    "bb_excite_hikari": ["bb_excite_set_220"],
    "other":            [],
    "none":             [],
}


def _detect_applicable_bundles(rec: dict, fiber_provider: str) -> list:
    """プランに適用可能なセット割（光回線）を返す。
    スコアには含めず、別枠表示用。"""
    if not fiber_provider:
        return []
    bundle_ids = FIBER_TO_BUNDLE_IDS.get(fiber_provider, [])
    if not bundle_ids:
        return []
    carrier = rec.get("carrier_name", "")
    result = []
    for bid in bundle_ids:
        entry = BUNDLE_DISCOUNT_CATALOG.get(bid)
        if not entry:
            continue
        if carrier in entry["carriers"]:
            result.append({
                "discount_id": bid,
                "label": entry["label"],
                "monthly_amount": entry["monthly_amount"],
                "note": entry["note"],
            })
    return result


def convert_answers(raw: dict) -> dict:
    """質問回答 (Q1-Q10) → 特徴量"""
    # Q10: 経済圏（複数選択）— 旧Q8/Q4 互換
    eco_raw = raw.get("q10", raw.get("q8", raw.get("q4", [])))
    if isinstance(eco_raw, str):
        eco_raw = [eco_raw]
    ecosystems = []
    for ans in eco_raw:
        mapped = QUESTION_TO_ECOSYSTEM.get(ans)
        if mapped:
            ecosystems.append(mapped)

    # Wi-Fi — 旧Q9/Q5 互換。新設計では削除（常にNone）
    wifi_raw = raw.get("q_wifi", raw.get("q9", ""))
    # 新設計ではQ9は割引質問なので、文字列 "はい"/"いいえ" でなければWi-Fi不明
    wifi_val = None
    if wifi_raw in ("はい", "いいえ", "わからない"):
        # 旧形式互換チェック: Q9がリスト（新設計の割引）ならWi-Fi不明
        if not isinstance(raw.get("q9"), list):
            wifi_val = QUESTION_TO_WIFI.get(wifi_raw, None)

    # Q8: MNP（旧Q6/Q2互換）
    mnp_raw = raw.get("q8", raw.get("q6", raw.get("q2", "")))
    # 新設計ではQ8は文字列 "はい"/"どちらでもいい"/"わからない"
    # ただし旧形式でQ8がリスト（経済圏）の場合は旧形式
    if isinstance(mnp_raw, list):
        mnp_raw = raw.get("q6", raw.get("q2", ""))
    mnp_val = QUESTION_TO_MNP.get(mnp_raw, None)

    # Q9: 割引（複数選択）— 旧Q7互換
    discount_raw = raw.get("q9", raw.get("q7", []))
    if isinstance(discount_raw, str):
        discount_raw = [discount_raw]
    discounts = []
    for ans in discount_raw:
        mapped = QUESTION_TO_DISCOUNT.get(ans)
        if mapped:
            if isinstance(mapped, tuple):
                discounts.append({"type": mapped[0], "status": mapped[1]})
            else:
                discounts.append({"type": mapped, "status": "potential"})

    # Q6: これから使いたい量 → usage_band（主ドライバー）
    # 旧互換: Q1が旧形式の場合は QUESTION_TO_CURRENT_USAGE にフォールバック
    desired_raw = raw.get("q6", "")
    usage_band = QUESTION_TO_DESIRED_USAGE.get(desired_raw)
    if usage_band is None:
        # 旧形式: Q1が使い方質問だった場合のフォールバック
        usage_band = QUESTION_TO_CURRENT_USAGE.get(raw.get("q1", ""), "standard")

    # Q3: 今の使い方（現在プラン推定用）
    current_usage_raw = raw.get("q3", "")
    current_usage = QUESTION_TO_CURRENT_USAGE.get(current_usage_raw, "unknown")

    # Q2: プラン名わかる？
    plan_known = QUESTION_TO_PLAN_KNOWN.get(raw.get("q2", ""), "unknown")

    # Q1: 今のキャリア → current_group
    # 旧互換: Q3が旧形式のキャリア質問だった場合
    group_raw = raw.get("q1", "")
    current_group = QUESTION_TO_GROUP.get(group_raw)
    if current_group is None:
        current_group = QUESTION_TO_GROUP.get(raw.get("q3", ""), "unknown")

    # Q7: 昼間速度許容 — 旧Q2互換
    speed_raw = raw.get("q7", raw.get("q2", ""))
    # Q7が "はい"/"どちらでもいい" なら旧Q2(MNP)形式の可能性 → 旧Q2のspeed値を使う
    daytime = QUESTION_TO_DAYTIME_SPEED.get(speed_raw, "unknown")

    # Q11: 光回線の種別（任意・Q9でnet_bundleを選んだときのみ）
    fiber_raw = raw.get("q11", "")
    fiber_provider = fiber_raw if fiber_raw in FIBER_TO_BUNDLE_IDS else ""

    return {
        "usage_band":                   usage_band,
        "current_usage_band":           current_usage,
        "plan_known":                   plan_known,
        "daytime_speed_tolerance":      daytime,
        "current_group":                current_group,
        "current_monthly_bill_band":    QUESTION_TO_BILL_BAND.get(raw.get("q4", ""), "unknown"),
        "call_option_need":             QUESTION_TO_CALL.get(raw.get("q5", ""), "unknown"),
        "mnp_required":                 mnp_val,
        "discount_eligibility":         discounts,
        "ecosystem_memberships":        ecosystems,
        "wifi_home":                    wifi_val,
        "fiber_provider":               fiber_provider,
    }


# ---------------------------------------------------------------------------
# スコア計算
# ---------------------------------------------------------------------------

def _plan_gb(rec: dict) -> float:
    """プランの実効GB。unlimited → 999"""
    if rec.get("unlimited_flag"):
        return 999
    gb = rec.get("data_capacity_gb")
    if gb is None:
        return 0
    return float(gb)


def _cost_score(rec: dict, cost_min: float, cost_max: float) -> float:
    """0〜100。安いほど高スコア"""
    cost = rec.get("effective_first_year_cost_yen", 0) or 0
    if cost_max == cost_min:
        return 50.0
    return max(0, min(100, 100 * (1 - (cost - cost_min) / (cost_max - cost_min))))


def _usage_fit_score(rec: dict, band: str) -> float:
    """usage_band とプランGBの適合度 (0〜100)
    容量ミスマッチには厳しいペナルティを与え、
    安いだけで容量が合わない候補が上位に来ないようにする。
    市場感帯域: 3GB / 10GB / 20GB / 30GB / 無制限
    """
    gb = _plan_gb(rec)
    cfg = USAGE_BAND_GB[band]
    ideal = cfg["ideal"]
    is_low_speed = _is_low_speed_unlimited(rec)

    if band == "unlimited":
        if rec.get("unlimited_flag"):
            if is_low_speed:
                return 5.0   # 低速200-300kbps系は unlimited 向けとして強く不適切
            return 100.0
        if gb >= 30:
            return 65.0
        if gb >= 20:
            return 30.0
        # 20GB未満は unlimited ユーザーに著しく不足
        return max(0, gb * 0.8)

    if band == "heavy":   # 30GB前後
        if is_low_speed:
            return 5.0
        if gb <= 5:
            return 0.0
        if gb <= 10:
            return 10.0
        if gb <= 15:
            return 25.0

    if band == "moderate":  # 20GB前後
        if is_low_speed:
            return 10.0
        if gb <= 3:
            return 5.0
        if gb <= 5:
            return 15.0
        if gb <= 10:
            return 30.0

    if band == "standard":  # ~10GB
        if is_low_speed:
            return 15.0
        if gb <= 1:
            return 5.0

    if band == "light":  # ~3GB
        if is_low_speed:
            return 50.0

    if cfg["min"] <= gb <= cfg["max"]:
        dist = abs(gb - ideal)
        span = cfg["max"] - cfg["min"]
        return max(20, 100 - (dist / max(span, 1)) * 60)

    if gb < cfg["min"]:
        shortfall = cfg["min"] - gb
        return max(0, 30 - shortfall * 8)  # 不足はより厳しく
    # over
    overshoot = gb - cfg["max"]
    return max(0, 55 - overshoot * 2)


def _ecosystem_score(rec: dict, ecosystems: list) -> float:
    """経済圏適合 (0〜ECOSYSTEM_CAP)"""
    if not ecosystems:
        return 0.0
    carrier = rec.get("carrier_name", "")
    score = 0.0
    per_eco = min(ECOSYSTEM_CAP / max(len(ecosystems), 1), 8.0)  # 1エコシステムあたり最大8pt

    for eco in ecosystems:
        bonus_carriers = ECOSYSTEM_CARRIER_BONUS.get(eco, [])
        if carrier in bonus_carriers:
            score += per_eco
        elif eco == "olive":
            # olive は補助的: 全キャリアに微加点ではなく、加点なし
            pass

    return min(score, ECOSYSTEM_CAP)


def _confidence_score(rec: dict) -> float:
    """信頼度 (0〜100)"""
    conf = rec.get("merge_confidence", "medium")
    mapping = {"high": 100, "medium": 70, "low": 30, "insufficient": 10}
    base = mapping.get(conf, 50)

    # stacking unknown が含まれる potential ベースの安さは減点
    if rec.get("official_campaign_stackability_status") == "unknown":
        base = min(base, 60)

    return float(base)


def _mnp_score(rec: dict, mnp_required) -> float:
    """MNP加点 (0〜100)"""
    if mnp_required is None:
        return 50.0  # 不明 → 中立

    campaigns = rec.get("official_campaigns", [])
    has_mnp_campaign = any(
        c.get("applies_to") and "MNP" in str(c.get("applies_to", ""))
        for c in campaigns
    )
    best_yen = rec.get("best_official_reward_value_yen_normalized") or 0

    if mnp_required:
        if has_mnp_campaign and best_yen > 0:
            return min(100, 50 + best_yen / 500)
        if has_mnp_campaign:
            return 60
        return 30
    else:
        return 50.0


def _wifi_adjust(rec: dict, wifi_home) -> float:
    """Wi-Fi有無による調整 (0〜100)"""
    if wifi_home is None:
        return 50.0

    gb = _plan_gb(rec)
    is_unlimited = rec.get("unlimited_flag", False)

    if wifi_home:
        # 家にWi-Fiあり → 超大容量の優先度をやや下げる
        if is_unlimited:
            return 35.0
        if gb >= 30:
            return 40.0
        return 60.0
    else:
        # Wi-Fiなし → 大容量をやや優先
        if is_unlimited:
            return 70.0
        if gb >= 20:
            return 65.0
        if gb <= 3:
            return 35.0
        return 50.0


def _daytime_speed_score(rec: dict, tolerance: str) -> float:
    """昼間速度スコア (0〜100)。MVNOは昼間遅くなりがち。"""
    carrier = rec.get("carrier_name", "")
    tier = CARRIER_SPEED_TIER.get(carrier, "mvno")

    if tolerance == "unknown":
        return 50.0

    if tolerance == "prefer_fast":
        # MNO/sub_brand を優遇、MVNO を大きく減点
        if tier == "mno":
            return 100.0
        if tier == "sub_brand":
            return 85.0
        return 20.0  # MVNO

    if tolerance == "tolerate_slight":
        # sub_brand まで OK
        if tier == "mno":
            return 90.0
        if tier == "sub_brand":
            return 80.0
        return 45.0  # MVNO

    if tolerance == "tolerate_any":
        # 全部 OK、MVNO でもペナルティ小さい
        if tier == "mno":
            return 70.0
        if tier == "sub_brand":
            return 70.0
        return 65.0  # MVNO

    return 50.0


def _call_option_score(rec: dict, call_need: str) -> float:
    """通話オプションスコア (0〜100)。
    voice_basic_conditionのテキストから通話定額の有無を推定。
    """
    if call_need == "unknown" or call_need == "none":
        return 50.0  # 中立

    voice_text = (rec.get("voice_basic_condition") or "").lower()
    plan_name = rec.get("plan_name", "")

    # かけ放題が含まれるか推定
    has_5min = any(kw in voice_text for kw in ["5分", "5分間", "5分以内"])
    has_10min = any(kw in voice_text for kw in ["10分", "10分間", "10分以内"])
    has_full = any(kw in voice_text for kw in ["かけ放題", "通話し放題", "完全定額"])
    has_option = any(kw in voice_text for kw in ["オプション", "月額"])

    # データ専用は通話不可
    if _is_data_only(rec):
        if call_need in ("kakeho_5", "kakeho_10", "kakeho_full"):
            return 0.0
        return 30.0

    if call_need == "occasional":
        # 短い電話がたまに → 基本料金に通話料含む程度で十分
        return 60.0

    if call_need == "kakeho_5":
        if has_5min:
            return 90.0 if not has_option else 75.0  # 標準で含む vs オプション
        if has_10min or has_full:
            return 70.0
        return 40.0

    if call_need == "kakeho_10":
        if has_10min:
            return 90.0 if not has_option else 75.0
        if has_full:
            return 70.0
        if has_5min:
            return 50.0
        return 35.0

    if call_need == "kakeho_full":
        if has_full and "かけ放題" in voice_text:
            return 90.0
        if has_full:
            return 70.0
        return 30.0

    return 50.0


def _discount_score(rec: dict, discounts: list) -> float:
    """家族割・セット割スコア (0〜100)
    discounts: [{"type": "family", "status": "active"}, ...]
    "active"（すでに使っている）は "potential"（まとめられそう）より高スコア
    """
    if not discounts:
        return 50.0  # 中立

    carrier = rec.get("carrier_name", "")
    score = 0.0
    total_weight = 0.0

    for d in discounts:
        if isinstance(d, dict):
            dtype = d.get("type", "")
            status = d.get("status", "potential")
        else:
            # 旧形式互換（文字列）
            dtype = d
            status = "potential"

        weight = 1.5 if status == "active" else 1.0
        total_weight += weight
        eligible_carriers = DISCOUNT_CARRIER_MAP.get(dtype, [])
        if carrier in eligible_carriers:
            score += weight

    if total_weight == 0:
        return 50.0

    ratio = score / total_weight
    return 30.0 + ratio * 70.0  # 0マッチ=30, 全マッチ=100


def _same_group_penalty(rec: dict, current_group: str) -> float:
    """同系列移動の減点 (0〜-5)"""
    if current_group == "unknown":
        return 0.0
    carrier_grp = CARRIER_GROUP.get(rec.get("carrier_name", ""), "unknown")
    if carrier_grp == current_group:
        return -3.0  # 軽い減点
    return 0.0


def score_plan(rec: dict, features: dict, cost_min: float, cost_max: float) -> dict:
    """1プランのスコア計算"""
    cs = _cost_score(rec, cost_min, cost_max) * W["cost"]
    us = _usage_fit_score(rec, features["usage_band"]) * W["usage_fit"]
    ds = _daytime_speed_score(rec, features.get("daytime_speed_tolerance", "unknown")) * W["daytime_speed"]
    es = _ecosystem_score(rec, features["ecosystem_memberships"]) * W["ecosystem"] * (100 / max(ECOSYSTEM_CAP, 1))
    co = _call_option_score(rec, features.get("call_option_need", "unknown")) * W["call_option"]
    dc = _discount_score(rec, features.get("discount_eligibility", [])) * W["discount"]
    cf = _confidence_score(rec) * W["confidence"]
    ms = _mnp_score(rec, features["mnp_required"]) * W["mnp_bonus"]
    ws = _wifi_adjust(rec, features["wifi_home"]) * W["wifi_adjust"]
    penalty = _same_group_penalty(rec, features["current_group"])

    total = cs + us + ds + es + co + dc + cf + ms + ws + penalty

    return {
        "total": round(total, 2),
        "cost_score": round(cs, 2),
        "usage_fit_score": round(us, 2),
        "daytime_speed_score": round(ds, 2),
        "ecosystem_score": round(es, 2),
        "call_option_score": round(co, 2),
        "discount_score": round(dc, 2),
        "confidence_score": round(cf, 2),
        "mnp_score": round(ms, 2),
        "wifi_score": round(ws, 2),
        "penalty": round(penalty, 2),
    }


# ---------------------------------------------------------------------------
# 理由文生成
# ---------------------------------------------------------------------------

def _build_reason(rec: dict, features: dict, scores: dict) -> str:
    """おすすめ理由を自然文で生成"""
    parts = []
    band = features["usage_band"]
    gb = _plan_gb(rec)
    monthly = rec.get("monthly_price_tax_included", 0)
    effective = rec.get("effective_first_year_cost_yen", 0)
    is_low_speed = _is_low_speed_unlimited(rec)
    is_data = _is_data_only(rec)

    # 容量適合
    band_labels = {
        "light": "〜3GBの使い方",
        "standard": "〜10GBの使い方",
        "moderate": "20GB前後の使い方",
        "heavy": "30GB前後の使い方",
        "unlimited": "容量を気にせず使いたい方",
    }
    label = band_labels.get(band, "")

    if rec.get("unlimited_flag"):
        if is_low_speed:
            speed = _extract_speed_limit(rec)
            parts.append(f"月額を抑えられる低速無制限プラン（最大{speed}）")
        else:
            parts.append(f"{label}に合った高速無制限プラン")
    elif gb > 0:
        parts.append(f"{label}に合った{gb:.0f}GB帯のプラン")
    else:
        parts.append(f"{label}向けの低容量プラン")

    # データ専用注記
    if is_data:
        parts.append("データ通信専用（音声通話には非対応）")

    # コスト
    parts.append(f"2年実質コスト{effective:,.0f}円（月額{monthly:,.0f}円）")

    # 経済圏
    carrier = rec.get("carrier_name", "")
    for eco in features.get("ecosystem_memberships", []):
        bonus_carriers = ECOSYSTEM_CARRIER_BONUS.get(eco, [])
        if carrier in bonus_carriers:
            eco_labels = {
                "rakuten": "楽天系サービス利用中なら相性がよい",
                "paypay_yahoo": "PayPay・Yahoo!サービスとの相性がよい",
                "u_next": "U-NEXT利用中なら相乗効果が出やすい",
                "aeon": "イオン系サービスとの相性がよい",
                "jcom": "J:COM利用中ならセット割の可能性あり",
                "kyushu_bbiq": "九州電力/BBIQ利用中ならセット割の可能性あり",
            }
            if eco in eco_labels:
                parts.append(eco_labels[eco])

    # ポイントサイト還元
    ps_name = rec.get("best_point_site_name")
    ps_yen = rec.get("best_point_site_reward_yen")
    if ps_name and ps_yen and ps_yen > 0:
        parts.append(f"ポイントサイト経由で{ps_yen:,.0f}円相当の還元あり（{ps_name}）")

    # 昼間速度
    tolerance = features.get("daytime_speed_tolerance", "unknown")
    tier = CARRIER_SPEED_TIER.get(rec.get("carrier_name", ""), "mvno")
    if tolerance == "prefer_fast" and tier == "mno":
        parts.append("MNO回線で昼間の速度も安定")
    elif tolerance == "prefer_fast" and tier == "mvno":
        parts.append("格安SIMのため昼間の速度低下に注意")

    return "。".join(parts)


def _build_caution(rec: dict, features: dict) -> str:
    """要確認事項"""
    notes = []

    # stacking unknown — PS有無で文言を分岐
    if rec.get("official_campaign_stackability_status") == "unknown":
        potential = rec.get("total_potential_benefit_yen", 0)
        has_ps = (rec.get("best_point_site_reward_yen") or 0) > 0
        if potential and potential > 0:
            if has_ps:
                notes.append(f"公式キャンペーン（最大{potential:,.0f}円相当）とポイントサイト還元の併用可否は公式サイトで要確認")
            else:
                notes.append(f"公式キャンペーン（最大{potential:,.0f}円相当）の適用条件は公式サイトで要確認")

    # merge_confidence low
    if rec.get("merge_confidence") == "low":
        notes.append("このプランは比較データの信頼度が低めです。公式サイトで最新情報を確認してください")

    # 同系列移動の注意
    current_group = features.get("current_group", "unknown")
    if current_group != "unknown":
        carrier_grp = CARRIER_GROUP.get(rec.get("carrier_name", ""), "unknown")
        if carrier_grp == current_group:
            campaigns = rec.get("official_campaigns", [])
            has_mnp_campaign = any(
                c.get("applies_to") and "MNP" in str(c.get("applies_to", ""))
                for c in campaigns
            )
            if has_mnp_campaign:
                notes.append("同系列間の移動のため、MNP限定キャンペーンが適用されない場合があります")

    # MNP限定キャンペーン（MNP不明の場合）
    mnp_req = features.get("mnp_required")
    campaigns = rec.get("official_campaigns", [])
    mnp_only_campaigns = [c for c in campaigns if c.get("applies_to") and "MNP" in str(c.get("applies_to", "")) and "新規" not in str(c.get("applies_to", ""))]
    if mnp_only_campaigns and mnp_req is None:
        notes.append("一部キャンペーンはMNP（番号そのまま乗り換え）限定です")

    # unresolved_flags
    flags = rec.get("unresolved_flags", [])
    if "stacking_rule_unknown" in flags and not any("併用可否" in n for n in notes) and not any("適用条件" in n for n in notes):
        notes.append("特典の併用ルールが未確認のため、表示コストは参考値です")

    if not notes:
        return ""

    return "。".join(notes)


def _confidence_label(rec: dict) -> str:
    """信頼度ラベル"""
    conf = rec.get("merge_confidence", "medium")
    if conf == "high":
        return "high"
    if conf == "low" or conf == "insufficient":
        return "low"
    # medium だが stacking unknown があれば medium のまま
    return "medium"


# ---------------------------------------------------------------------------
# メインロジック
# ---------------------------------------------------------------------------

def load_integrated_data() -> list:
    with open(INTEGRATED_PATH, "r", encoding="utf-8") as f:
        data = json.load(f)
    return data.get("records", [])


# ---------------------------------------------------------------------------
# 現在月額帯の中央値推定
# ---------------------------------------------------------------------------
BILL_BAND_MIDPOINT = {
    "under_2000":  1000,
    "2000_3500":   2750,
    "3500_5000":   4250,
    "5000_7000":   6000,
    "over_7000":   8500,
    "unknown":     None,
    # 旧互換
    "under_1000":  500,
    "1000_2000":   1500,
    "2000_3000":   2500,
    "3000_5000":   4000,
}


# ---------------------------------------------------------------------------
# 現在プラン推定
# ---------------------------------------------------------------------------
def _estimate_current_plan(features: dict) -> dict:
    """回答から現在のプラン帯を推定する（断定はしない）"""
    group = features.get("current_group", "unknown")
    bill_band = features.get("current_monthly_bill_band", "unknown")
    current_usage = features.get("current_usage_band", "unknown")
    plan_known = features.get("plan_known", "unknown")
    midpoint = BILL_BAND_MIDPOINT.get(bill_band)

    if group == "unknown" and bill_band == "unknown" and current_usage == "unknown":
        return {"estimated": False}

    group_labels = {
        "mno_main": "大手キャリア本体",
        "sub_brand": "大手系サブブランド・楽天",
        "mvno": "格安SIM",
    }

    # GB帯推定: Q3の使い方を優先、なければ月額帯から推測
    estimated_gb = None
    if current_usage != "unknown":
        gb_labels = {
            "light": "〜3GB",
            "standard": "〜10GB",
            "moderate": "20GB前後",
            "heavy": "30GB前後",
            "unlimited": "無制限",
        }
        estimated_gb = gb_labels.get(current_usage)
    elif midpoint is not None:
        if group == "mno_main":
            if midpoint <= 3000:
                estimated_gb = "〜3GB"
            elif midpoint <= 5000:
                estimated_gb = "〜10GB"
            elif midpoint <= 7000:
                estimated_gb = "10〜20GB"
            else:
                estimated_gb = "20GB超/無制限"
        elif group == "sub_brand":
            if midpoint <= 2000:
                estimated_gb = "〜3GB"
            elif midpoint <= 3500:
                estimated_gb = "〜10GB"
            elif midpoint <= 5000:
                estimated_gb = "10〜20GB"
            else:
                estimated_gb = "20GB超/無制限"
        elif group == "mvno":
            if midpoint <= 1500:
                estimated_gb = "〜3GB"
            elif midpoint <= 2500:
                estimated_gb = "〜10GB"
            elif midpoint <= 4000:
                estimated_gb = "10〜20GB"
            else:
                estimated_gb = "20GB超"

    # テキスト生成
    parts = []
    if group != "unknown":
        parts.append(group_labels.get(group, group))
    if estimated_gb:
        parts.append(f"{estimated_gb}帯")
    if midpoint is not None:
        parts.append(f"月額{midpoint:,}円前後")

    description = None
    if parts:
        description = "の".join(parts[:2])
        if midpoint is not None and len(parts) >= 2:
            description += f"（月{midpoint:,}円前後）"

    return {
        "estimated": bool(parts),
        "group": group,
        "bill_band": bill_band,
        "midpoint": midpoint,
        "estimated_gb_band": estimated_gb,
        "description": description,
        "plan_known": plan_known,
    }


def recommend(answers: dict, records: list = None, top_n: int = 3) -> dict:
    """
    推薦のメインエントリポイント。
    answers: 質問回答 (q1〜q10)
    records: 統合データ (None なら自動読み込み)
    top_n: 上位何件を返すか
    """
    if records is None:
        records = load_integrated_data()

    features = convert_answers(answers)

    # monthly_price が null のプランは除外（安全弁）
    valid = [r for r in records if r.get("monthly_price_tax_included") is not None]

    # データ専用プランは全ユーザーから除外
    # Q8「どちらでもいい」は番号移行の話であり、音声通話不要の意味ではない
    # 音声通話非対応プランの誤推薦を防止するため、無条件で除外する
    mnp = features.get("mnp_required")
    valid = [r for r in valid if not _is_data_only(r)]

    # コスト範囲の計算
    costs = [r.get("effective_first_year_cost_yen", 0) or 0 for r in valid]
    cost_min = min(costs) if costs else 0
    cost_max = max(costs) if costs else 1

    # スコアリング
    scored = []
    for rec in valid:
        s = score_plan(rec, features, cost_min, cost_max)

        scored.append({
            "record": rec,
            "scores": s,
        })

    # ソート
    scored.sort(key=lambda x: x["scores"]["total"], reverse=True)

    # 同一キャリアの重複を抑制: 上位候補はキャリア多様性を確保
    seen_carriers = set()
    top = []
    rest = []
    for item in scored:
        carrier = item["record"].get("carrier_name", "")
        if carrier not in seen_carriers and len(top) < top_n:
            top.append(item)
            seen_carriers.add(carrier)
        else:
            rest.append(item)

    # top が top_n に満たない場合は rest から追加
    while len(top) < top_n and rest:
        top.append(rest.pop(0))

    # 結果構築
    recommendations = []
    for item in top:
        rec = item["record"]

        # 非金銭特典を分離
        non_cash_perks = []
        for camp in rec.get("official_campaigns", []):
            is_cash = _is_cash_equivalent_campaign(camp)
            if not is_cash and camp.get("reward_yen") and camp["reward_yen"] > 0:
                non_cash_perks.append({
                    "title": camp.get("title", ""),
                    "type": camp.get("type", ""),
                    "value_yen": camp.get("reward_yen"),
                    "raw": camp.get("reward_raw", ""),
                    "reward_is_cash_equivalent": False,
                    "reward_included_in_effective_cost": False,
                })

        applicable_bundles = _detect_applicable_bundles(
            rec, features.get("fiber_provider", "")
        )

        recommendations.append({
            "carrier_name":                 rec.get("carrier_name"),
            "plan_name":                    rec.get("plan_name"),
            "monthly_price_tax_included":   rec.get("monthly_price_tax_included"),
            "data_capacity_gb":             rec.get("data_capacity_gb"),
            "unlimited_flag":               rec.get("unlimited_flag", False),
            "effective_first_year_cost_yen": rec.get("effective_first_year_cost_yen"),
            "effective_monthly_cost_yen":    rec.get("effective_monthly_cost_yen"),
            "best_point_site_name":         rec.get("best_point_site_name"),
            "best_point_site_reward_yen":   rec.get("best_point_site_reward_yen"),
            "best_official_campaign_title":  rec.get("best_official_campaign_title"),
            "recommendation_reason":        _build_reason(rec, features, item["scores"]),
            "caution_note":                 _build_caution(rec, features),
            "confidence_label":             _confidence_label(rec),
            "score_detail":                 item["scores"],
            "non_cash_perks":               non_cash_perks,
            "applicable_bundle_discounts":  applicable_bundles,
        })

    # 現在プラン推定
    estimated_current = _estimate_current_plan(features)

    # B. savings_limited判定: すでに安い人への正直な告知
    # 中央値ではなくband下限値を使い、保守的に判定（ユーザーがband下限に近い場合でも正確に判定）
    BILL_BAND_MIN = {
        "under_2000": 0,
        "2000_3500":  2000,
        "3500_5000":  3500,
        "5000_7000":  5000,
        "over_7000":  7000,
        "unknown":    None,
        "under_1000": 0,
        "1000_2000":  1000,
        "2000_3000":  2000,
        "3000_5000":  3000,
    }
    savings_limited = False
    savings_limited_reason = None
    current_bill_band = features.get("current_monthly_bill_band", "unknown")
    current_min = BILL_BAND_MIN.get(current_bill_band)

    if current_min is not None and recommendations:
        best_monthly = recommendations[0].get("monthly_price_tax_included", 0)
        monthly_diff = current_min - best_monthly
        # band下限とおすすめ月額の差が500円未満なら「大きく安くはならない可能性」
        if monthly_diff < 500:
            savings_limited = True
            if monthly_diff < 0:
                savings_limited_reason = "今のプランのほうが安い可能性があります。乗り換え特典に注目してください"
            else:
                savings_limited_reason = "月額の差は小さめです。乗り換え特典やポイント還元が魅力的な候補を優先しています"

    return {
        "input_answers": answers,
        "features": features,
        "top_recommendations": recommendations,
        "total_candidates_evaluated": len(valid),
        "generated_at": str(date.today()),
        "savings_limited": savings_limited,
        "savings_limited_reason": savings_limited_reason,
        "estimated_current_plan": estimated_current,
    }


# ---------------------------------------------------------------------------
# 監査
# ---------------------------------------------------------------------------

def audit_recommendations(result: dict, records: list) -> dict:
    """推薦結果を8項目で監査"""
    checks = []
    features = result["features"]
    recs = result["top_recommendations"]

    # 1. usage_band に応じた容量帯の優先が効いているか（低速unlimited/データ専用チェック含む）
    band = features["usage_band"]
    cfg = USAGE_BAND_GB[band]
    mnp = features.get("mnp_required")
    issues_1 = []
    for r in recs:
        gb = r.get("data_capacity_gb") or 0
        is_unl = r.get("unlimited_flag", False)
        carrier = r["carrier_name"]
        plan = r["plan_name"]
        full_rec = next((x for x in records if x["carrier_name"] == carrier and x["plan_name"] == plan), None)
        if band == "unlimited":
            if full_rec and _is_low_speed_unlimited(full_rec):
                issues_1.append(f"{carrier} {plan} は低速unlimitedのため unlimited 向けとして不適切")
            elif not is_unl and gb < 20:
                issues_1.append(f"{carrier} {plan} ({gb}GB) は unlimited 向けとして容量不足")
        elif band == "heavy":
            if full_rec and _is_low_speed_unlimited(full_rec):
                issues_1.append(f"{carrier} {plan} は低速unlimitedのため heavy 向けとして不適切")
        elif band == "light":
            if gb > 10 and not is_unl:
                issues_1.append(f"{carrier} {plan} ({gb}GB) は light 向けとして過大")
        elif band == "standard":
            if gb > 25 and not is_unl:
                issues_1.append(f"{carrier} {plan} ({gb}GB) は standard 向けとして過大")
        elif band == "moderate":
            if gb > 40 and not is_unl:
                issues_1.append(f"{carrier} {plan} ({gb}GB) は moderate 向けとして過大")
        # MNP希望者にデータ専用が残っていないか
        if mnp is True and full_rec and _is_data_only(full_rec):
            issues_1.append(f"{carrier} {plan} はデータ専用だが MNP 希望者の上位に出ている")
    checks.append({
        "check": "A1_usage_band_priority",
        "desc": "usage_band に応じた容量帯の優先が効いているか（低速unlimited・データ専用チェック含む）",
        "result": "FAIL" if issues_1 else "PASS",
        "issues": issues_1,
    })

    # 2. found_no_points を還元額に入れていないか
    issues_2 = []
    for r in recs:
        carrier = r["carrier_name"]
        plan = r["plan_name"]
        full_rec = next((x for x in records if x["carrier_name"] == carrier and x["plan_name"] == plan), None)
        if full_rec:
            for ps in full_rec.get("point_site_offers", []):
                if ps.get("status") == "found_no_points" and ps.get("yen") and ps["yen"] > 0:
                    issues_2.append(f"{carrier}: found_no_points の {ps['site_name']} が yen={ps['yen']} を持っている")
            if full_rec.get("best_point_site_status") == "found_no_points":
                bp_yen = full_rec.get("best_point_site_reward_yen") or 0
                if bp_yen > 0:
                    issues_2.append(f"{carrier} {plan}: best_point_site が found_no_points なのに reward_yen={bp_yen}")
    checks.append({
        "check": "A2_no_found_no_points_in_benefit",
        "desc": "found_no_points を還元額に入れていないか",
        "result": "FAIL" if issues_2 else "PASS",
        "issues": issues_2,
    })

    # 3. stacking unknown を確定コストに混ぜていないか
    issues_3 = []
    for r in recs:
        carrier = r["carrier_name"]
        plan = r["plan_name"]
        full_rec = next((x for x in records if x["carrier_name"] == carrier and x["plan_name"] == plan), None)
        if full_rec:
            stacking = full_rec.get("official_campaign_stackability_status")
            known = full_rec.get("total_known_benefit_yen", 0)
            potential = full_rec.get("total_potential_benefit_yen", 0)
            if stacking == "unknown" and known > 0 and potential > 0:
                ps_yen = full_rec.get("best_point_site_reward_yen") or 0
                if known > ps_yen + 1:
                    issues_3.append(f"{carrier} {plan}: stacking=unknown なのに known_benefit={known} > PS={ps_yen}")
    checks.append({
        "check": "A3_stacking_unknown_not_in_known",
        "desc": "stacking unknown を確定コストに混ぜていないか",
        "result": "FAIL" if issues_3 else "PASS",
        "issues": issues_3,
    })

    # 4. merge_confidence low を無視していないか
    issues_4 = []
    for r in recs:
        if r.get("confidence_label") == "low":
            if not r.get("caution_note"):
                issues_4.append(f"{r['carrier_name']} {r['plan_name']}: confidence=low だが caution_note が空")
    checks.append({
        "check": "A4_low_confidence_noted",
        "desc": "merge_confidence low を無視していないか",
        "result": "FAIL" if issues_4 else "PASS",
        "issues": issues_4,
    })

    # 5. ecosystem_memberships の加点が過剰にスコアを歪めていないか
    issues_5 = []
    for r in recs:
        sd = r.get("score_detail", {})
        eco_s = sd.get("ecosystem_score", 0)
        total = sd.get("total", 1)
        if total > 0 and eco_s / total > 0.35:
            issues_5.append(f"{r['carrier_name']} {r['plan_name']}: ecosystem_score={eco_s} が total={total} の {eco_s/total*100:.0f}% を占めている")
    checks.append({
        "check": "A5_ecosystem_not_excessive",
        "desc": "ecosystem_memberships の加点が過剰にスコアを歪めていないか",
        "result": "FAIL" if issues_5 else "PASS",
        "issues": issues_5,
    })

    # 6. 上位候補の理由文が実データと整合しているか
    issues_6 = []
    for r in recs:
        reason = r.get("recommendation_reason", "")
        monthly = r.get("monthly_price_tax_included", 0)
        carrier = r["carrier_name"]
        plan = r["plan_name"]
        full_rec = next((x for x in records if x["carrier_name"] == carrier and x["plan_name"] == plan), None)
        if f"{monthly:,.0f}円" in reason or f"{monthly:,}円" in reason:
            pass
        else:
            if "月額" in reason:
                issues_6.append(f"{carrier}: 理由文の月額表記が実データと不一致の可能性")
        ps_name = r.get("best_point_site_name")
        ps_yen = r.get("best_point_site_reward_yen")
        if ps_name and ps_yen and ps_yen > 0:
            if ps_name not in reason:
                issues_6.append(f"{carrier}: PS還元 ({ps_name}, {ps_yen}円) が理由文に反映されていない")
        if full_rec and _is_data_only(full_rec):
            if "データ通信専用" not in reason and "音声通話" not in reason:
                issues_6.append(f"{carrier} {plan}: データ専用だが理由文に注記がない")
        if full_rec and _is_low_speed_unlimited(full_rec):
            if "低速" not in reason and "kbps" not in reason:
                issues_6.append(f"{carrier} {plan}: 低速unlimitedだが理由文に速度制限の注記がない")
    checks.append({
        "check": "A6_reason_data_consistency",
        "desc": "上位候補の理由文が実データと整合しているか",
        "result": "FAIL" if issues_6 else "PASS",
        "issues": issues_6,
    })

    # 7. caution_note が必要な候補に付いているか
    issues_7 = []
    current_group = features.get("current_group", "unknown")
    for r in recs:
        carrier = r["carrier_name"]
        plan = r["plan_name"]
        full_rec = next((x for x in records if x["carrier_name"] == carrier and x["plan_name"] == plan), None)
        if full_rec:
            flags = full_rec.get("unresolved_flags", [])
            stacking = full_rec.get("official_campaign_stackability_status")
            conf = full_rec.get("merge_confidence")
            needs_caution = bool(flags) or stacking == "unknown" or conf == "low"
            if needs_caution and not r.get("caution_note"):
                issues_7.append(f"{carrier} {plan}: 要確認事項があるが caution_note が空")
            if current_group != "unknown":
                carrier_grp = CARRIER_GROUP.get(carrier, "unknown")
                if carrier_grp == current_group:
                    caution = r.get("caution_note", "")
                    if "同系列" not in caution and "MNP限定" not in caution:
                        has_mnp_cp = any(
                            c.get("applies_to") and "MNP" in str(c.get("applies_to", ""))
                            for c in full_rec.get("official_campaigns", [])
                        )
                        if has_mnp_cp:
                            issues_7.append(f"{carrier} {plan}: 同系列移動だが MNP注意の caution がない")
    checks.append({
        "check": "A7_caution_note_present",
        "desc": "caution_note が必要な候補に付いているか",
        "result": "FAIL" if issues_7 else "PASS",
        "issues": issues_7,
    })

    # 8. 経済圏を複数選択した場合でも不自然な偏りが出ていないか
    issues_8 = []
    ecosystems = features.get("ecosystem_memberships", [])
    if len(ecosystems) >= 2:
        carriers_in_top = [r["carrier_name"] for r in recs]
        eco_matched = 0
        for r in recs:
            for eco in ecosystems:
                if r["carrier_name"] in ECOSYSTEM_CARRIER_BONUS.get(eco, []):
                    eco_matched += 1
                    break
        if len(recs) > 0 and eco_matched == len(recs):
            if len(ecosystems) >= 3:
                issues_8.append(f"上位{len(recs)}件すべてが経済圏マッチ候補（{carriers_in_top}）。コスト優位性も確認要")
    checks.append({
        "check": "A8_multi_ecosystem_no_bias",
        "desc": "経済圏を複数選択した場合でも不自然な偏りが出ていないか",
        "result": "WARN" if issues_8 else "PASS",
        "issues": issues_8,
    })

    overall = "PASS"
    for c in checks:
        if c["result"] == "FAIL":
            overall = "FAIL"
            break
    if overall == "PASS":
        for c in checks:
            if c["result"] == "WARN":
                overall = "WARN"
                break

    return {
        "audit_date": str(date.today()),
        "overall_result": overall,
        "total_checks": len(checks),
        "features_tested": features,
        "checks": checks,
    }


# ---------------------------------------------------------------------------
# Markdown出力
# ---------------------------------------------------------------------------

def result_to_markdown(result: dict) -> str:
    lines = []
    lines.append("# 推薦結果\n")
    lines.append(f"> 生成日: {result['generated_at']} | 評価対象: {result['total_candidates_evaluated']}プラン\n")

    f = result["features"]
    lines.append("## 入力特徴量\n")
    lines.append(f"| 項目 | 値 |")
    lines.append(f"|:-----|:---|")
    lines.append(f"| 希望容量帯 | {f['usage_band']} |")
    lines.append(f"| 現在使い方 | {f.get('current_usage_band', '-')} |")
    lines.append(f"| 昼間速度 | {f['daytime_speed_tolerance']} |")
    lines.append(f"| 現在グループ | {f['current_group']} |")
    lines.append(f"| 月額帯 | {f['current_monthly_bill_band']} |")
    lines.append(f"| 通話 | {f.get('call_option_need', '-')} |")
    lines.append(f"| MNP | {f['mnp_required']} |")
    lines.append(f"| 割引 | {f.get('discount_eligibility', [])} |")
    lines.append(f"| 経済圏 | {f['ecosystem_memberships']} |")
    lines.append(f"| Wi-Fi | {f['wifi_home']} |")
    lines.append("")

    for r in result["top_recommendations"]:
        carrier = r["carrier_name"]
        plan = r["plan_name"]
        monthly = r["monthly_price_tax_included"]
        lines.append(f"## {carrier} {plan}")
        lines.append(f"- 月額: {monthly:,}円")
        lines.append(f"- 実質月額: {r.get('effective_monthly_cost_yen', 0):,}円")
        lines.append(f"- GB: {r.get('data_capacity_gb', '-')}")
        lines.append(f"- 信頼度: {r.get('confidence_label', '-')}")
        lines.append(f"- 理由: {r.get('recommendation_reason', '')}")
        if r.get("caution_note"):
            lines.append(f"- 要確認: {r['caution_note']}")
        lines.append("")

    return "\n".join(lines)


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="推薦ロジック")
    parser.add_argument("--scenario", type=int, default=1)
    args = parser.parse_args()

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
    ]

    idx = args.scenario - 1
    if idx < 0 or idx >= len(SAMPLE_SCENARIOS):
        idx = 0

    scenario = SAMPLE_SCENARIOS[idx]
    print(f"=== {scenario['name']} ===")

    records = load_integrated_data()
    result = recommend(scenario["answers"], records)
    print(result_to_markdown(result))
