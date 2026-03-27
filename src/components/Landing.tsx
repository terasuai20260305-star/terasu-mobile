"use client";

interface LandingProps {
  onStart: () => void;
}

export default function Landing({ onStart }: LandingProps) {
  return (
    <div className="min-h-[100dvh] bg-gradient-to-b from-slate-50 to-blue-50">
      {/* ヒーローセクション */}
      <div className="flex flex-col px-5 pt-8 pb-6">
        {/* ロゴ/サービス名エリア（左寄せ） */}
        <div className="mb-8">
          <p className="text-sm font-bold text-gray-700">てらすAI</p>
          <p className="text-[10px] text-gray-400">固定費かんたん最適化</p>
        </div>

        {/* バッジ（中央） */}
        <div className="flex justify-center">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-white px-3.5 py-1 text-xs font-medium text-blue-700">
            📱 携帯料金 見直しサービス
          </span>
        </div>

        {/* メインコピー */}
        <h1 className="mt-5 text-center text-3xl font-bold leading-tight text-gray-900">
          あなたの携帯料金、
          <br />
          まだ高いかもしれません。
        </h1>

        {/* サブコピー */}
        <p className="mt-3 text-center text-base text-gray-500">
          3問に答えるだけで、今すぐ確認できます。
        </p>

        {/* 改善額イメージ */}
        <div className="mx-auto mt-6 w-full max-w-xs rounded-2xl bg-green-50 p-4">
          <p className="text-center text-2xl font-extrabold text-green-600">
            平均 月2,800<span className="text-base">円</span> 節約
          </p>
        </div>

        {/* CTAボタン */}
        <button
          onClick={onStart}
          className="mx-auto mt-6 w-full max-w-xs rounded-2xl bg-blue-600 px-8 py-4 text-lg font-bold text-white shadow-lg transition-all active:scale-[0.98] sm:hover:bg-blue-700"
        >
          今すぐ無料でスキャン →
        </button>

        {/* ボタン下の安心文言 */}
        <div className="mt-3 flex items-center justify-center gap-3 text-xs text-gray-400">
          <span>✓ 無料</span>
          <span>✓ 登録不要</span>
          <span>✓ 1分以内</span>
        </div>

        {/* 信頼性バッジ */}
        <div className="mx-auto mt-6 flex max-w-xs flex-col gap-1.5 text-[11px] text-gray-400">
          <div className="flex items-center gap-2">
            <span>🔒</span>
            <span>個人情報の入力なし</span>
          </div>
          <div className="flex items-center gap-2">
            <span>📊</span>
            <span>公式情報をもとに提案</span>
          </div>
          <div className="flex items-center gap-2">
            <span>💰</span>
            <span>完全無料</span>
          </div>
        </div>
      </div>

      {/* 「こんな方に」セクション */}
      <div className="px-5 py-8">
        <p className="text-center text-sm font-bold text-gray-700">
          こんな方に使ってほしいサービスです
        </p>

        <div className="mx-auto mt-4 flex max-w-sm flex-col gap-3">
          <div className="rounded-xl bg-white p-4 shadow-sm">
            <p className="text-xl">📱</p>
            <p className="mt-2 text-sm font-semibold text-gray-800">
              大手キャリアを使い続けている
            </p>
            <p className="mt-1 text-xs leading-relaxed text-gray-400">
              ドコモ・au・ソフトバンクは同じデータ量でも格安SIMの3〜4倍の料金になることがあります。
            </p>
          </div>

          <div className="rounded-xl bg-white p-4 shadow-sm">
            <p className="text-xl">🤔</p>
            <p className="mt-2 text-sm font-semibold text-gray-800">
              格安SIMは気になるけど不安
            </p>
            <p className="mt-1 text-xs leading-relaxed text-gray-400">
              デメリットもわかったうえでご提案します。向かない方にはおすすめしません。
            </p>
          </div>

          <div className="rounded-xl bg-white p-4 shadow-sm">
            <p className="text-xl">⏰</p>
            <p className="mt-2 text-sm font-semibold text-gray-800">
              調べる時間がない
            </p>
            <p className="mt-1 text-xs leading-relaxed text-gray-400">
              3問に答えるだけ。比較サイトを読み込む必要はありません。
            </p>
          </div>
        </div>
      </div>

      {/* 底部CTA */}
      <div className="px-5 pb-10">
        <button
          onClick={onStart}
          className="mx-auto block w-full max-w-sm rounded-2xl bg-blue-600 px-8 py-4 text-base font-bold text-white shadow-md transition-all active:scale-[0.98] sm:hover:bg-blue-700"
        >
          今すぐ無料でスキャン →
        </button>
      </div>
    </div>
  );
}
