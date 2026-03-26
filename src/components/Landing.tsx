"use client";

interface LandingProps {
  onStart: () => void;
}

export default function Landing({ onStart }: LandingProps) {
  return (
    <div className="min-h-[100dvh] bg-gradient-to-b from-blue-50 via-white to-white">
      {/* ヒーローセクション */}
      <div className="flex flex-col items-center px-5 pt-14 pb-6">
        {/* サービスバッジ */}
        <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-100 px-3 py-1 text-xs font-medium text-blue-700">
          📱 スマホ料金の最適化
        </span>

        {/* メインコピー */}
        <h1 className="mt-5 text-center text-2xl font-extrabold leading-tight text-gray-900">
          あなたに最適な1件を、
          <br />
          <span className="text-blue-600">3問で</span>見つけます。
        </h1>

        <p className="mt-3 text-center text-sm leading-relaxed text-gray-500">
          比較サイトではありません。
          <br />
          AIがあなたの条件に合う
          <span className="font-semibold text-gray-700">ベストな1件</span>
          をお伝えします。
        </p>

        {/* 節約プレビュー */}
        <div className="mt-6 w-full max-w-xs rounded-2xl bg-white p-4 shadow-md">
          <p className="text-center text-xs text-gray-400">平均的な節約額</p>
          <p className="mt-1 text-center text-3xl font-extrabold text-green-600">
            月3,000<span className="text-lg">円〜</span>
          </p>
          <p className="mt-0.5 text-center text-xs text-gray-400">
            年間 36,000円以上の節約も
          </p>
        </div>

        {/* CTAボタン */}
        <button
          onClick={onStart}
          className="mt-6 w-full max-w-xs rounded-2xl bg-blue-600 px-8 py-4 text-lg font-bold text-white shadow-lg transition-all active:scale-[0.98] sm:hover:bg-blue-700"
        >
          無料で診断する →
        </button>

        {/* 信頼バッジ */}
        <div className="mt-3 flex items-center justify-center gap-3 text-[10px] text-gray-400">
          <span>✓ 登録不要</span>
          <span>✓ 完全無料</span>
          <span>✓ 1分で完了</span>
        </div>
      </div>

      {/* こんな方にセクション */}
      <div className="px-5 py-8">
        <p className="text-center text-sm font-bold text-gray-700">
          こんな方におすすめ
        </p>

        <div className="mx-auto mt-4 flex max-w-sm flex-col gap-3">
          <div className="flex items-start gap-3 rounded-xl bg-white p-3.5 shadow-sm">
            <span className="mt-0.5 shrink-0 text-xl">💸</span>
            <div>
              <p className="text-sm font-semibold text-gray-800">スマホ代が高い気がする</p>
              <p className="mt-0.5 text-xs text-gray-400">大手キャリアなら月3,000〜5,000円安くなる可能性</p>
            </div>
          </div>

          <div className="flex items-start gap-3 rounded-xl bg-white p-3.5 shadow-sm">
            <span className="mt-0.5 shrink-0 text-xl">😵‍💫</span>
            <div>
              <p className="text-sm font-semibold text-gray-800">プランが多すぎて選べない</p>
              <p className="mt-0.5 text-xs text-gray-400">あなたの条件にマッチする1件だけをご提案</p>
            </div>
          </div>

          <div className="flex items-start gap-3 rounded-xl bg-white p-3.5 shadow-sm">
            <span className="mt-0.5 shrink-0 text-xl">⏰</span>
            <div>
              <p className="text-sm font-semibold text-gray-800">比較する時間がない</p>
              <p className="mt-0.5 text-xs text-gray-400">たった3問、1分以内で結果が出ます</p>
            </div>
          </div>
        </div>
      </div>

      {/* 底部CTA（スクロール後に見える） */}
      <div className="px-5 pb-10">
        <button
          onClick={onStart}
          className="mx-auto block w-full max-w-sm rounded-2xl bg-blue-600 px-8 py-4 text-base font-bold text-white shadow-md transition-all active:scale-[0.98] sm:hover:bg-blue-700"
        >
          3問だけ答える →
        </button>
      </div>
    </div>
  );
}
