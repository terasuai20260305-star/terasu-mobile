"use client";

interface ProgressBarProps {
  current: number;
  total: number;
}

export default function ProgressBar({ current, total }: ProgressBarProps) {
  const percentage = (current / total) * 100;

  return (
    <div className="w-full">
      <p className="mb-1.5 text-right text-xs text-gray-400">
        {total}問中{current}問目
      </p>
      <div className="h-[2px] w-full overflow-hidden bg-gray-200">
        <div
          className="h-full bg-blue-600 transition-all duration-500 ease-out"
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}
