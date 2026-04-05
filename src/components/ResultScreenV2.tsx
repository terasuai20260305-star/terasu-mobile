"use client";

import { useState } from "react";
import type {
  RecommendV2Response,
  RecommendV2Recommendation,
  EffectiveMonthlyBreakdown,
} from "@/lib/recommend-v2-types";

interface ResultScreenV2Props {
  result: RecommendV2Response;
  onRetry: () => void;
}

/* ─── 順位バッジ ─── */
function RankBadge({ rank }: { rank: number }) {
  const styles: Record<number, string> = {
    1: "bg-blue-600 text-white",
    2: "bg-gray-200 text-gray-700",
    3: "bg-gray-200 text-gray-700",
  };
  const labels: Record<number, string> = { 1: "1st", 2: "2nd", 3: "3rd" };
  return (
    <span
      className={`inline-flex h-6 w-10 items-center justify-center rounded-full text-[11px] font-bold ${styles[rank] ?? "bg-gray-200 text-gray-700"}`}
    >
      {labels[rank] ?? `${rank}th`}
    </span>
  );
}

/* ─── タグバッジ ─── */
function TagBadge({ tag }: { tag: string }) {
  const isWarning =
    tag === "データ専用" || tag === "要確認あり" || tag === "低速無制限" || tag === "都度購入型";
  return (
    <span
      className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-medium ${
        isWarning ? "bg-red-50 text-red-600" : "bg-gray-100 text-gray-600"
      }`}
    >
      {tag}
    </span>
  );
}

/* ─── ポイントサイトボタン ─── */
function PointSiteButton({ rec }: { rec: RecommendV2Recommendation }) {
  const hasReward =
    rec.best_point_site_name &&
    rec.best_point_site_reward_yen &&
    rec.best_point_site_reward_yen > 0;

  if (hasReward) {
    const inner = (
      <div className="flex items-center justify-between rounded-lg border border-green-200 bg-green-50 px-3 py-2">
        <div>
          <p className="text-[11px] text-green-700">ポイントサイト還元</p>
          <p className="text-sm font-bold text-green-800">
            {rec.best_point_site_name}経由で
            {rec.best_point_site_reward_yen!.toLocaleString()}円相当
          </p>
        </div>
        {rec.best_point_site_link && (
          <span className="shrink-0 text-[11px] text-green-600">
            サイトへ →
          </span>
        )}
      </div>
    );

    if (rec.best_point_site_link) {
      return (
        <a
          href={rec.best_point_site_link}
          target="_blank"
          rel="noopener noreferrer"
          className="block"
        >
          {inner}
        </a>
      );
    }
    return inner;
  }

  // 還元なし系
  const status = rec.best_point_site_status;
  if (status === "found_no_points") {
    return (
      <p className="text-[11px] text-gray-400 px-1">
        ポイントサイト還元なし（掲載はあるが還元対象外）
      </p>
    );
  }
  return (
    <p className="text-[11px] text-gray-400 px-1">ポイントサイト掲載なし</p>
  );
}

/* ─── 実質月額の内訳 ─── */
function BreakdownSection({
  bd,
  campaignDisplay,
}: {
  bd: EffectiveMonthlyBreakdown;
  campaignDisplay: string;
}) {
  const rows: { label: string; value: string; highlight?: boolean }[] = [];

  rows.push({
    label: "通常月額",
    value: `${bd.monthly_price.toLocaleString()}円/月`,
  });

  if (bd.initial_cost > 0) {
    rows.push({
      label: "初期費用",
      value: `${bd.initial_cost.toLocaleString()}円`,
    });
  }

  if (bd.official_campaign_title) {
    const val = bd.official_campaign_value_yen
      ? `−${bd.official_campaign_value_yen.toLocaleString()}円相当`
      : bd.official_campaign_raw || "あり";
    rows.push({
      label: "公式キャンペーン",
      value: `${bd.official_campaign_title.length > 30 ? bd.official_campaign_title.slice(0, 30) + "…" : bd.official_campaign_title}（${val}）`,
      highlight: true,
    });
  }

  if (bd.point_site_name && bd.point_site_value_yen && bd.point_site_value_yen > 0) {
    rows.push({
      label: "ポイントサイト還元",
      value: `−${bd.point_site_value_yen.toLocaleString()}円相当（${bd.point_site_name}）`,
      highlight: true,
    });
  }

  rows.push({
    label: "2年間の実質総コスト",
    value: `${bd.effective_first_year_cost.toLocaleString()}円`,
  });
  rows.push({
    label: "実質月額（24ヶ月平均）",
    value: `${bd.effective_monthly_cost.toLocaleString()}円/月`,
    highlight: true,
  });

  if (bd.additional_potential_yen && bd.additional_potential_note) {
    rows.push({
      label: "追加ポテンシャル",
      value: `${bd.additional_potential_note}（最大${bd.additional_potential_yen.toLocaleString()}円）`,
    });
  }

  return (
    <div className="space-y-1.5">
      <p className="text-[11px] font-semibold text-gray-500">実質月額の内訳</p>
      {rows.map((row, i) => (
        <div key={i} className="flex items-start justify-between gap-2">
          <span className="text-[11px] text-gray-400 shrink-0">{row.label}</span>
          <span
            className={`text-[11px] text-right ${
              row.highlight ? "font-semibold text-gray-700" : "text-gray-500"
            }`}
          >
            {row.value}
          </span>
        </div>
      ))}
    </div>
  );
}

/* ─── プランカード ─── */
function PlanCard({
  rec,
  defaultOpen,
}: {
  rec: RecommendV2Recommendation;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen ?? false);
  const isDataOnly = !rec.voice_support;

  return (
    <div className="rounded-2xl bg-white shadow-md overflow-hidden">
      {/* ─ ヘッダー: 順位 + キャリア/プラン + データ容量 ─ */}
      <div
        className={`px-4 py-2.5 ${
          rec.rank === 1
            ? "bg-blue-600 text-white"
            : "bg-gray-50 text-gray-800"
        }`}
      >
        <div className="flex items-center gap-2">
          <RankBadge rank={rec.rank} />
          <div className="flex-1 min-w-0">
            <p
              className={`text-[11px] ${
                rec.rank === 1 ? "text-blue-200" : "text-gray-400"
              }`}
            >
              {rec.carrier_name}
            </p>
            <p className="text-sm font-bold truncate">{rec.plan_name}</p>
          </div>
          {/* データ容量（ヘッダー右） */}
          <div className="text-right shrink-0">
            <p className="text-sm font-bold">{rec.data_capacity_display}</p>
          </div>
        </div>
      </div>

      {/* ─ 1st View: headline ─ */}
      <div className="px-4 pt-3 pb-1">
        <p className="text-[15px] font-bold text-gray-800 leading-snug">
          {rec.headline}
        </p>
      </div>

      {/* ─ 料金エリア: 通常月額がヒーロー、実質月額は補助 ─ */}
      <div className="px-4 pt-2 pb-2">
        <div className="flex items-end gap-4">
          {/* 通常月額（主役） */}
          <div>
            <p className="text-[10px] text-gray-400">通常月額</p>
            <p className="text-2xl font-extrabold text-gray-800">
              {rec.monthly_price_tax_included.toLocaleString()}
              <span className="text-sm font-normal text-gray-500">円/月</span>
            </p>
          </div>
          {/* 初年度実質月額（補助） */}
          <div className="pb-0.5">
            <p className="text-[10px] text-gray-400">初年度 実質月額</p>
            <p className="text-base font-semibold text-blue-600">
              {rec.effective_monthly_cost_yen.toLocaleString()}
              <span className="text-xs font-normal text-blue-400">円/月</span>
            </p>
          </div>
        </div>
      </div>

      {/* タグ（最大4個） */}
      {rec.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 px-4 pb-2">
          {rec.tags.map((tag) => (
            <TagBadge key={tag} tag={tag} />
          ))}
        </div>
      )}

      {/* データ専用警告 */}
      {isDataOnly && (
        <div className="mx-4 mb-2 rounded-lg bg-red-50 px-3 py-1.5">
          <p className="text-[11px] font-semibold text-red-600">
            音声通話非対応（データ通信専用プラン）
          </p>
        </div>
      )}

      {/* 公式キャンペーン（あれば表示） */}
      {rec.best_official_campaign_title && (
        <div className="mx-4 mb-2 rounded-lg bg-blue-50 px-3 py-1.5">
          <p className="text-[11px] text-blue-700">
            {rec.official_campaign_display}
          </p>
        </div>
      )}

      {/* ポイントサイト導線 */}
      <div className="px-4 pb-2">
        <PointSiteButton rec={rec} />
      </div>

      {/* confidence low 警告（常時表示） */}
      {rec.confidence_label === "low" && (
        <div className="mx-4 mb-2 rounded-lg bg-orange-50 px-3 py-1.5">
          <p className="text-[11px] text-orange-700">
            ※ 情報に不確かさあり。公式サイトで最新情報をご確認ください
          </p>
        </div>
      )}

      {/* caution_note（常時表示） */}
      {rec.caution_note && (
        <div className="mx-4 mb-2 rounded-lg bg-yellow-50 px-3 py-1.5">
          <p className="text-[11px] text-yellow-700">{rec.caution_note}</p>
        </div>
      )}

      {/* コスト概要（常時表示） */}
      <div className="px-4 pb-1">
        <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-gray-400">
          {rec.effective_monthly_breakdown.initial_cost > 0 && (
            <span>初期費用 {rec.effective_monthly_breakdown.initial_cost.toLocaleString()}円</span>
          )}
          {rec.effective_monthly_breakdown.official_campaign_value_yen && rec.effective_monthly_breakdown.official_campaign_value_yen > 0 && (
            <span className="text-blue-500">キャンペーン −{rec.effective_monthly_breakdown.official_campaign_value_yen.toLocaleString()}円</span>
          )}
          {rec.effective_monthly_breakdown.point_site_value_yen && rec.effective_monthly_breakdown.point_site_value_yen > 0 && (
            <span className="text-green-600">ポイント還元 −{rec.effective_monthly_breakdown.point_site_value_yen.toLocaleString()}円</span>
          )}
        </div>
      </div>

      {/* reason_short */}
      <div className="border-t border-gray-100 px-4 py-2">
        <p className="text-[13px] text-gray-600">
          {rec.recommendation_reason_short}
        </p>
      </div>

      {/* ─ 折りたたみトグル ─ */}
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-center gap-1 border-t border-gray-100 py-2 text-xs text-blue-500 active:bg-gray-50"
      >
        {open ? "閉じる ▲" : "内訳・詳細を見る ▼"}
      </button>

      {/* ─ 2nd View: 内訳 + reason_long + confidence ─ */}
      {open && (
        <div className="border-t border-gray-100 px-4 py-3 space-y-3">
          {/* 実質月額の内訳 */}
          <BreakdownSection
            bd={rec.effective_monthly_breakdown}
            campaignDisplay={rec.official_campaign_display}
          />

          {/* 理由（詳細） */}
          {rec.recommendation_reason_long && (
            <div className="border-t border-gray-100 pt-2.5">
              <p className="text-[11px] font-semibold text-gray-500 mb-1">
                おすすめ理由
              </p>
              <p className="text-[11px] text-gray-500 leading-relaxed">
                {rec.recommendation_reason_long}
              </p>
            </div>
          )}

          {/* 非金銭特典（実質月額に含まれていない特典） */}
          {rec.non_cash_perks && rec.non_cash_perks.length > 0 && (
            <div className="rounded-lg bg-purple-50 px-3 py-2">
              <p className="text-[11px] font-semibold text-purple-700 mb-1">
                実質月額に含まれていない特典
              </p>
              {rec.non_cash_perks.map((perk, i) => (
                <p key={i} className="text-[11px] text-purple-600">
                  ・{perk.title}
                </p>
              ))}
            </div>
          )}

          {/* 適用できる可能性のあるセット割（スコア・実質月額に含まれない） */}
          {rec.applicable_bundle_discounts && rec.applicable_bundle_discounts.length > 0 && (
            <div className="rounded-lg border border-teal-200 bg-teal-50 px-3 py-2">
              <p className="text-[11px] font-semibold text-teal-700 mb-0.5">
                適用できる可能性のある割引
              </p>
              <p className="text-[10px] text-teal-500 mb-1.5">
                ※ 計算には含まれていません（条件を満たした場合のみ適用）
              </p>
              <div className="space-y-1">
                {rec.applicable_bundle_discounts.map((bd, i) => (
                  <div key={i} className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] font-semibold text-teal-800 truncate">
                        {bd.label}
                      </p>
                      <p className="text-[10px] text-teal-600 leading-tight">
                        {bd.note}
                      </p>
                    </div>
                    <span className="shrink-0 text-[11px] font-bold text-teal-700">
                      −{bd.monthly_amount.toLocaleString()}円/月
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Wi-Fi / コスト補足 */}
          {(rec.wifi_comment || rec.cost_comment) && (
            <div className="border-t border-gray-100 pt-2 space-y-1">
              {rec.wifi_comment && (
                <p className="text-[11px] text-gray-400">
                  {rec.wifi_comment}
                </p>
              )}
              {rec.cost_comment && (
                <p className="text-[11px] text-gray-400">
                  {rec.cost_comment}
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ─── メイン画面 ─── */
export default function ResultScreenV2({
  result,
  onRetry,
}: ResultScreenV2Props) {
  if (result.status === "error") {
    return (
      <div className="flex min-h-[100dvh] flex-col items-center justify-center px-4">
        <div className="w-full max-w-md text-center">
          <p className="text-4xl">😥</p>
          <h2 className="mt-3 text-xl font-bold text-gray-800">
            エラーが発生しました
          </h2>
          <p className="mt-2 text-sm text-gray-500">
            {result.error_message || "推薦結果を取得できませんでした"}
          </p>
          <button
            onClick={onRetry}
            className="mt-6 w-full rounded-xl border border-gray-200 bg-white py-3 text-sm text-gray-500 active:bg-gray-50"
          >
            ← やり直す
          </button>
        </div>
      </div>
    );
  }

  // 推定月額と最安月額の差分
  const estimatedPlan = result.estimated_current_plan;
  const hasSavingsEstimate =
    estimatedPlan?.estimated &&
    estimatedPlan.midpoint &&
    result.recommendations.length > 0;

  let savingsDiff: number | null = null;
  if (hasSavingsEstimate) {
    const bestMonthly = result.recommendations[0].monthly_price_tax_included;
    savingsDiff = (estimatedPlan!.midpoint as number) - bestMonthly;
  }

  return (
    <div className="min-h-[100dvh] bg-gray-50 pb-8">
      {/* ヘッダー */}
      <div className="bg-blue-600 px-4 pt-4 pb-3 text-center text-white">
        <p className="text-base font-bold">あなたへのおすすめプラン</p>
        <p className="mt-0.5 text-xs text-blue-200">
          {result.total_candidates}プランから上位3件を厳選
        </p>
        {/* 現在プラン推定 + 節約可能性 */}
        {estimatedPlan?.estimated && estimatedPlan.description && (
          <p className="mt-1 text-xs text-blue-200">
            現在の推定: {estimatedPlan.description}
          </p>
        )}
        {savingsDiff !== null && savingsDiff > 500 && (
          <p className="mt-0.5 text-xs text-blue-100 font-semibold">
            今より月{savingsDiff.toLocaleString()}円ほど下がる可能性があります
          </p>
        )}
      </div>

      {/* savings_limited: すでに安い人向けの注意表示 */}
      {result.savings_limited && result.savings_limited_reason && (
        <div className="mx-4 -mt-1 mb-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
          <p className="text-sm font-semibold text-amber-800">
            今のプランでも十分お得かもしれません
          </p>
          <p className="mt-1 text-xs text-amber-700">
            {result.savings_limited_reason}
          </p>
        </div>
      )}

      {/* カード一覧 */}
      <div className="mx-4 mt-3 space-y-4">
        {result.recommendations.map((rec) => (
          <PlanCard
            key={rec.rank}
            rec={rec}
            defaultOpen={rec.rank === 1}
          />
        ))}
      </div>

      {/* 透明性表示 */}
      <div className="mx-4 mt-5 rounded-xl bg-gray-100 p-3 text-[11px] text-gray-400 space-y-0.5">
        <p>
          ・提案は条件適合度で決定しています（報酬額による順位操作はありません）
        </p>
        <p>・リンク経由の申込で紹介報酬が発生する場合があります</p>
        <p>・データ更新日：{result.data_updated_at ? new Date(result.data_updated_at).toLocaleDateString("ja-JP", { year: "numeric", month: "long", day: "numeric" }) : "不明"}</p>
      </div>

      {/* やり直し */}
      <div className="mx-4 mt-4">
        <button
          onClick={onRetry}
          className="w-full rounded-xl border border-gray-200 bg-white py-3 text-sm text-gray-500 active:bg-gray-50"
        >
          ← 条件を変えてやり直す
        </button>
      </div>
    </div>
  );
}
