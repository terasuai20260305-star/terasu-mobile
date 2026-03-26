"use client";

import { useState } from "react";
import type { RecommendResult, DiagnosisInput } from "@/lib/types";

interface ResultScreenProps {
  result: RecommendResult;
  input: DiagnosisInput;
  onRetry: () => void;
}

function getCampaignText(providerName: string): string {
  switch (providerName) {
    case "楽天モバイル":
      return "楽天ポイント最大13,000pt還元";
    case "IIJmio":
      return "初期費用割引・端末セール";
    case "mineo":
      return "月額料金割引キャンペーン";
    default:
      return "各社キャンペーンは公式サイトで確認";
  }
}

export default function ResultScreen({ result, input, onRetry }: ResultScreenProps) {
  const [detailOpen, setDetailOpen] = useState(false);

  // 改善⑥：推薦なし画面
  if ("no_recommendation" in result) {
    return (
      <div className="flex min-h-[100dvh] flex-col items-center justify-center px-6">
        <div className="mx-auto w-full max-w-md text-center">
          <div className="rounded-2xl bg-white p-8 shadow-sm">
            <p className="text-5xl">✅</p>
            <h2 className="mt-4 text-xl font-bold text-gray-900">
              すでにお得なプランをお使いです！
            </h2>
            <p className="mt-3 text-sm text-gray-500">
              現在のプランを継続されることをおすすめします。
            </p>
          </div>

          <button
            onClick={onRetry}
            className="mt-8 text-sm font-medium text-blue-600 underline underline-offset-4 active:text-blue-800"
          >
            条件を変えてやり直す
          </button>
        </div>
      </div>
    );
  }

  const { recommended_plan, monthly_saving, annual_saving, reasons, cautions, not_recommended_if } =
    result;

  return (
    <div className="flex flex-col items-center px-5 pt-5 pb-8">
      <div className="mx-auto w-full max-w-md">
        {/* おすすめラベル + キャリア名 + プラン名 */}
        <div className="rounded-xl bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold text-blue-600">
            あなたへのおすすめ
          </p>
          <h2 className="mt-1 text-lg font-bold text-gray-900">
            {recommended_plan.provider_name}
            <span className="ml-1.5 text-sm font-normal text-gray-500">
              {recommended_plan.plan_name}
            </span>
          </h2>

          {/* 改善額：緑色で強調 */}
          <div className="mt-2 rounded-lg bg-green-50 px-3 py-2">
            <p className="text-base font-bold text-green-600">
              → 今より月{monthly_saving.toLocaleString()}円お得
            </p>
          </div>
        </div>

        {/* 理由リスト（コンパクト） */}
        <div className="mt-3">
          <p className="text-xs font-bold text-gray-500">★ あなたに合う理由</p>
          <ul className="mt-1 space-y-0.5">
            {reasons.map((reason, i) => (
              <li key={i} className="flex items-start gap-1.5 text-xs text-gray-700">
                <span className="mt-px shrink-0 text-blue-500">・</span>
                {reason}
              </li>
            ))}
          </ul>
        </div>

        {/* 向かない人（コンパクト） */}
        <div className="mt-2">
          <p className="text-xs font-bold text-gray-500">⚠️ これは向かない人</p>
          <ul className="mt-1 space-y-0.5">
            {not_recommended_if.map((item, i) => (
              <li key={i} className="flex items-start gap-1.5 text-xs text-gray-600">
                <span className="mt-px shrink-0">・</span>
                {item}
              </li>
            ))}
          </ul>
        </div>

        {/* CTAボタン */}
        <a
          href={recommended_plan.official_url}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-4 block w-full rounded-xl bg-blue-600 py-3 text-center text-base font-bold text-white shadow-md transition-all active:scale-[0.98] sm:hover:bg-blue-700"
        >
          公式サイトで確認する →
        </a>
        <p className="mt-1.5 text-center text-[10px] text-gray-400">
          ※ 公式サイトに飛ぶだけです ／ ※ 紹介リンクです
        </p>

        {/* 区切り線 + 折りたたみ */}
        <hr className="mt-5 border-gray-200" />

        <button
          onClick={() => setDetailOpen(!detailOpen)}
          className="flex w-full items-center justify-center gap-1 py-2.5 text-sm font-medium text-gray-400 transition-colors active:text-gray-600"
        >
          詳細を見る
          <span
            className={`inline-block text-xs transition-transform duration-200 ${
              detailOpen ? "rotate-180" : ""
            }`}
          >
            ▼
          </span>
        </button>

        {detailOpen && (
          <div className="animate-fadeIn space-y-4 pb-4">
            {/* 1. 年間節約額 */}
            <div className="rounded-lg bg-green-50 p-3">
              <p className="text-center text-lg font-bold text-green-600">
                年間 {annual_saving.toLocaleString()}円 節約
              </p>
              <p className="mt-1 text-center text-xs text-gray-500">
                月額 {monthly_saving.toLocaleString()}円 × 12ヶ月
              </p>
            </div>

            {/* 2. 初年度キャンペーン */}
            <div className="rounded-lg bg-amber-50 p-3">
              <p className="text-sm font-bold text-gray-700">
                初年度キャンペーン：+{getCampaignText(recommended_plan.provider_name)}相当
              </p>
              <p className="mt-1 text-[10px] text-gray-400">
                ※ 初年度のみ。内容は予告なく変更される場合があります。
              </p>
            </div>

            {/* 3. プランの詳細 */}
            <div className="rounded-lg bg-gray-50 p-3">
              <p className="text-xs font-bold text-gray-700">プランの詳細</p>
              <div className="mt-1.5 space-y-1 text-xs text-gray-600">
                <div className="flex justify-between">
                  <span>月額基本料</span>
                  <span>{recommended_plan.monthly_fee_base.toLocaleString()}円</span>
                </div>
                <div className="flex justify-between">
                  <span>データ容量</span>
                  <span>
                    {recommended_plan.unlimited_data
                      ? "無制限"
                      : `${recommended_plan.data_allowance_gb}GB`}
                  </span>
                </div>
              </div>
            </div>

            {/* 4. デメリット・注意点 */}
            <div className="rounded-lg bg-red-50 p-3">
              <p className="text-xs font-bold text-gray-700">⚠️ デメリット・注意点</p>
              <ul className="mt-1.5 space-y-0.5">
                {recommended_plan.demerits.map((demerit, i) => (
                  <li key={i} className="flex items-start gap-1.5 text-xs text-gray-600">
                    <span className="mt-px shrink-0 text-red-400">・</span>
                    {demerit}
                  </li>
                ))}
                {cautions.map((caution, i) => (
                  <li key={`c-${i}`} className="flex items-start gap-1.5 text-xs text-gray-600">
                    <span className="mt-px shrink-0 text-red-400">・</span>
                    {caution}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {/* やり直しボタン */}
        <div className="mt-4 pb-2 text-center">
          <button
            onClick={onRetry}
            className="text-sm font-medium text-blue-600 underline underline-offset-4 active:text-blue-800"
          >
            条件を変えてやり直す
          </button>
        </div>
      </div>
    </div>
  );
}
