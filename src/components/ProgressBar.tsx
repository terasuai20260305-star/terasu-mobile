"use client";

interface ProgressBarProps {
  current: number;
  total: number;
  onBack?: () => void;
}

export default function ProgressBar({ current, total, onBack }: ProgressBarProps) {
  return (
    <div className="sticky top-0 z-10 flex items-center justify-between bg-white px-4 py-2 shadow-sm">
      {/* 左: 戻るボタン */}
      <button
        onClick={onBack}
        disabled={!onBack}
        className={`flex h-8 w-8 items-center justify-center rounded-full text-sm transition-colors ${
          onBack
            ? "text-gray-500 active:bg-gray-100"
            : "text-transparent"
        }`}
        aria-label="戻る"
      >
        ←
      </button>

      {/* 中央: ステップドット（サイズ差分あり） */}
      <div className="flex items-center gap-2.5">
        {Array.from({ length: total }, (_, i) => {
          const stepNum = i + 1;
          const isCurrent = stepNum === current;
          const isCompleted = stepNum < current;

          return (
            <div
              key={i}
              className={`rounded-full transition-all duration-300 ${
                isCurrent
                  ? "h-4 w-4 bg-blue-600 ring-2 ring-blue-200"
                  : isCompleted
                    ? "h-3 w-3 bg-blue-600"
                    : "h-3 w-3 bg-gray-200"
              }`}
            />
          );
        })}
      </div>

      {/* 右: Q番号 */}
      <span className="text-xs text-gray-400">
        Q{current} / {total}
      </span>
    </div>
  );
}
