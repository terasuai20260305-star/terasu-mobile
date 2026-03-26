"use client";

import { useState } from "react";
import type { RecommendResult, DiagnosisInput } from "@/lib/types";

interface ResultScreenProps {
  result: RecommendResult;
  input: DiagnosisInput;
  onRetry: () => void;
}

export default function ResultScreen({ result, input, onRetry }: ResultScreenProps) {
  const [detailOpen, setDetailOpen] = useState(false);

  // 推薦なし
  if ("no_recommendation" in result) {
    return (
      <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-green-50 px-4">
        <div className="w-full max-w-md text-center">
          <p className="text-6xl">🎉</p>
          <h2 className="mt-4 text-2xl font-bold text-gray-900">
            すでにお得なプランです！
          </h2>
          <p className="mt-2 text-sm text-gray-500">
            現在のプランを継続されることを
            <br />
            おすすめします。
          </p>

          <div className="mt-6 w-full rounded-2xl bg-white p-4 shadow-sm text-left">
            <p className="text-sm font-semibold text-gray-700">
              現在のプランが最適な理由
            </p>
            <ul className="mt-2 space-y-1">
              {result.reasons.map((reason, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-gray-600">
                  <span className="mt-0.5 shrink-0 text-green-500">✓</span>
                  {reason}
                </li>
              ))}
            </ul>
          </div>

          <button
            onClick={onRetry}
            className="mt-6 w-full rounded-xl border border-gray-200 bg-white py-3 text-sm text-gray-500 transition-colors active:bg-gray-50"
          >
            ← 条件を変えてやり直す
          </button>
        </div>
      </div>
    );
  }

  const {
    recommended_plan,
    monthly_saving,
    annual_saving,
    first_year_total_benefit,
    reasons,
    cautions,
    not_recommended_if,
    note,
    second_plan,
  } = result;

  const campaigns = recommended_plan.campaigns || [];
  const pointSite = recommended_plan.point_site;
  const hasBonuses = campaigns.length > 0 || pointSite;

  return (
    <div className="min-h-[100dvh] bg-white pb-8">
      {/* ① ヘッダー */}
      <div className="bg-blue-600 px-4 py-4 text-white">
        <p className="text-center text-base font-bold">✅ お得なプランが見つかりました</p>
        <p className="mt-0.5 text-center text-xs text-blue-100">あなたの条件にマッチするプランです</p>
      </div>

      {/* ② メインカード */}
      <div className="mx-4 -mt-1 rounded-2xl bg-white p-4 shadow-lg">
        {note && (
          <p className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
            💡 {note}
          </p>
        )}

        <p className="text-xl font-bold text-gray-900">{recommended_plan.provider_name}</p>
        <p className="mt-0.5 text-sm text-gray-500">{recommended_plan.plan_name}</p>

        <div className="my-3 border-t border-gray-100" />

        {/* 月額節約ブロック */}
        <div className="flex items-center justify-between rounded-xl bg-green-50 p-3">
          <div>
            <p className="text-xs text-gray-500">今より毎月</p>
            <p className="text-3xl font-bold text-green-600">
              {monthly_saving.toLocaleString()}
              <span className="text-base">円</span>
            </p>
            <p className="text-xs text-gray-500">お得になります</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-green-600">年間</p>
            <p className="text-lg font-bold text-green-600">{annual_saving.toLocaleString()}円</p>
          </div>
        </div>

        {/* 初年度トータルお得額（キャンペーン等込み） */}
        {hasBonuses && first_year_total_benefit > annual_saving && (
          <div className="mt-2 rounded-xl bg-gradient-to-r from-orange-50 to-yellow-50 p-3">
            <p className="text-xs text-orange-600 font-medium">🎁 初年度トータルお得額（特典込み）</p>
            <p className="mt-0.5 text-2xl font-bold text-orange-600">
              {first_year_total_benefit.toLocaleString()}
              <span className="text-sm">円相当</span>
            </p>
            <p className="mt-0.5 text-[10px] text-gray-400">
              月額節約 + キャンペーン + ポイントサイト還元の合計
            </p>
          </div>
        )}

        <div className="my-3 border-t border-gray-100" />

        {/* 理由リスト */}
        <div>
          <p className="text-sm font-semibold text-gray-700">✓ あなたに合う理由</p>
          <ul className="mt-1.5 space-y-0.5">
            {reasons.map((reason, i) => (
              <li key={i} className="py-0.5 text-sm text-gray-600">・{reason}</li>
            ))}
          </ul>
        </div>

        <div className="my-3 border-t border-gray-100" />

        {/* 注意リスト */}
        <div>
          <p className="text-sm font-semibold text-gray-700">⚠️ これは向かない方</p>
          <ul className="mt-1.5 space-y-0.5">
            {not_recommended_if.map((item, i) => (
              <li key={i} className="py-0.5 text-sm text-gray-500">・{item}</li>
            ))}
          </ul>
        </div>
      </div>

      {/* ③ キャンペーン情報カード */}
      {campaigns.length > 0 && (
        <div className="mx-4 mt-4">
          <div className="rounded-2xl border border-yellow-200 bg-yellow-50 p-4">
            <p className="text-sm font-bold text-gray-800">🎁 現在のキャンペーン</p>
            <div className="mt-2 space-y-2">
              {campaigns.map((c, i) => (
                <div key={i} className="flex items-start gap-2">
                  <span className="mt-0.5 shrink-0 text-xs">
                    {c.type === "point" ? "🔵" : c.type === "cashback" ? "💰" : "✂️"}
                  </span>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-800">
                      {c.name}
                      <span className="ml-1 text-sm font-bold text-orange-600">
                        {c.type === "discount" && c.duration_months
                          ? `${c.amount.toLocaleString()}円×${c.duration_months}ヶ月`
                          : `${c.amount.toLocaleString()}円相当`}
                      </span>
                    </p>
                    <p className="text-[11px] text-gray-400">
                      条件: {c.conditions}
                      {c.end_date && ` ／ 〜${c.end_date}`}
                    </p>
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-2 text-[10px] text-gray-400">
              ※ キャンペーン内容は予告なく変更される場合があります
            </p>
          </div>
        </div>
      )}

      {/* ④ ポイントサイト還元カード */}
      {pointSite && (
        <div className="mx-4 mt-3">
          <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4">
            <p className="text-sm font-bold text-gray-800">💎 ポイントサイト経由でさらにお得</p>
            <div className="mt-2 flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-700">
                  <span className="font-semibold">{pointSite.site_name}</span>
                  経由で申し込むと
                </p>
                <p className="text-xl font-bold text-blue-600">
                  +{pointSite.reward.toLocaleString()}
                  <span className="text-sm">円還元</span>
                </p>
              </div>
              <a
                href={pointSite.url}
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0 rounded-lg bg-blue-600 px-3 py-2 text-xs font-bold text-white transition-all active:scale-[0.98]"
              >
                サイトを見る →
              </a>
            </div>
            <p className="mt-1.5 text-[10px] text-gray-400">
              ※ 還元額は{pointSite.last_updated}時点の情報です。申込前にご確認ください
            </p>
          </div>
        </div>
      )}

      {/* ⑤ CTAボタン */}
      <div className="mx-4 mt-4">
        <a
          href={recommended_plan.official_url}
          target="_blank"
          rel="noopener noreferrer"
          className="block w-full rounded-2xl bg-blue-600 py-4 text-center text-base font-bold text-white shadow-md transition-all active:scale-[0.98] sm:hover:bg-blue-700"
        >
          {recommended_plan.provider_name}の公式サイトを確認する →
        </a>
        {pointSite && (
          <p className="mt-1 text-center text-[10px] text-orange-500 font-medium">
            💡 {pointSite.site_name}に登録してから申し込むとさらに{pointSite.reward.toLocaleString()}円お得！
          </p>
        )}
        <p className="mt-0.5 text-center text-[10px] text-gray-400">
          ※ 申し込みは各社公式サイトで行います
        </p>
      </div>

      {/* ⑥ 詳細折りたたみ */}
      <div className="mx-4 mt-4">
        <button
          onClick={() => setDetailOpen(!detailOpen)}
          className="w-full rounded-xl bg-gray-50 py-3 text-center text-sm text-gray-500 transition-colors active:bg-gray-100"
        >
          詳細を見る {detailOpen ? "∧" : "∨"}
        </button>

        {detailOpen && (
          <div className="animate-fadeIn mt-2 space-y-3 rounded-xl bg-gray-50 p-4">
            {/* お得額内訳 */}
            {hasBonuses && (
              <div>
                <p className="text-sm font-semibold text-gray-700">💰 初年度お得額の内訳</p>
                <div className="mt-1.5 space-y-1 text-sm text-gray-600">
                  <div className="flex justify-between">
                    <span>月額節約 × 12ヶ月</span>
                    <span className="font-medium">{annual_saving.toLocaleString()}円</span>
                  </div>
                  {campaigns.map((c, i) => (
                    <div key={i} className="flex justify-between">
                      <span className="truncate mr-2">{c.name}</span>
                      <span className="shrink-0 font-medium">
                        {c.type === "discount" && c.duration_months
                          ? `${(c.amount * c.duration_months).toLocaleString()}円`
                          : `${c.amount.toLocaleString()}円`}
                      </span>
                    </div>
                  ))}
                  {pointSite && (
                    <div className="flex justify-between">
                      <span>{pointSite.site_name}還元</span>
                      <span className="font-medium">{pointSite.reward.toLocaleString()}円</span>
                    </div>
                  )}
                  <div className="border-t border-gray-200 pt-1 flex justify-between font-bold text-green-600">
                    <span>合計</span>
                    <span>{first_year_total_benefit.toLocaleString()}円</span>
                  </div>
                </div>
              </div>
            )}

            {/* プラン基本情報 */}
            <div className="space-y-1 text-sm text-gray-600">
              <p className="font-semibold text-gray-700">📋 プラン情報</p>
              <div className="flex justify-between">
                <span>月額</span>
                <span>{recommended_plan.monthly_fee_base.toLocaleString()}円（税込）</span>
              </div>
              <div className="flex justify-between">
                <span>データ</span>
                <span>{recommended_plan.unlimited_data ? "無制限" : `${recommended_plan.data_allowance_gb}GB`}</span>
              </div>
              <div className="flex justify-between">
                <span>契約縛り</span>
                <span>なし</span>
              </div>
            </div>

            {/* デメリット */}
            <div>
              <p className="text-sm font-semibold text-red-600">⚠️ デメリット・注意点</p>
              <ul className="mt-1.5 space-y-0.5">
                {recommended_plan.demerits.map((d, i) => (
                  <li key={i} className="text-sm text-gray-500">・{d}</li>
                ))}
                {cautions.map((c, i) => (
                  <li key={`c-${i}`} className="text-sm text-gray-500">・{c}</li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </div>

      {/* ⑦ 他の選択肢 */}
      {second_plan && (
        <div className="mx-4 mt-4">
          <p className="text-sm font-semibold text-gray-500">他の選択肢</p>
          <div className="mt-2 flex items-center justify-between rounded-xl border border-gray-200 bg-white p-3">
            <div>
              <p className="text-sm font-medium text-gray-800">{second_plan.provider_name}</p>
              <p className="text-xs text-gray-500">{second_plan.plan_name}</p>
            </div>
            <p className="text-sm font-semibold text-green-600">
              月▲{second_plan.monthly_saving.toLocaleString()}円
            </p>
          </div>
        </div>
      )}

      {/* ⑧ やり直しボタン */}
      <div className="mx-4 mt-6">
        <button
          onClick={onRetry}
          className="w-full rounded-xl border border-gray-200 bg-white py-3 text-sm text-gray-500 transition-colors active:bg-gray-50"
        >
          ← 条件を変えてやり直す
        </button>
      </div>

      {/* データ更新日 */}
      <p className="mt-4 text-center text-[10px] text-gray-300">
        データ更新日: {recommended_plan.point_site?.last_updated || "2026-03-26"}
      </p>
    </div>
  );
}
