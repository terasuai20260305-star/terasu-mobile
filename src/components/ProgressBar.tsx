"use client";

interface ProgressBarProps {
  current: number;
  total: number;
  onBack?: () => void;
}

export default function ProgressBar({ current, total, onBack }: ProgressBarProps) {
  return (
    <div className="sticky top-0 z-10 flex items-center justify-between bg-white/95 px-4 py-3 backdrop-blur-sm">
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

      {/* 中央: ステップドット */}
      <div className="flex items-center gap-2">
        {Array.from({ length: total }, (_, i) => (
          <div
            key={i}
            className={`h-2 w-2 rounded-full transition-all duration-300 ${
              i < current
                ? "bg-blue-600"
                : "bg-gray-200"
            }`}
          />
        ))}
      </div>

      {/* 右: Q番号 */}
      <span className="text-xs font-medium text-gray-400">
        Q{current} / {total}
      </span>
    </div>
  );
}
