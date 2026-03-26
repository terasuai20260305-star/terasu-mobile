"use client";

interface LandingProps {
  onStart: () => void;
}

export default function Landing({ onStart }: LandingProps) {
  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center px-6">
      <div className="mx-auto max-w-md text-center">
        <h1 className="text-2xl font-bold leading-tight text-gray-900 sm:text-3xl">
          あなたの携帯プラン、
          <br />
          3問でスキャンします。
        </h1>

        <p className="mt-4 text-base text-gray-500 sm:text-lg">
          今より安くなるか、今すぐ確認。
        </p>

        <button
          onClick={onStart}
          className="mt-8 w-full rounded-xl bg-blue-600 px-8 py-4 text-lg font-bold text-white shadow-lg transition-all active:scale-[0.98] sm:hover:bg-blue-700"
        >
          3問だけ答える →
        </button>

        <p className="mt-3 text-xs text-gray-400">
          無料・登録不要・1分以内
        </p>
      </div>
    </div>
  );
}
